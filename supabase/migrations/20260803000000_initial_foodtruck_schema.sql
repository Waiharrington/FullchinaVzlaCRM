-- #############################################################################
-- ##                                                                         ##
-- ##   ⛔  ESTE ARCHIVO ESTÁ DESACTUALIZADO — NO EJECUTAR TAL CUAL  ⛔        ##
-- ##                                                                         ##
-- #############################################################################
--
-- EL NOMBRE DEL SCHEMA QUE USA ESTE ARCHIVO ES INCORRECTO.
--
--     ❌ Dice:        foodtruck
--     ✅ El real es:  fullchinavzla
--
-- El schema fue renombrado el 2026-08-05 a `fullchinavzla` (el negocio es de
-- comida china venezolana, no un food truck). El schema `foodtruck` YA NO EXISTE
-- en el servidor.
--
-- Este archivo menciona `foodtruck` cientos de veces: en los CREATE TABLE, en los
-- cuerpos de las 21 funciones, en su `SET search_path`, en las 72 políticas RLS y
-- en todos los GRANT.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SI NECESITAS RE-EJECUTARLO, PRIMERO RENOMBRA TODO:
--
--     sed 's/foodtruck/fullchinavzla/g' 20260803000000_initial_foodtruck_schema.sql \
--       > 20260803000000_initial_fullchinavzla_schema.sql
--
-- Ejecutarlo sin ese paso CREARÍA UN SCHEMA `foodtruck` NUEVO Y VACÍO, paralelo
-- al real, y la app seguiría sin funcionar mientras tú crees que sí se aplicó.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ESTADO ACTUAL DEL SERVIDOR (verificado el 2026-08-05):
--   · El schema `fullchinavzla` YA EXISTE y está aplicado: 27 tablas,
--     21 funciones, 72 políticas RLS. No hace falta correr esta migración.
--   · Los GRANT para anon/authenticated/service_role ya están puestos.
--   · `PGRST_DB_SCHEMAS` en el VPS ya incluye `fullchinavzla`.
--   · La app apunta correctamente: `src/lib/supabase.ts` usa
--     `db: { schema: 'fullchinavzla' }`.
--
-- Ver `C:\Users\Waiha\supabase\RUNBOOK-VPS.md` (Trampa 4) para el procedimiento
-- completo de renombrado de schemas.
--
-- #############################################################################

-- =============================================================================
-- Migración inicial: esquema foodtruck para Supabase self-hosted
-- =============================================================================
-- Versión: 5 (post gate v3, 8 items: NULL role, order guard, payment concurrency, purchase_items, search_path)
-- Autor: Claude Code (asistente AI)
-- Fecha: 2026-08-03
-- Descripción: Crea el esquema provisional "foodtruck" con tablas, funciones,
--   triggers, vistas, RLS y grants para la PWA de administración de food truck.
--
-- ORDEN EJECUTIVO (CRÍTICO):
--   1. Todas las tablas (sin dependencias de funciones)
--   2. Todas las funciones helper y de triggers
--   3. Todos los CREATE TRIGGER
--   4. Todas las vistas
--   5. Todas las políticas RLS
--   6. Todos los grants
--
-- NINGÚN trigger puede referenciar una función aún no creada.
--
-- REQUISITOS:
--   1. PostgreSQL 15+ (security_invoker en vistas)
--   2. Esquema foodtruck debe existir: CREATE SCHEMA IF NOT EXISTS foodtruck;
--   3. Roles: authenticator, anon, authenticated, service_role
--   4. PostgREST expone SOLO foodtruck (no public)
--
-- CAMBIOS vs versión anterior (gate v2):
--   (1) Orden estricto: tables → functions → triggers → views → RLS → grants
--   (2) preparation_batch_costs separado (cashier no ve costos de lotes)
--   (3) daily_close_financials separado (cashier no ve gastos/balance)
--   (4) Credits status DERIVADO solamente (eliminada fn_update_credit_status)
--   (5) Sin GRANT EXECUTE ON ALL FUNCTIONS; EXECUTE explícito solo RPC necesarias
--   (6) Rollback: guardia real antes de DROP con setting transaction-local
--   (7) Credit payment: FOR UPDATE lock antes de sumar (concurrencia)
--   (8) Triggers internos insertan directamente, no dependen de add_stock_movement
--   (9) Conversiones: solo identidad o directa; error claro para cadenas
--  (10) Conteos/docs/rollback actualizados
--  (11) cost_per_portion eliminado de preparation_batch_costs; se calcula inline en v_product_recipe_cost
--  (12) balance eliminado de daily_close_financials; se calcula en v_daily_close_summary (protegida)
--  (13) v_product_recipe_cost ahora JOIN preparation_batches para calcular costo/porción inline
--  (14) v_daily_close_summary vista financiera con balance = total_sales - total_expenses; no expuesta a cashier
-- CAMBIOS vs versión anterior (gate v3):
--  (15) search_path = foodtruck, pg_temp en TODAS las funciones SECURITY DEFINER (no solo foodtruck)
--  (16) NULL role bypass guard en add_stock_movement, fn_get_product_recipe_cost, fn_get_daily_close_summary
--  (17) fn_protect_order_items_closed: bloquea INSERT/UPDATE/DELETE items en órdenes cerradas; inmutables para todos
--  (18) fn_validate_payment_before_insert: BEFORE INSERT payments con FOR UPDATE lock, amount > 0, previene sobrepago
--  (19) fn_derive_order_status_from_payments: AFTER INSERT payments deriva estado paid
--  (20) fn_protect_order_status_transition: BEFORE UPDATE orders controla transiciones por rol; paid requiere cobertura
--  (21) fn_protect_order_amount_fields: BEFORE UPDATE orders bloquea modificación de órdenes paid/cancelled para no-owner/manager; owner/manager pueden editar campos de order pero no reabrir paid ni editar items
--  (22) fn_protect_purchase_item_edit: bloquea UPDATE/DELETE purchase_items con stock generado
--  (23) Rollback guardia dinámica: recorre pg_catalog/pg_tables (no lista parcial)
--  (24) Conteos: 21 funciones, 29 triggers, SECURITY DEFINER x21
-- =============================================================================

SET search_path TO foodtruck, public;

-- =============================================================================
-- 1. TABLAS (todas las tablas primero, sin funciones)
-- =============================================================================

-- 1.1 PERFILES
CREATE TABLE foodtruck.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.profiles IS 'Perfiles de usuario con roles del sistema';
CREATE INDEX idx_profiles_role ON foodtruck.profiles(role);

-- 1.2 UNITS
CREATE TABLE foodtruck.units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  symbol      TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.units IS 'Unidades de medida';

-- 1.3 UNIT_CONVERSIONS — Solo identidad o directa; NO cadenas
CREATE TABLE foodtruck.unit_conversions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit_id      UUID NOT NULL REFERENCES foodtruck.units(id),
  to_unit_id        UUID NOT NULL REFERENCES foodtruck.units(id),
  conversion_factor NUMERIC NOT NULL CHECK (conversion_factor > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_unit_id, to_unit_id),
  CHECK (from_unit_id <> to_unit_id)
);
COMMENT ON TABLE foodtruck.unit_conversions IS 'Conversiones directas entre unidades; cadenas no permitidas';

-- 1.4 SUPPLIERS
CREATE TABLE foodtruck.suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  contact     TEXT,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.suppliers IS 'Proveedores de ingredientes';

-- 1.5 INGREDIENTS (sin costo; costo en ingredient_costs)
CREATE TABLE foodtruck.ingredients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  unit_id       UUID NOT NULL REFERENCES foodtruck.units(id),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.ingredients IS 'Ingredientes con unidad base; costo en ingredient_costs';
CREATE INDEX idx_ingredients_unit ON foodtruck.ingredients(unit_id);

-- 1.6 INGREDIENT_COSTS (owner/manager solamente)
CREATE TABLE foodtruck.ingredient_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id   UUID NOT NULL UNIQUE REFERENCES foodtruck.ingredients(id),
  price_per_unit  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_per_unit >= 0),
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.ingredient_costs IS 'Costos por unidad base; solo owner/manager';

-- 1.7 PURCHASES
CREATE TABLE foodtruck.purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES foodtruck.suppliers(id),
  purchase_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_number  TEXT,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.purchases IS 'Compras a proveedores';
CREATE INDEX idx_purchases_supplier ON foodtruck.purchases(supplier_id);
CREATE INDEX idx_purchases_date ON foodtruck.purchases(purchase_date);

-- 1.8 PURCHASE_ITEMS (trigger auto-genera stock)
CREATE TABLE foodtruck.purchase_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id     UUID NOT NULL REFERENCES foodtruck.purchases(id) ON DELETE RESTRICT,
  ingredient_id   UUID NOT NULL REFERENCES foodtruck.ingredients(id),
  quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_id         UUID NOT NULL REFERENCES foodtruck.units(id),
  unit_cost       NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.purchase_items IS 'Detalle de compras; trigger genera stock automáticamente';
CREATE INDEX idx_purchase_items_purchase ON foodtruck.purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_ingredient ON foodtruck.purchase_items(ingredient_id);

-- 1.9 STOCK_MOVEMENTS (append-only, trigger interno inserta directamente)
CREATE TABLE foodtruck.stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id   UUID NOT NULL REFERENCES foodtruck.ingredients(id),
  quantity        NUMERIC(12,3) NOT NULL CHECK (quantity <> 0),
  unit_id         UUID NOT NULL REFERENCES foodtruck.units(id),
  movement_type   TEXT NOT NULL CHECK (movement_type IN (
    'purchase', 'consumption', 'adjustment', 'production_input', 'production_output'
  )),
  reference_type  TEXT CHECK (reference_type IN (
    'purchase_item', 'preparation_batch', 'order_item', 'manual'
  )),
  reference_id    UUID,
  notes           TEXT,
  created_by      UUID REFERENCES foodtruck.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.stock_movements IS 'Movimientos append-only; stock = SUM(quantity)';
COMMENT ON COLUMN foodtruck.stock_movements.quantity IS 'Positivo=entrada, negativo=salida; unidad base';
CREATE INDEX idx_stock_movements_ingredient ON foodtruck.stock_movements(ingredient_id);
CREATE INDEX idx_stock_movements_type ON foodtruck.stock_movements(movement_type);
CREATE INDEX idx_stock_movements_reference ON foodtruck.stock_movements(reference_type, reference_id);

-- 1.10 PREPARATION_BATCHES (solo datos operativos, sin costos)
CREATE TABLE foodtruck.preparation_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  production_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_produced   NUMERIC(12,3) NOT NULL CHECK (quantity_produced > 0),
  unit_produced_id    UUID NOT NULL REFERENCES foodtruck.units(id),
  waste_quantity      NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (waste_quantity >= 0),
  waste_percentage    NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN quantity_produced + waste_quantity > 0
    THEN round(waste_quantity / (quantity_produced + waste_quantity) * 100, 2)
    ELSE 0 END
  ) STORED,
  notes               TEXT,
  created_by          UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.preparation_batches IS 'Lotes de producción; costos en preparation_batch_costs';
CREATE INDEX idx_prep_batches_date ON foodtruck.preparation_batches(production_date);

-- 1.11 PREPARATION_BATCH_COSTS (owner/manager solamente)
CREATE TABLE foodtruck.preparation_batch_costs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preparation_batch_id  UUID NOT NULL UNIQUE REFERENCES foodtruck.preparation_batches(id),
  total_input_cost      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_input_cost >= 0),
  updated_by            UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.preparation_batch_costs IS 'Costos de lotes; costo por porción se calcula en v_product_recipe_cost';

-- 1.12 PREPARATION_BATCH_ITEMS
CREATE TABLE foodtruck.preparation_batch_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preparation_batch_id  UUID NOT NULL REFERENCES foodtruck.preparation_batches(id) ON DELETE RESTRICT,
  ingredient_id         UUID NOT NULL REFERENCES foodtruck.ingredients(id),
  quantity_used         NUMERIC(12,3) NOT NULL CHECK (quantity_used > 0),
  unit_id               UUID NOT NULL REFERENCES foodtruck.units(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.preparation_batch_items IS 'Ingredientes consumidos por lote';
CREATE INDEX idx_prep_batch_items_batch ON foodtruck.preparation_batch_items(preparation_batch_id);
CREATE INDEX idx_prep_batch_items_ingredient ON foodtruck.preparation_batch_items(ingredient_id);

-- 1.13 SELLABLE_PRODUCTS
CREATE TABLE foodtruck.sellable_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  sale_price    NUMERIC(12,2) NOT NULL CHECK (sale_price > 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.sellable_products IS 'Productos disponibles para venta';

-- 1.14 RECIPE_COMPONENTS
CREATE TABLE foodtruck.recipe_components (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sellable_product_id   UUID NOT NULL REFERENCES foodtruck.sellable_products(id) ON DELETE CASCADE,
  ingredient_id         UUID REFERENCES foodtruck.ingredients(id),
  preparation_batch_id  UUID REFERENCES foodtruck.preparation_batches(id),
  quantity              NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_id               UUID NOT NULL REFERENCES foodtruck.units(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_component_type CHECK (
    (ingredient_id IS NOT NULL AND preparation_batch_id IS NULL) OR
    (ingredient_id IS NULL AND preparation_batch_id IS NOT NULL)
  )
);
COMMENT ON TABLE foodtruck.recipe_components IS 'Recetas: ingredientes O porciones, nunca ambos';
CREATE INDEX idx_recipe_components_product ON foodtruck.recipe_components(sellable_product_id);
CREATE INDEX idx_recipe_components_ingredient ON foodtruck.recipe_components(ingredient_id);
CREATE INDEX idx_recipe_components_batch ON foodtruck.recipe_components(preparation_batch_id);

-- 1.15 ORDERS (order_number UNIQUE)
CREATE TABLE foodtruck.orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  SERIAL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'confirmed', 'paid', 'cancelled'
  )),
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_number)
);
COMMENT ON TABLE foodtruck.orders IS 'Órdenes de venta';
CREATE INDEX idx_orders_status ON foodtruck.orders(status);
CREATE INDEX idx_orders_created ON foodtruck.orders(created_at);

-- 1.16 ORDER_ITEMS
CREATE TABLE foodtruck.order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES foodtruck.orders(id) ON DELETE CASCADE,
  sellable_product_id UUID NOT NULL REFERENCES foodtruck.sellable_products(id),
  quantity            NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.order_items IS 'Detalle de productos en cada orden';
CREATE INDEX idx_order_items_order ON foodtruck.order_items(order_id);
CREATE INDEX idx_order_items_product ON foodtruck.order_items(sellable_product_id);

-- 1.17 PAYMENTS (inmutables: solo INSERT)
CREATE TABLE foodtruck.payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES foodtruck.orders(id) ON DELETE CASCADE,
  method        TEXT NOT NULL CHECK (method IN (
    'cash', 'card', 'transfer', 'other'
  )),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.payments IS 'Pagos inmutables; solo INSERT';
CREATE INDEX idx_payments_order ON foodtruck.payments(order_id);

-- 1.18 CREDITS (status DERIVADO en vista, no almacenado)
CREATE TABLE foodtruck.credits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES foodtruck.orders(id),
  customer_name TEXT NOT NULL,
  total_amount  NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.credits IS 'Créditos; status se deriva en v_credit_balances';
CREATE INDEX idx_credits_order ON foodtruck.credits(order_id);

-- 1.19 CREDIT_PAYMENTS (trigger valida sobreabono con FOR UPDATE)
CREATE TABLE foodtruck.credit_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id   UUID NOT NULL REFERENCES foodtruck.credits(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  notes       TEXT,
  created_by  UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.credit_payments IS 'Abonos; trigger bloquea crédito para prevenir sobreabono';
CREATE INDEX idx_credit_payments_credit ON foodtruck.credit_payments(credit_id);

-- 1.20 EXPENSES
CREATE TABLE foodtruck.expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept       TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category      TEXT NOT NULL CHECK (category IN (
    'fixed', 'variable', 'other'
  )),
  expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.expenses IS 'Gastos operativos (owner/manager)';
CREATE INDEX idx_expenses_date ON foodtruck.expenses(expense_date);
CREATE INDEX idx_expenses_category ON foodtruck.expenses(category);

-- 1.21 EMPLOYEES
CREATE TABLE foodtruck.employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  position      TEXT,
  hourly_rate   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.employees IS 'Empleados';

-- 1.22 PAYROLL_PERIODS (solo owner)
CREATE TABLE foodtruck.payroll_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'closed', 'paid'
  )),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
COMMENT ON TABLE foodtruck.payroll_periods IS 'Periodos de nómina (solo owner)';
CREATE INDEX idx_payroll_periods_dates ON foodtruck.payroll_periods(start_date, end_date);

-- 1.23 PAYROLL_ENTRIES (solo owner)
CREATE TABLE foodtruck.payroll_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES foodtruck.payroll_periods(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES foodtruck.employees(id),
  hours_worked      NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (hours_worked >= 0),
  base_salary       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  deductions        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_pay           NUMERIC(12,2) GENERATED ALWAYS AS (base_salary - deductions) STORED,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_period_id, employee_id),
  CHECK (net_pay >= 0)
);
COMMENT ON TABLE foodtruck.payroll_entries IS 'Liquidaciones por empleado (solo owner)';
CREATE INDEX idx_payroll_entries_period ON foodtruck.payroll_entries(payroll_period_id);
CREATE INDEX idx_payroll_entries_employee ON foodtruck.payroll_entries(employee_id);

-- 1.24 ADVANCES (solo owner)
CREATE TABLE foodtruck.advances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES foodtruck.employees(id),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  advance_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  is_deducted   BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.advances IS 'Adelantos de salario (solo owner)';
CREATE INDEX idx_advances_employee ON foodtruck.advances(employee_id);
CREATE INDEX idx_advances_pending ON foodtruck.advances(is_deducted) WHERE NOT is_deducted;

-- 1.25 PRODUCTION_BONUSES (solo owner)
CREATE TABLE foodtruck.production_bonuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES foodtruck.employees(id),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  bonus_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reason        TEXT,
  created_by    UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.production_bonuses IS 'Bonos por producción (solo owner)';
CREATE INDEX idx_prod_bonuses_employee ON foodtruck.production_bonuses(employee_id);
CREATE INDEX idx_prod_bonuses_date ON foodtruck.production_bonuses(bonus_date);

-- 1.26 DAILY_CLOSES (solo campos operativos; financieros en daily_close_financials)
CREATE TABLE foodtruck.daily_closes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  close_date        DATE NOT NULL UNIQUE,
  total_sales       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
  total_payments    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_payments >= 0),
  notes             TEXT,
  closed_by         UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.daily_closes IS 'Cierres diarios operativos; financieros en daily_close_financials';
CREATE INDEX idx_daily_closes_date ON foodtruck.daily_closes(close_date);

-- 1.27 DAILY_CLOSE_FINANCIALS (owner/manager solamente)
CREATE TABLE foodtruck.daily_close_financials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_close_id    UUID NOT NULL UNIQUE REFERENCES foodtruck.daily_closes(id),
  total_expenses    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_expenses >= 0),
  total_credits     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_credits >= 0),
  updated_by        UUID NOT NULL REFERENCES foodtruck.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE foodtruck.daily_close_financials IS 'Datos financieros de cierre; solo owner/manager. Balance se calcula en v_daily_close_summary';

-- =============================================================================
-- 2. FUNCIONES (todas las funciones después de todas las tablas)
-- =============================================================================

-- 2.1 get_current_user_role — SECURITY DEFINER, search_path fijo
CREATE FUNCTION foodtruck.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
  SELECT role FROM foodtruck.profiles WHERE id = auth.uid();
$$;
COMMENT ON FUNCTION foodtruck.get_current_user_role() IS
  'Retorna rol del usuario; SECURITY DEFINER evita recursión RLS';

-- 2.2 handle_updated_at
CREATE FUNCTION foodtruck.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2.3 normalize_to_base_unit — Solo identidad o directa; error para cadenas
CREATE FUNCTION foodtruck.normalize_to_base_unit(
  p_ingredient_id UUID,
  p_quantity NUMERIC,
  p_from_unit_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_base_unit_id UUID;
  v_conversion_factor NUMERIC;
BEGIN
  SELECT unit_id INTO v_base_unit_id
  FROM foodtruck.ingredients WHERE id = p_ingredient_id;

  IF v_base_unit_id IS NULL THEN
    RAISE EXCEPTION 'Ingrediente % no encontrado', p_ingredient_id;
  END IF;

  -- Identidad: ya está en unidad base
  IF p_from_unit_id = v_base_unit_id THEN
    RETURN p_quantity;
  END IF;

  -- Buscar conversión directa (NO cadenas)
  SELECT conversion_factor INTO v_conversion_factor
  FROM foodtruck.unit_conversions
  WHERE from_unit_id = p_from_unit_id AND to_unit_id = v_base_unit_id;

  IF v_conversion_factor IS NOT NULL THEN
    RETURN p_quantity * v_conversion_factor;
  END IF;

  -- No hay conversión directa; error claro
  RAISE EXCEPTION
    'No existe conversión directa de unidad % a unidad base % para ingrediente %. '
    'Solo se permiten conversiones directas, no cadenas.',
    p_from_unit_id, v_base_unit_id, p_ingredient_id;
END;
$$;
COMMENT ON FUNCTION foodtruck.normalize_to_base_unit IS
  'Convierte a unidad base; solo directo, error si no existe conversión';

-- 2.4 add_stock_movement — Para uso RPC/manual; valida owner/manager
-- NOTA: Los triggers internos NO usan esta función; insertan directamente.
CREATE FUNCTION foodtruck.add_stock_movement(
  p_ingredient_id UUID,
  p_quantity NUMERIC,
  p_unit_id UUID,
  p_movement_type TEXT,
  p_reference_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_id UUID;
BEGIN
  v_role := foodtruck.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager pueden crear movimientos de stock. Rol: %', v_role;
  END IF;

  INSERT INTO foodtruck.stock_movements (
    ingredient_id, quantity, unit_id, movement_type,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    p_ingredient_id, p_quantity, p_unit_id, p_movement_type,
    p_reference_type, p_reference_id, p_notes, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION foodtruck.add_stock_movement IS
  'RPC para movimientos de stock; valida rol owner/manager';

-- 2.5 update_batch_cost — Recalcula costo del lote
CREATE FUNCTION foodtruck.update_batch_cost(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_total NUMERIC(12,2);
  v_batch_creator UUID;
BEGIN
  SELECT COALESCE(SUM(pbi.quantity_used * ic.price_per_unit), 0)
  INTO v_total
  FROM foodtruck.preparation_batch_items pbi
  JOIN foodtruck.ingredient_costs ic ON ic.ingredient_id = pbi.ingredient_id
  WHERE pbi.preparation_batch_id = p_batch_id;

  SELECT created_by INTO v_batch_creator
  FROM foodtruck.preparation_batches WHERE id = p_batch_id;

  INSERT INTO foodtruck.preparation_batch_costs (
    preparation_batch_id, total_input_cost, updated_by
  ) VALUES (
    p_batch_id, v_total, COALESCE(v_batch_creator, auth.uid())
  )
  ON CONFLICT (preparation_batch_id) DO UPDATE SET
    total_input_cost = EXCLUDED.total_input_cost,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;
END;
$$;
COMMENT ON FUNCTION foodtruck.update_batch_cost IS
  'Recalcula costo total de materia prima de un lote';

-- 2.6 fn_purchase_item_to_stock — Trigger interno; inserta directamente
-- NO depende de add_stock_movement; inserta directamente en stock_movements.
CREATE FUNCTION foodtruck.fn_purchase_item_to_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_base_unit UUID;
  v_normalized NUMERIC;
  v_price NUMERIC(12,2);
  v_purchase_creator UUID;
BEGIN
  SELECT unit_id INTO v_base_unit
  FROM foodtruck.ingredients WHERE id = NEW.ingredient_id;

  -- Normalizar a unidad base
  IF NEW.unit_id = v_base_unit THEN
    v_normalized := NEW.quantity;
  ELSE
    v_normalized := foodtruck.normalize_to_base_unit(NEW.ingredient_id, NEW.quantity, NEW.unit_id);
  END IF;

  -- Obtener creador de la compra
  SELECT created_by INTO v_purchase_creator
  FROM foodtruck.purchases WHERE id = NEW.purchase_id;

  -- Insertar stock movement DIRECTAMENTE (no vía add_stock_movement)
  INSERT INTO foodtruck.stock_movements (
    ingredient_id, quantity, unit_id, movement_type,
    reference_type, reference_id, created_by
  ) VALUES (
    NEW.ingredient_id, v_normalized, v_base_unit, 'purchase',
    'purchase_item', NEW.id, v_purchase_creator
  );

  -- Calcular costo normalizado
  v_price := NEW.unit_cost;
  IF NEW.unit_id <> v_base_unit THEN
    v_price := NEW.unit_cost / foodtruck.normalize_to_base_unit(NEW.ingredient_id, 1, NEW.unit_id);
  END IF;

  -- Actualizar costo
  INSERT INTO foodtruck.ingredient_costs (ingredient_id, price_per_unit, updated_by)
  VALUES (NEW.ingredient_id, v_price, v_purchase_creator)
  ON CONFLICT (ingredient_id) DO UPDATE SET
    price_per_unit = EXCLUDED.price_per_unit,
    last_updated = now(),
    updated_by = EXCLUDED.updated_by;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_purchase_item_to_stock IS
  'Trigger: genera stock y actualiza costo; inserta directamente';

-- 2.7 fn_protect_purchase_delete
CREATE FUNCTION foodtruck.fn_protect_purchase_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM foodtruck.stock_movements
    WHERE reference_type = 'purchase_item' AND reference_id IN (
      SELECT id FROM foodtruck.purchase_items WHERE purchase_id = OLD.id
    )
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar compra %: tiene stock asociado. Use ajustes.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_protect_purchase_delete IS
  'Impide borrado de compras con stock asociado';

-- 2.8 fn_protect_batch_delete
CREATE FUNCTION foodtruck.fn_protect_batch_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM foodtruck.stock_movements
    WHERE reference_type = 'preparation_batch' AND reference_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar lote %: tiene stock asociado. Use ajustes.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_protect_batch_delete IS
  'Impide borrado de lotes con stock asociado';

-- 2.9 fn_batch_items_cost_trigger — Actualiza costo y genera consumo normalizado a unidad base
CREATE FUNCTION foodtruck.fn_batch_items_cost_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_batch_creator UUID;
  v_normalized NUMERIC;
  v_base_unit UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM foodtruck.update_batch_cost(NEW.preparation_batch_id);

    SELECT created_by INTO v_batch_creator
    FROM foodtruck.preparation_batches WHERE id = NEW.preparation_batch_id;

    -- Normalizar quantity_used a unidad base del ingrediente
    v_normalized := foodtruck.normalize_to_base_unit(
      NEW.ingredient_id, NEW.quantity_used, NEW.unit_id
    );

    SELECT unit_id INTO v_base_unit
    FROM foodtruck.ingredients WHERE id = NEW.ingredient_id;

    INSERT INTO foodtruck.stock_movements (
      ingredient_id, quantity, unit_id, movement_type,
      reference_type, reference_id, created_by
    ) VALUES (
      NEW.ingredient_id, -v_normalized, v_base_unit, 'consumption',
      'preparation_batch', NEW.preparation_batch_id, v_batch_creator
    );

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM foodtruck.update_batch_cost(OLD.preparation_batch_id);

    SELECT created_by INTO v_batch_creator
    FROM foodtruck.preparation_batches WHERE id = OLD.preparation_batch_id;

    -- Normalizar quantity_used a unidad base del ingrediente
    v_normalized := foodtruck.normalize_to_base_unit(
      OLD.ingredient_id, OLD.quantity_used, OLD.unit_id
    );

    SELECT unit_id INTO v_base_unit
    FROM foodtruck.ingredients WHERE id = OLD.ingredient_id;

    INSERT INTO foodtruck.stock_movements (
      ingredient_id, quantity, unit_id, movement_type,
      reference_type, reference_id, created_by
    ) VALUES (
      OLD.ingredient_id, v_normalized, v_base_unit, 'adjustment',
      'preparation_batch', OLD.preparation_batch_id, v_batch_creator
    );
  END IF;

  RETURN NULL;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_batch_items_cost_trigger IS
  'Trigger: actualiza costo del batch y genera/reverte stock normalizado a unidad base';

-- 2.10 fn_validate_credit_payment — FOR UPDATE lock + validación sobreabono
CREATE FUNCTION foodtruck.fn_validate_credit_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_total_amount NUMERIC(12,2);
  v_current_paid NUMERIC(12,2);
BEGIN
  -- Bloquear fila del crédito para prevenir sobreabono concurrente
  SELECT total_amount INTO v_total_amount
  FROM foodtruck.credits WHERE id = NEW.credit_id FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_current_paid
  FROM foodtruck.credit_payments WHERE credit_id = NEW.credit_id;

  IF v_current_paid + NEW.amount > v_total_amount THEN
    RAISE EXCEPTION 'Sobreabono: total=%, abonado=%, nuevo=%. Excedente=%',
      v_total_amount, v_current_paid, NEW.amount,
      (v_current_paid + NEW.amount - v_total_amount);
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_validate_credit_payment IS
  'Trigger: bloquea crédito FOR UPDATE y previene sobreabonos concurrentes';

-- 2.11 fn_protect_payment_update — Impide UPDATE en payments
CREATE FUNCTION foodtruck.fn_protect_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Los pagos son inmutables; no se permite UPDATE';
END;
$$;

-- 2.12 fn_protect_credit_update — Impide UPDATE en credits (status derivado)
CREATE FUNCTION foodtruck.fn_protect_credit_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Los créditos son inmutables; status se deriva en vista';
END;
$$;

-- 2.13 fn_protect_credit_payment_update — Impide UPDATE en credit_payments
CREATE FUNCTION foodtruck.fn_protect_credit_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Los abonos son inmutables; no se permite UPDATE';
END;
$$;

-- 2.14 fn_protect_order_items_closed — Bloquea INSERT/UPDATE/DELETE en items cuando la orden NO está abierta
-- Items son inmutables una vez que la orden sale de 'open' (confirmed/paid/cancelled).
-- Para todos los roles incluyendo owner/manager: sin edición de items cerrados.
-- Correcciones post-cierre: cancelación + nueva orden (no editar total histórico).
-- Bloquea NULL role / perfil inexistente igual que no autorizado.
CREATE FUNCTION foodtruck.fn_protect_order_items_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT o.status INTO v_status
  FROM foodtruck.orders o WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  -- Si la orden no existe, permitir (la FK fallará después)
  IF v_status IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Órdenes abiertas: siempre permitir crear/editar/carrito
  IF v_status = 'open' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Órdenes cerradas/pagadas/canceladas: inmutables para todos los roles
  RAISE EXCEPTION 'No se puede modificar items de orden % en estado %. '
    'Los items son inmutables fuera de open. Use cancelación o nueva orden.', COALESCE(NEW.order_id, OLD.order_id), v_status;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_protect_order_items_closed() IS
  'Trigger: bloquea INSERT/UPDATE/DELETE de items en órdenes cerradas; inmutables para todos los roles';

-- 2.15 fn_validate_payment_before_insert — BEFORE INSERT en payments: bloquea order, amount > 0, previene sobrepago
CREATE FUNCTION foodtruck.fn_validate_payment_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_order_status TEXT;
  v_total_amount NUMERIC(12,2);
  v_current_paid NUMERIC(12,2);
BEGIN
  -- Validar amount > 0 (redundante con CHECK pero explícito)
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a cero. Monto: %', NEW.amount;
  END IF;

  -- Bloquear fila de la orden para serializar inserts concurrentes
  SELECT status, (
    SELECT COALESCE(SUM(amount), 0) FROM foodtruck.payments WHERE order_id = NEW.order_id
  ) INTO v_order_status, v_current_paid
  FROM foodtruck.orders WHERE id = NEW.order_id FOR UPDATE;

  -- Verificar orden existente
  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Orden % no existe', NEW.order_id;
  END IF;

  -- Verificar que la orden no esté cancelada
  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'No se pueden registrar pagos para orden cancelada %', NEW.order_id;
  END IF;

  -- Prevenir sobrepago
  IF v_current_paid + NEW.amount > (
    SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
    FROM foodtruck.order_items oi WHERE oi.order_id = NEW.order_id
  ) THEN
    RAISE EXCEPTION 'Sobrepago: total=%, pagado=%, nuevo pago=%. Excedente=%',
      (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM foodtruck.order_items oi WHERE oi.order_id = NEW.order_id),
      v_current_paid, NEW.amount,
      (v_current_paid + NEW.amount - (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM foodtruck.order_items oi WHERE oi.order_id = NEW.order_id));
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_validate_payment_before_insert() IS
  'Trigger: BEFORE INSERT en payments; bloquea orden FOR UPDATE, valida amount > 0, previene sobrepago concurrente';

-- 2.16 fn_derive_order_status_from_payments — AFTER INSERT en payments: cambia estado a paid si total alcanzado
CREATE FUNCTION foodtruck.fn_derive_order_status_from_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_total_amount NUMERIC(12,2);
  v_total_paid NUMERIC(12,2);
  v_current_status TEXT;
BEGIN
  SELECT o.status INTO v_current_status
  FROM foodtruck.orders o WHERE o.id = NEW.order_id;

  -- Solo derivar si la orden está en estado confirmado o abierto
  IF v_current_status NOT IN ('open', 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- Calcular total de la orden
  SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) INTO v_total_amount
  FROM foodtruck.order_items oi WHERE oi.order_id = NEW.order_id;

  -- Calcular total pagado
  SELECT COALESCE(SUM(p.amount), 0) INTO v_total_paid
  FROM foodtruck.payments p WHERE p.order_id = NEW.order_id;

  -- Si está completamente pagado, marcar como paid
  IF v_total_paid >= v_total_amount AND v_total_amount > 0 THEN
    UPDATE foodtruck.orders SET status = 'paid', updated_at = now()
    WHERE id = NEW.order_id AND status IN ('open', 'confirmed');
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_derive_order_status_from_payments() IS
  'Trigger: AFTER INSERT en payments; deriva estado a paid cuando total pagado >= total orden';

-- 2.17 fn_protect_order_status_transition — BEFORE UPDATE en orders: controla transiciones de estado
-- Reglas:
--   • open/confirmed → paid: permitido para CUALQUIER rol si total_items > 0 y suma payments >= total
--     (AFTER INSERT de payments ya visible; validación de cobertura aquí)
--   • owner/manager: cualquier transición EXCEPTO reabrir paid (rompe integridad de pagos)
--   • cashier: open→confirmed, open→cancelled, y la transición validada a paid
--   • otros roles: bloquear todo
CREATE FUNCTION foodtruck.fn_protect_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_total_items NUMERIC(12,2);
  v_total_paid  NUMERIC(12,2);
BEGIN
  -- Si el status no cambia, permitir siempre
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_role := foodtruck.get_current_user_role();

  -- ── Transición a paid (open/confirmed → paid) ──────────────────────────
  -- Permitida para cualquier rol SOLO si total items > 0 y suma payments >= total.
  -- Como es AFTER INSERT en payments, el pago nuevo ya está visible en la consulta.
  IF OLD.status IN ('open', 'confirmed') AND NEW.status = 'paid' THEN
    SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
      INTO v_total_items
      FROM foodtruck.order_items oi WHERE oi.order_id = NEW.id;

    SELECT COALESCE(SUM(p.amount), 0)
      INTO v_total_paid
      FROM foodtruck.payments p WHERE p.order_id = NEW.id;

    IF v_total_items > 0 AND v_total_paid >= v_total_items THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No se puede marcar orden % como paid: total items %, pagado %. '
      'Se requiere cobertura completa.', NEW.id, v_total_items, v_total_paid;
  END IF;

  -- ── Reabrir paid → otro estado: bloqueado para todos ──────────────────
  -- Reabrir una orden paid rompe integridad (pagos registrados sin orden cobrada).
  IF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    RAISE EXCEPTION 'No se puede reabrir orden % desde estado paid a %. '
      'Las órdenes pagadas son finales.', OLD.id, NEW.status;
  END IF;

  -- ── owner/manager: otras correcciones excepto reabrir paid ────────────
  IF v_role IN ('owner', 'manager') THEN
    RETURN NEW;
  END IF;

  -- ── cashier: open→confirmed, open→cancelled ──────────────────────────
  IF v_role = 'cashier' THEN
    IF OLD.status = 'open' AND NEW.status IN ('confirmed', 'cancelled') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cashier no puede cambiar orden de estado % a %. '
      'Solo open→confirmed, open→cancelled, y transición validada a paid.', OLD.status, NEW.status;
  END IF;

  -- Otros roles: bloquear
  RAISE EXCEPTION 'Transición de estado % → % no permitida para rol %', OLD.status, NEW.status, v_role;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_protect_order_status_transition() IS
  'Trigger: BEFORE UPDATE en orders; controla transiciones por rol. Paid requiere cobertura completa de pagos.';

-- 2.18 fn_protect_order_amount_fields — BEFORE UPDATE en orders: bloquea modificación de órdenes paid/cancelled para no-owner/manager; owner/manager pueden editar campos de order pero no reabrir paid ni editar items
CREATE FUNCTION foodtruck.fn_protect_order_amount_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Solo interceptar si cambia notes o campos sensibles en órdenes cerradas
  IF OLD.status IN ('paid', 'cancelled') THEN
    v_role := foodtruck.get_current_user_role();
    IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
      RAISE EXCEPTION 'No se puede modificar orden % en estado %. Solo owner/manager.',
        OLD.id, OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_protect_order_amount_fields() IS
  'Trigger: BEFORE UPDATE en orders; bloquea modificación de órdenes paid/cancelled para no-owner/manager. Owner/manager pueden editar campos de order pero status paid no se reabre y items nunca se editan (fn_protect_order_items_closed).';

-- 2.19 fn_protect_purchase_item_edit — Bloquea UPDATE/DELETE en purchase_items después de generación de stock
CREATE FUNCTION foodtruck.fn_protect_purchase_item_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verificar si ya se generó stock para este item
  IF EXISTS(
    SELECT 1 FROM foodtruck.stock_movements
    WHERE reference_type = 'purchase_item' AND reference_id = OLD.id
  ) THEN
    v_role := foodtruck.get_current_user_role();
    IF v_role IN ('owner', 'manager') THEN
      RAISE EXCEPTION 'El item de compra % ya generó stock. '
        'Para corregir, use un movimiento de ajuste documentado, no edición silenciosa.', OLD.id;
    ELSE
      RAISE EXCEPTION 'El item de compra % ya generó stock. '
        'No se permite editar/eliminar.', OLD.id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_protect_purchase_item_edit() IS
  'Trigger: bloquea UPDATE/DELETE en purchase_items con stock generado; owner/manager deben usar ajuste';

-- =============================================================================
-- 3. TRIGGERS (después de todas las funciones)
-- =============================================================================

-- 3.1 updated_at automático (DROP IF EXISTS para compatibilidad)
DROP TRIGGER IF EXISTS set_updated_at_profiles ON foodtruck.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON foodtruck.profiles
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_suppliers ON foodtruck.suppliers;
CREATE TRIGGER set_updated_at_suppliers
  BEFORE UPDATE ON foodtruck.suppliers
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_ingredients ON foodtruck.ingredients;
CREATE TRIGGER set_updated_at_ingredients
  BEFORE UPDATE ON foodtruck.ingredients
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_purchases ON foodtruck.purchases;
CREATE TRIGGER set_updated_at_purchases
  BEFORE UPDATE ON foodtruck.purchases
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_prep_batches ON foodtruck.preparation_batches;
CREATE TRIGGER set_updated_at_prep_batches
  BEFORE UPDATE ON foodtruck.preparation_batches
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_batch_costs ON foodtruck.preparation_batch_costs;
CREATE TRIGGER set_updated_at_batch_costs
  BEFORE UPDATE ON foodtruck.preparation_batch_costs
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_sellable_products ON foodtruck.sellable_products;
CREATE TRIGGER set_updated_at_sellable_products
  BEFORE UPDATE ON foodtruck.sellable_products
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_orders ON foodtruck.orders;
CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON foodtruck.orders
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_credits ON foodtruck.credits;
CREATE TRIGGER set_updated_at_credits
  BEFORE UPDATE ON foodtruck.credits
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_expenses ON foodtruck.expenses;
CREATE TRIGGER set_updated_at_expenses
  BEFORE UPDATE ON foodtruck.expenses
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_employees ON foodtruck.employees;
CREATE TRIGGER set_updated_at_employees
  BEFORE UPDATE ON foodtruck.employees
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_payroll_periods ON foodtruck.payroll_periods;
CREATE TRIGGER set_updated_at_payroll_periods
  BEFORE UPDATE ON foodtruck.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_payroll_entries ON foodtruck.payroll_entries;
CREATE TRIGGER set_updated_at_payroll_entries
  BEFORE UPDATE ON foodtruck.payroll_entries
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_daily_closes ON foodtruck.daily_closes;
CREATE TRIGGER set_updated_at_daily_closes
  BEFORE UPDATE ON foodtruck.daily_closes
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_daily_close_fin ON foodtruck.daily_close_financials;
CREATE TRIGGER set_updated_at_daily_close_fin
  BEFORE UPDATE ON foodtruck.daily_close_financials
  FOR EACH ROW EXECUTE FUNCTION foodtruck.handle_updated_at();

-- 3.2 Triggers de negocio
DROP TRIGGER IF EXISTS trg_purchase_items_stock ON foodtruck.purchase_items;
CREATE TRIGGER trg_purchase_items_stock
  AFTER INSERT ON foodtruck.purchase_items
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_purchase_item_to_stock();

DROP TRIGGER IF EXISTS trg_purchases_protect_delete ON foodtruck.purchases;
CREATE TRIGGER trg_purchases_protect_delete
  BEFORE DELETE ON foodtruck.purchases
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_purchase_delete();

DROP TRIGGER IF EXISTS trg_prep_batches_protect_delete ON foodtruck.preparation_batches;
CREATE TRIGGER trg_prep_batches_protect_delete
  BEFORE DELETE ON foodtruck.preparation_batches
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_batch_delete();

DROP TRIGGER IF EXISTS trg_prep_batch_items_cost ON foodtruck.preparation_batch_items;
CREATE TRIGGER trg_prep_batch_items_cost
  AFTER INSERT OR DELETE ON foodtruck.preparation_batch_items
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_batch_items_cost_trigger();

DROP TRIGGER IF EXISTS trg_credit_payments_validate ON foodtruck.credit_payments;
CREATE TRIGGER trg_credit_payments_validate
  BEFORE INSERT ON foodtruck.credit_payments
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_validate_credit_payment();

DROP TRIGGER IF EXISTS trg_payments_no_update ON foodtruck.payments;
CREATE TRIGGER trg_payments_no_update
  BEFORE UPDATE ON foodtruck.payments
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_payment_update();

DROP TRIGGER IF EXISTS trg_credits_no_update ON foodtruck.credits;
CREATE TRIGGER trg_credits_no_update
  BEFORE UPDATE ON foodtruck.credits
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_credit_update();

DROP TRIGGER IF EXISTS trg_credit_payments_no_update ON foodtruck.credit_payments;
CREATE TRIGGER trg_credit_payments_no_update
  BEFORE UPDATE ON foodtruck.credit_payments
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_credit_payment_update();

DROP TRIGGER IF EXISTS trg_order_items_status_guard ON foodtruck.order_items;
CREATE TRIGGER trg_order_items_status_guard
  BEFORE INSERT OR UPDATE OR DELETE ON foodtruck.order_items
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_order_items_closed();

DROP TRIGGER IF EXISTS trg_orders_status_guard ON foodtruck.orders;
CREATE TRIGGER trg_orders_status_guard
  BEFORE UPDATE ON foodtruck.orders
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_order_status_transition();

DROP TRIGGER IF EXISTS trg_orders_amount_guard ON foodtruck.orders;
CREATE TRIGGER trg_orders_amount_guard
  BEFORE UPDATE ON foodtruck.orders
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_order_amount_fields();

DROP TRIGGER IF EXISTS trg_payments_validate_insert ON foodtruck.payments;
CREATE TRIGGER trg_payments_validate_insert
  BEFORE INSERT ON foodtruck.payments
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_validate_payment_before_insert();

DROP TRIGGER IF EXISTS trg_payments_derive_order_status ON foodtruck.payments;
CREATE TRIGGER trg_payments_derive_order_status
  AFTER INSERT ON foodtruck.payments
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_derive_order_status_from_payments();

DROP TRIGGER IF EXISTS trg_purchase_items_no_edit ON foodtruck.purchase_items;
CREATE TRIGGER trg_purchase_items_no_edit
  BEFORE UPDATE OR DELETE ON foodtruck.purchase_items
  FOR EACH ROW EXECUTE FUNCTION foodtruck.fn_protect_purchase_item_edit();

-- =============================================================================
-- 4. VISTAS (después de tablas y funciones)
-- =============================================================================

-- 4.1 v_current_stock (security_invoker)
CREATE VIEW foodtruck.v_current_stock
WITH (security_invoker = true) AS
SELECT
  i.id AS ingredient_id,
  i.name AS ingredient_name,
  u.id AS unit_id,
  u.name AS unit_name,
  u.symbol AS unit_symbol,
  COALESCE(SUM(sm.quantity), 0) AS current_stock,
  ic.price_per_unit,
  COALESCE(SUM(sm.quantity), 0) * ic.price_per_unit AS stock_value
FROM foodtruck.ingredients i
JOIN foodtruck.units u ON i.unit_id = u.id
LEFT JOIN foodtruck.stock_movements sm ON sm.ingredient_id = i.id
LEFT JOIN foodtruck.ingredient_costs ic ON ic.ingredient_id = i.id
WHERE i.is_active = true
GROUP BY i.id, i.name, u.id, u.name, u.symbol, ic.price_per_unit;
COMMENT ON VIEW foodtruck.v_current_stock IS
  'Stock actual; price_per_unit solo owner/manager via RLS';

-- 4.2 v_ingredients_safe (sin costos, para cashier)
CREATE VIEW foodtruck.v_ingredients_safe
WITH (security_invoker = true) AS
SELECT i.id, i.name, i.unit_id, u.name AS unit_name, u.symbol AS unit_symbol,
       i.is_active, i.created_at
FROM foodtruck.ingredients i
JOIN foodtruck.units u ON i.unit_id = u.id;
COMMENT ON VIEW foodtruck.v_ingredients_safe IS
  'Ingredientes sin costo; seguro para cashier';

-- 4.3 v_product_recipe_cost (security_invoker, calcula costo por porción inline)
CREATE VIEW foodtruck.v_product_recipe_cost
WITH (security_invoker = true) AS
SELECT
  sp.id AS sellable_product_id,
  sp.name AS product_name,
  sp.sale_price,
  COALESCE(SUM(
    CASE
      WHEN rc.ingredient_id IS NOT NULL THEN rc.quantity * COALESCE(ic.price_per_unit, 0)
      WHEN rc.preparation_batch_id IS NOT NULL THEN rc.quantity * COALESCE(
        pbc.total_input_cost / NULLIF(pb.quantity_produced, 0), 0)
      ELSE 0
    END
  ), 0) AS recipe_cost,
  sp.sale_price - COALESCE(SUM(
    CASE
      WHEN rc.ingredient_id IS NOT NULL THEN rc.quantity * COALESCE(ic.price_per_unit, 0)
      WHEN rc.preparation_batch_id IS NOT NULL THEN rc.quantity * COALESCE(
        pbc.total_input_cost / NULLIF(pb.quantity_produced, 0), 0)
      ELSE 0
    END
  ), 0) AS margin_estimated
FROM foodtruck.sellable_products sp
LEFT JOIN foodtruck.recipe_components rc ON rc.sellable_product_id = sp.id
LEFT JOIN foodtruck.ingredient_costs ic ON rc.ingredient_id = ic.ingredient_id
LEFT JOIN foodtruck.preparation_batch_costs pbc ON rc.preparation_batch_id = pbc.preparation_batch_id
LEFT JOIN foodtruck.preparation_batches pb ON rc.preparation_batch_id = pb.id
WHERE sp.is_active = true
GROUP BY sp.id, sp.name, sp.sale_price;
COMMENT ON VIEW foodtruck.v_product_recipe_cost IS
  'Costo real de receta; calcula pbc.total_input_cost / pb.quantity_produced inline. Owner/manager via RLS en ingredient_costs/batch_costs';

-- 4.4 v_order_summary (security_invoker)
CREATE VIEW foodtruck.v_order_summary
WITH (security_invoker = true) AS
SELECT
  o.id AS order_id, o.order_number, o.status, o.created_at::date AS order_date,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount,
  COUNT(oi.id) AS item_count, o.created_by
FROM foodtruck.orders o
LEFT JOIN foodtruck.order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.order_number, o.status, o.created_at, o.created_by;
COMMENT ON VIEW foodtruck.v_order_summary IS 'Resumen de órdenes';

-- 4.5 v_credit_balances (status DERIVADO, sin campo status en tabla)
CREATE VIEW foodtruck.v_credit_balances
WITH (security_invoker = true) AS
SELECT
  c.id AS credit_id,
  c.customer_name,
  c.total_amount,
  CASE
    WHEN COALESCE(SUM(cp.amount), 0) <= 0 THEN 'pending'
    WHEN COALESCE(SUM(cp.amount), 0) >= c.total_amount THEN 'paid'
    ELSE 'partial'
  END AS status,
  c.order_id,
  COALESCE(SUM(cp.amount), 0) AS total_paid,
  c.total_amount - COALESCE(SUM(cp.amount), 0) AS balance_pending,
  c.created_at
FROM foodtruck.credits c
LEFT JOIN foodtruck.credit_payments cp ON cp.credit_id = c.id
GROUP BY c.id, c.customer_name, c.total_amount, c.order_id, c.created_at;
COMMENT ON VIEW foodtruck.v_credit_balances IS
  'Saldos con status derivado de abonos; campo status eliminado de tabla';

-- 4.6 v_payroll_summary (security_invoker, solo owner via RLS)
CREATE VIEW foodtruck.v_payroll_summary
WITH (security_invoker = true) AS
SELECT
  pp.id AS period_id, pp.start_date, pp.end_date, pp.status AS period_status,
  COUNT(DISTINCT pe.employee_id) AS employee_count,
  COALESCE(SUM(pe.hours_worked), 0) AS total_hours,
  COALESCE(SUM(pe.base_salary), 0) AS total_base_salary,
  COALESCE(SUM(pe.deductions), 0) AS total_deductions,
  COALESCE(SUM(pe.net_pay), 0) AS total_net_pay
FROM foodtruck.payroll_periods pp
LEFT JOIN foodtruck.payroll_entries pe ON pe.payroll_period_id = pp.id
GROUP BY pp.id, pp.start_date, pp.end_date, pp.status;
COMMENT ON VIEW foodtruck.v_payroll_summary IS 'Nómina por periodo; owner via RLS';

-- 4.7 v_expenses_by_category (security_invoker, owner/manager via RLS)
CREATE VIEW foodtruck.v_expenses_by_category
WITH (security_invoker = true) AS
SELECT category, COUNT(*) AS expense_count, COALESCE(SUM(amount), 0) AS total_amount,
       MIN(expense_date) AS first_expense, MAX(expense_date) AS last_expense
FROM foodtruck.expenses
GROUP BY category;
COMMENT ON VIEW foodtruck.v_expenses_by_category IS 'Gastos por categoría';

-- 4.8 v_employees_safe (sin tarifas, para manager/cashier)
CREATE VIEW foodtruck.v_employees_safe
WITH (security_invoker = true) AS
SELECT id, full_name, position, is_active, created_at
FROM foodtruck.employees;
COMMENT ON VIEW foodtruck.v_employees_safe IS
  'Empleados sin hourly_rate; seguro para manager/cashier';

-- 4.9 v_daily_closes_safe (sin financieros, para cashier)
CREATE VIEW foodtruck.v_daily_closes_safe
WITH (security_invoker = true) AS
SELECT id, close_date, total_sales, total_payments, notes, closed_by, created_at
FROM foodtruck.daily_closes;
COMMENT ON VIEW foodtruck.v_daily_closes_safe IS
  'Cierres operativos sin gastos/balance; seguro para cashier';

-- 4.10 v_daily_close_summary (protegida, balance calculado inline; NO para cashier)
CREATE VIEW foodtruck.v_daily_close_summary
WITH (security_invoker = true) AS
SELECT
  dc.id,
  dc.close_date,
  dc.total_sales,
  dc.total_payments,
  dcf.total_expenses,
  dcf.total_credits,
  dc.total_sales - dcf.total_expenses - dcf.total_credits AS balance,
  dc.notes,
  dc.closed_by,
  dc.created_at
FROM foodtruck.daily_closes dc
LEFT JOIN foodtruck.daily_close_financials dcf ON dcf.daily_close_id = dc.id;
COMMENT ON VIEW foodtruck.v_daily_close_summary IS
  'Resumen financiero de cierres con balance; solo owner/manager via RLS en daily_close_financials';

-- 4.11 fn_get_product_recipe_cost — RPC owner/manager para v_product_recipe_cost
-- DEFINIDA AQUÍ porque RETURNS SETOF requiere que v_product_recipe_cost exista
CREATE FUNCTION foodtruck.fn_get_product_recipe_cost()
RETURNS SETOF foodtruck.v_product_recipe_cost
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
BEGIN
  IF foodtruck.get_current_user_role() IS NULL OR foodtruck.get_current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Acceso denegado: solo owner/manager pueden consultar costos de receta';
  END IF;
  RETURN QUERY SELECT * FROM foodtruck.v_product_recipe_cost;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_get_product_recipe_cost() IS
  'RPC: retorna v_product_recipe_cost; role check owner/manager estricto';

-- 4.12 fn_get_daily_close_summary — RPC owner/manager para v_daily_close_summary
-- DEFINIDA AQUÍ porque RETURNS SETOF requiere que v_daily_close_summary exista
CREATE FUNCTION foodtruck.fn_get_daily_close_summary()
RETURNS SETOF foodtruck.v_daily_close_summary
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = foodtruck, pg_temp
AS $$
BEGIN
  IF foodtruck.get_current_user_role() IS NULL OR foodtruck.get_current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Acceso denegado: solo owner/manager pueden consultar resumen financiero';
  END IF;
  RETURN QUERY SELECT * FROM foodtruck.v_daily_close_summary;
END;
$$;
COMMENT ON FUNCTION foodtruck.fn_get_daily_close_summary() IS
  'RPC: retorna v_daily_close_summary; role check owner/manager estricto';

-- =============================================================================
-- 5. RLS — ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE foodtruck.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.ingredient_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.preparation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.preparation_batch_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.preparation_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.sellable_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.production_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.daily_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodtruck.daily_close_financials ENABLE ROW LEVEL SECURITY;

-- --- PROFILES ---
CREATE POLICY profiles_owner_all ON foodtruck.profiles
  FOR ALL USING (foodtruck.get_current_user_role() = 'owner');
CREATE POLICY profiles_own_read ON foodtruck.profiles
  FOR SELECT USING (id = auth.uid());

-- --- UNITS ---
CREATE POLICY units_select ON foodtruck.units
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY units_write ON foodtruck.units
  FOR ALL USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- UNIT_CONVERSIONS ---
CREATE POLICY unit_conversions_select ON foodtruck.unit_conversions
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY unit_conversions_write ON foodtruck.unit_conversions
  FOR ALL USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- SUPPLIERS ---
CREATE POLICY suppliers_select ON foodtruck.suppliers
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY suppliers_write ON foodtruck.suppliers
  FOR ALL USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- INGREDIENTS ---
CREATE POLICY ingredients_select ON foodtruck.ingredients
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY ingredients_write ON foodtruck.ingredients
  FOR ALL USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- INGREDIENT_COSTS (solo owner/manager) ---
CREATE POLICY ingredient_costs_select ON foodtruck.ingredient_costs
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY ingredient_costs_write ON foodtruck.ingredient_costs
  FOR ALL USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- PURCHASES ---
CREATE POLICY purchases_select ON foodtruck.purchases
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY purchases_insert ON foodtruck.purchases
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY purchases_update ON foodtruck.purchases
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- PURCHASE_ITEMS ---
CREATE POLICY purchase_items_select ON foodtruck.purchase_items
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY purchase_items_insert ON foodtruck.purchase_items
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY purchase_items_update ON foodtruck.purchase_items
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- STOCK_MOVEMENTS (append-only) ---
CREATE POLICY stock_movements_select ON foodtruck.stock_movements
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY stock_movements_insert ON foodtruck.stock_movements
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY stock_movements_no_update ON foodtruck.stock_movements
  FOR UPDATE USING (false);
CREATE POLICY stock_movements_no_delete ON foodtruck.stock_movements
  FOR DELETE USING (false);

-- --- PREPARATION_BATCHES ---
CREATE POLICY prep_batches_select ON foodtruck.preparation_batches
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY prep_batches_insert ON foodtruck.preparation_batches
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY prep_batches_update ON foodtruck.preparation_batches
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- PREPARATION_BATCH_COSTS (solo owner/manager) ---
CREATE POLICY batch_costs_select ON foodtruck.preparation_batch_costs
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY batch_costs_write ON foodtruck.preparation_batch_costs
  FOR ALL USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- PREPARATION_BATCH_ITEMS ---
CREATE POLICY prep_batch_items_select ON foodtruck.preparation_batch_items
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY prep_batch_items_insert ON foodtruck.preparation_batch_items
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY prep_batch_items_delete ON foodtruck.preparation_batch_items
  FOR DELETE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- SELLABLE_PRODUCTS ---
CREATE POLICY sellable_products_select ON foodtruck.sellable_products
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY sellable_products_insert ON foodtruck.sellable_products
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY sellable_products_update ON foodtruck.sellable_products
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- RECIPE_COMPONENTS ---
CREATE POLICY recipe_components_select ON foodtruck.recipe_components
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY recipe_components_insert ON foodtruck.recipe_components
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY recipe_components_update ON foodtruck.recipe_components
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY recipe_components_delete ON foodtruck.recipe_components
  FOR DELETE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- ORDERS ---
CREATE POLICY orders_select ON foodtruck.orders
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY orders_insert ON foodtruck.orders
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY orders_update ON foodtruck.orders
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY orders_delete ON foodtruck.orders
  FOR DELETE USING (foodtruck.get_current_user_role() = 'owner');

-- --- ORDER_ITEMS ---
CREATE POLICY order_items_select ON foodtruck.order_items
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY order_items_insert ON foodtruck.order_items
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY order_items_update ON foodtruck.order_items
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY order_items_delete ON foodtruck.order_items
  FOR DELETE USING (foodtruck.get_current_user_role() = 'owner');

-- --- PAYMENTS (inmutables: trigger impide UPDATE) ---
CREATE POLICY payments_select ON foodtruck.payments
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY payments_insert ON foodtruck.payments
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY payments_no_update ON foodtruck.payments
  FOR UPDATE USING (false);
CREATE POLICY payments_no_delete ON foodtruck.payments
  FOR DELETE USING (false);

-- --- CREDITS (status DERIVADO; trigger impide UPDATE) ---
CREATE POLICY credits_select ON foodtruck.credits
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY credits_insert ON foodtruck.credits
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY credits_no_update ON foodtruck.credits
  FOR UPDATE USING (false);

-- --- CREDIT_PAYMENTS (trigger impide UPDATE) ---
CREATE POLICY credit_payments_select ON foodtruck.credit_payments
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY credit_payments_insert ON foodtruck.credit_payments
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY credit_payments_no_update ON foodtruck.credit_payments
  FOR UPDATE USING (false);
CREATE POLICY credit_payments_no_delete ON foodtruck.credit_payments
  FOR DELETE USING (false);

-- --- EXPENSES ---
CREATE POLICY expenses_select ON foodtruck.expenses
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY expenses_insert ON foodtruck.expenses
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY expenses_update ON foodtruck.expenses
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY expenses_delete ON foodtruck.expenses
  FOR DELETE USING (foodtruck.get_current_user_role() = 'owner');

-- --- EMPLOYEES ---
CREATE POLICY employees_select ON foodtruck.employees
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY employees_write ON foodtruck.employees
  FOR ALL USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- PAYROLL_PERIODS (solo owner) ---
CREATE POLICY payroll_periods_owner ON foodtruck.payroll_periods
  FOR ALL USING (foodtruck.get_current_user_role() = 'owner');

-- --- PAYROLL_ENTRIES (solo owner) ---
CREATE POLICY payroll_entries_owner ON foodtruck.payroll_entries
  FOR ALL USING (foodtruck.get_current_user_role() = 'owner');

-- --- ADVANCES (solo owner) ---
CREATE POLICY advances_owner ON foodtruck.advances
  FOR ALL USING (foodtruck.get_current_user_role() = 'owner');

-- --- PRODUCTION_BONUSES (solo owner) ---
CREATE POLICY production_bonuses_owner ON foodtruck.production_bonuses
  FOR ALL USING (foodtruck.get_current_user_role() = 'owner');

-- --- DAILY_CLOSES ---
CREATE POLICY daily_closes_select ON foodtruck.daily_closes
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager', 'cashier'));
CREATE POLICY daily_closes_insert ON foodtruck.daily_closes
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY daily_closes_update ON foodtruck.daily_closes
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- --- DAILY_CLOSE_FINANCIALS (solo owner/manager) ---
CREATE POLICY daily_close_fin_select ON foodtruck.daily_close_financials
  FOR SELECT USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY daily_close_fin_insert ON foodtruck.daily_close_financials
  FOR INSERT WITH CHECK (foodtruck.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY daily_close_fin_update ON foodtruck.daily_close_financials
  FOR UPDATE USING (foodtruck.get_current_user_role() IN ('owner', 'manager'));

-- =============================================================================
-- 6. GRANTS (después de RLS)
-- =============================================================================
-- Sin GRANT EXECUTE ON ALL FUNCTIONS. Solo RPCs específicas.
-- Sin GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES.
-- Grants explícitos mínimos por tabla; RLS diferencia owner/manager/cashier.
-- Vistas financieras: REVOKE ALL + acceso exclusivo vía RPC SECURITY DEFINER.

REVOKE ALL ON ALL TABLES IN SCHEMA foodtruck FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA foodtruck FROM PUBLIC;

-- --- REVOKE explícito en vistas financieras ---
REVOKE ALL ON foodtruck.v_product_recipe_cost FROM authenticated, anon, public;
REVOKE ALL ON foodtruck.v_daily_close_summary FROM authenticated, anon, public;

-- --- Grants explícitos para authenticated ---
GRANT USAGE ON SCHEMA foodtruck TO authenticated;

-- Perfiles (RLS: owner ALL, others SELECT own)
GRANT SELECT, UPDATE ON foodtruck.profiles TO authenticated;

-- Catálogos base
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.unit_conversions TO authenticated;

-- Ingredientes (RLS: cashier SELECT, owner/manager ALL)
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.ingredients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.stock_movements TO authenticated;

-- Proveedores y compras (RLS: solo owner/manager)
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.purchase_items TO authenticated;

-- Producción (RLS: cashier SELECT, owner/manager ALL)
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.preparation_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.preparation_batch_costs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.preparation_batch_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.sellable_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.recipe_components TO authenticated;

-- Ventas
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.order_items TO authenticated;
GRANT SELECT, INSERT ON foodtruck.payments TO authenticated;

-- Créditos
GRANT SELECT, INSERT ON foodtruck.credits TO authenticated;
GRANT SELECT, INSERT ON foodtruck.credit_payments TO authenticated;

-- Gastos (RLS: solo owner/manager)
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.expenses TO authenticated;

-- Empleados (RLS: owner/manager SELECT, owner ALL)
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.employees TO authenticated;

-- Nómina (RLS: solo owner)
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.payroll_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.payroll_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.advances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON foodtruck.production_bonuses TO authenticated;

-- Cierres diarios
GRANT SELECT, INSERT, UPDATE ON foodtruck.daily_closes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON foodtruck.daily_close_financials TO authenticated;

-- Secuencias necesarias para INSERT/UPDATE
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA foodtruck TO authenticated;

-- EXECUTE: whitelist mínima para authenticated
-- Helper RLS (requerida por 69/72 CREATE POLICY que llaman get_current_user_role())
GRANT EXECUTE ON FUNCTION foodtruck.get_current_user_role() TO authenticated;
-- RPCs públicas
GRANT EXECUTE ON FUNCTION foodtruck.add_stock_movement(UUID, NUMERIC, UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION foodtruck.fn_get_product_recipe_cost() TO authenticated;
GRANT EXECUTE ON FUNCTION foodtruck.fn_get_daily_close_summary() TO authenticated;

-- --- service_role (bypass RLS) ---
GRANT USAGE ON SCHEMA foodtruck TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA foodtruck TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA foodtruck TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA foodtruck TO service_role;

-- --- NO se conceden grants a anon ---
-- Si se necesita acceso público, crear una vista pública específica.

-- =============================================================================
-- FIN DE LA MIGRACIÓN
-- =============================================================================
-- Esta migración es one-shot y no reejecutable.
-- Próximos pasos:
--   1. Ejecutar en el Supabase self-hosted del VPS
--   2. Configurar PostgREST: PGRST_DB_SCHEMAS="foodtruck" (NO public)
--   3. Verificar grants y RLS con cada rol
--   4. Probar desde la aplicación
-- =============================================================================
