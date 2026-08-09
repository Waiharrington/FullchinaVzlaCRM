# Modelo de Base de Datos — FullChinaVzla

## Resumen

Esquema PostgreSQL `fullchinavzla` para Supabase self-hosted que cubre la operación
completa de FullChinaVzla: inventario, producción, ventas, nómina y cierres diarios.

## Requisitos Previos

1. **Supabase self-hosted** funcionando en el VPS
2. **PostgreSQL 15+** requerido (para `security_invoker` en vistas)
3. **PostgREST** configurado para exponer SOLO el esquema `fullchinavzla`
4. **Roles de Supabase** creados: `authenticator`, `anon`, `authenticated`, `service_role`

## Archivos de Migración

| Archivo | Descripción | Ejecución |
|---------|-------------|-----------|
| `supabase/migrations/20260803000000_initial_foodtruck_schema.sql` | Migración inicial completa (nombre histórico: `foodtruck`) | One-shot (NO reejecutable) |
| `supabase/migrations/20260803000001_rollback_foodtruck_schema.sql` | Rollback manual (nombre histórico: `foodtruck`) | **Manual** con guardia de datos + BEGIN/COMMIT |
| `supabase/migrations/20260808005000_secure_pin_login.sql` | PIN bcrypt, rate limiting y cambio autorizado de PIN | Reejecutable |

Estado remoto verificado después de las migraciones del 2026-08-08: 32 tablas,
40 funciones, 34 triggers, 11 vistas y 75 políticas RLS.

El PIN no autentica directamente desde PostgreSQL. `pin-login` lo valida con
`fn_verify_pin_login`, solicita a GoTrue un token magic-link de un solo uso y el
cliente lo canjea por una sesión normal. `pin_credentials` y
`fn_verify_pin_login` solo son accesibles para `service_role`.

> **Nota importante**: Los archivos SQL contienen `foodtruck` cientos de veces (nombres históricos).
> El schema remoto real es `fullchinavzla`. **Nunca ejecutar estos archivos sin aplicar
> sustitución `sed` y revisar a mano** (ver `supabase/migrations/LEEME-ANTES-DE-EJECUTAR.md`).

## Orden de Ejecución (Estricto)

```
1. CREATE SCHEMA IF NOT EXISTS fullchinavzla;
2. Ejecutar 20260803000000_initial_foodtruck_schema.sql
   - Sección 1: Todas las tablas
   - Sección 2: Todas las funciones
   - Sección 3: Todos los triggers
   - Sección 4: Todas las vistas
   - Sección 5: Todas las políticas RLS
   - Sección 6: Todos los grants
3. Configurar PostgREST: PGRST_DB_SCHEMAS="fullchinavzla"
4. Verificar grants y RLS
```

**CRÍTICO:** Ningún trigger puede referenciar una función aún no creada.

## Modelo de Datos

### Diagrama de Dependencias

```
auth.users
    │
    ▼
profiles ─────────────────────────────────────────────────┐
    │                                                      │
    ▼                                                      │
units ◄── unit_conversions                                 │
    │                                                      │
    ▼                                                      │
suppliers                                                  │
    │                                                      │
    ▼                                                      │
ingredients ◄── ingredient_costs (owner/manager)           │
    │                                                      │
    ▼                                                      │
stock_movements ◄── purchase_items ◄── purchases           │
    │                                                      │
    ▼                                                      │
preparation_batch_items ◄── preparation_batches            │
    │                                    │                  │
    │                                    ▼                  │
    │                          preparation_batch_costs     │
    │                          (owner/manager)             │
    ▼                                                      │
recipe_components ◄── sellable_products ◄──────────────────┘
    │
    ▼
order_items ◄── orders
    │              │
    │              ▼
    │          payments (inmutables)
    │
    ▼
orders ◄── credits ◄── credit_payments

expenses (owner/manager)
employees ◄── payroll_periods ◄── payroll_entries (owner)
    │
    ├── advances (owner)
    └── production_bonuses (owner)

daily_closes (operativo) ── daily_close_financials (owner/manager)
```

### Tablas (27 total)

#### Perfiles y Usuarios
- **profiles** — Vincula `auth.users` con roles (`owner`, `manager`, `cashier`)

#### Inventario
- **units** — Unidades de medida
- **unit_conversions** — Conversiones directas (NO cadenas)
- **ingredients** — Materias primas con unidad base (sin costo)
- **ingredient_costs** — Costos por unidad base (owner/manager)
- **stock_movements** — Movimientos append-only

#### Compras
- **suppliers** — Proveedores
- **purchases** — Compras
- **purchase_items** — Detalle (trigger auto-genera stock)

#### Producción
- **preparation_batches** — Lotes (solo datos operativos)
- **preparation_batch_costs** — Costos de lotes (owner/manager); costo/porción se calcula en v_product_recipe_cost
- **preparation_batch_items** — Ingredientes consumidos
- **sellable_products** — Productos vendibles
- **recipe_components** — Componentes (ingredientes O porciones)

#### Ventas
- **orders** — Órdenes (order_number UNIQUE)
- **order_items** — Detalle
- **payments** — Pagos (inmutables: solo INSERT)

#### Créditos
- **credits** — Créditos (status DERIVADO en vista)
- **credit_payments** — Abonos (trigger previene sobreabonos)

#### Gastos
- **expenses** — Gastos operativos (owner/manager)

#### Nómina
- **employees** — Empleados
- **payroll_periods** — Periodos (solo owner)
- **payroll_entries** — Liquidaciones (solo owner)
- **advances** — Adelantos (solo owner)
- **production_bonuses** — Bonos (solo owner)

#### Cierres
- **daily_closes** — Operativo (todos los roles)
- **daily_close_financials** — Financiero (owner/manager); balance se calcula en v_daily_close_summary
- **v_daily_close_summary** — Vista protegida con balance = total_sales - total_expenses; no expuesta a cashier

### Vistas (11, todas con security_invoker)

| Vista | Descripción | Roles visibles |
|-------|-------------|----------------|
| `v_current_stock` | Stock con costo | Todos (costo solo owner/manager) |
| `v_ingredients_safe` | Sin costo | Todos |
| `v_product_recipe_cost` | Costo real receta (cálculo inline) | Owner/manager |
| `v_order_summary` | Resumen órdenes con pagos | Todos |
| `v_credit_balances` | Status DERIVADO | Todos |
| `v_payroll_summary` | Nómina por periodo | Owner |
| `v_expenses_by_category` | Gastos categoría | Owner/manager |
| `v_employees_safe` | Sin tarifas | Manager/cashier |
| `v_daily_closes_safe` | Sin financieros | Cashier |
| `v_daily_close_summary` | Resumen financiero con balance | Owner/manager |
| `v_order_items_with_payments` | Order items con información de pagos | Todos |

### Funciones (30)

| Función | Propósito | SECURITY |
|---------|-----------|----------|
| `get_current_user_role()` | Rol del usuario | DEFINER |
| `handle_updated_at()` | Trigger updated_at | DEFINER |
| `normalize_to_base_unit()` | Conversión directa | DEFINER |
| `add_stock_movement()` | RPC manual (rol validado) | DEFINER |
| `update_batch_cost()` | Recalcular costo lote | DEFINER |
| `fn_purchase_item_to_stock()` | Trigger compra→stock | DEFINER |
| `fn_protect_purchase_delete()` | Impide borrar compra | DEFINER |
| `fn_protect_batch_delete()` | Impide borrar lote | DEFINER |
| `fn_batch_items_cost_trigger()` | Trigger items→costo (normaliza a unidad base) | DEFINER |
| `fn_validate_credit_payment()` | FOR UPDATE + sobreabono | DEFINER |
| `fn_protect_payment_update()` | Impide UPDATE payments | DEFINER |
| `fn_protect_credit_update()` | Impide UPDATE credits | DEFINER |
| `fn_protect_credit_payment_update()` | Impide UPDATE credit_payments | DEFINER |
| `fn_get_product_recipe_cost()` | RPC owner/manager → v_product_recipe_cost | DEFINER |
| `fn_get_daily_close_summary()` | RPC owner/manager → v_daily_close_summary | DEFINER |
| `fn_protect_order_items_closed()` | Bloquea INSERT/UPDATE/DELETE items en órdenes cerradas; inmutables | DEFINER |
| `fn_validate_payment_before_insert()` | BEFORE INSERT payments: validación sobrepago concurrente | DEFINER |
| `fn_derive_order_status_from_payments()` | AFTER INSERT payments: deriva estado paid (igualdad exacta) | DEFINER |
| `fn_protect_order_status_transition()` | BEFORE UPDATE orders: controla transiciones por rol | DEFINER |
| `fn_protect_order_amount_fields()` | BEFORE UPDATE orders: bloquea modificación de órdenes paid/cancelled para no-owner/manager; owner/manager pueden editar campos de order pero no reabrir paid ni editar items | DEFINER |
| `fn_protect_purchase_item_edit()` | Bloquea UPDATE/DELETE purchase_items con stock generado | DEFINER |
| `fn_record_order_payments()` | RPC: registra pagos para una orden existente | DEFINER |
| `fn_checkout_order()` | RPC: crea orden + items + pagos en transacción atómica | DEFINER |

### Triggers (33)

**updated_at (15):** profiles, suppliers, ingredients, purchases, preparation_batches, preparation_batch_costs, sellable_products, orders, credits, expenses, employees, payroll_periods, payroll_entries, daily_closes, daily_close_financials

**Negocio (18):** trg_purchase_items_stock, trg_purchases_protect_delete, trg_prep_batches_protect_delete, trg_prep_batch_items_cost, trg_credit_payments_validate, trg_payments_no_update, trg_credits_no_update, trg_credit_payments_no_update, trg_order_items_status_guard, trg_orders_status_guard, trg_orders_amount_guard, trg_payments_validate_insert, trg_payments_derive_order_status, trg_purchase_items_no_edit, trg_payments_record_order, trg_checkout_order_items, trg_checkout_order_payments

## Decisiones de Diseño (post gate v2)

### Orden Estricto
- Todas las tablas → Todas las funciones → Todos los triggers → Todas las vistas → RLS → Grants
- Ningún trigger referencia función no creada

### Separación de Costos
- **preparation_batch_costs** separado de preparation_batches (cashier no ve costos)
- **daily_close_financials** separado de daily_closes (cashier no ve gastos/balance)
- **ingredient_costs** separado de ingredients (cashier no ve price_per_unit)
- **v_product_recipe_cost** y **v_daily_close_summary**: REVOKE ALL para authenticated; acceso vía RPC SECURITY DEFINER owner/manager

### Cálculos Derivados en Vistas
- **v_product_recipe_cost**: calcula costo por porción inline como `pbc.total_input_cost / NULLIF(pb.quantity_produced, 0)` — JOIN preparation_batches + preparation_batch_costs. Acceso vía `fn_get_product_recipe_cost()` (RPC SECURITY DEFINER, role check owner/manager)
- **v_daily_close_summary**: calcula balance como `total_sales - total_expenses - total_credits` — JOIN daily_closes + daily_close_financials. Acceso vía `fn_get_daily_close_summary()` (RPC SECURITY DEFINER, role check owner/manager)

### Credits Status Derivado
- `credits` NO tiene campo `status` (eliminado)
- `v_credit_balances` calcula status: pending/partial/paid
- `fn_update_credit_status` ELIMINADA (no existe)

### Acceso a Vistas Financieras por RPC
- `v_product_recipe_cost` y `v_daily_close_summary` son REVOKE ALL para authenticated/anon/public
- Acceso exclusivo vía RPC SECURITY DEFINER con search_path fijo:
  - `fn_get_product_recipe_cost()` → RETURNS SETOF v_product_recipe_cost → role check owner/manager
  - `fn_get_daily_close_summary()` → RETURNS SETOF v_daily_close_summary → role check owner/manager
- Cashier NO puede acceder a costos de receta, gastos, balance ni cierre financiero
- El role check usa `get_current_user_role()` que consulta profiles (no JWT role)

### Append-Only
- `stock_movements`: UPDATE/DELETE denegados via RLS
- Correcciones con movimientos `adjustment`

### Protección de Borrado
- `purchases`: BEFORE DELETE trigger verifica stock
- `preparation_batches`: BEFORE DELETE trigger verifica stock
- `purchase_items`: ON DELETE RESTRICT
- `preparation_batch_items`: ON DELETE RESTRICT

### Inmutabilidad
- `payments`: trigger impide UPDATE
- `credits`: trigger impide UPDATE
- `credit_payments`: trigger impide UPDATE

### Protección de Órdenes por Estado
- `order_items`: BEFORE INSERT/UPDATE/DELETE trigger verifica estado de la orden padre
- Órdenes `open`: siempre permiten crear/editar/carrito
- Órdenes `confirmed/paid/cancelled`: items inmutables para todos los roles (owner/manager incluidos); correcciones vía cancelación o nueva orden
- `orders`: BEFORE UPDATE trigger controla transiciones:
  - `open/confirmed/preparing/ready → paid`: permitido si total_items > 0 y la suma de pagos es exactamente igual al total
  - `paid → otro`: bloqueado para todos (integridad de pagos)
  - owner/manager: otras correcciones excepto reabrir paid
  - cashier: solo `open→confirmed`, `open→cancelled`, y transición validada a paid

### Pagos con Concurrencia
- `payments`: BEFORE INSERT trigger bloquea fila de orden `FOR UPDATE`
- Valida `amount > 0`, orden existente y no cancelada
- Previene sobrepago: `SUM(pagos) + NEW.amount <= total_orden`
- AFTER INSERT deriva estado `paid` cuando `total_paid = total_amount`
- Cálculo de total via `order_items` (no campo stored en `orders`)

### Protección de purchase_items
- BEFORE UPDATE/DELETE trigger verifica si ya existe `stock_movements` con `reference_type = 'purchase_item'`
- Si existe stock: owner/manager deben usar movimiento de ajuste documentado
- Otros roles: bloqueados completamente

### Rollback Guardia Dinámica
- Recorre `pg_catalog.pg_tables WHERE schemaname = 'fullchinavzla'` dinámicamente
- Verifica TODAS las tablas, no solo una lista parcial
- Override deliberado: `SET foodtruck.allow_rollback_with_data = 'true'` (en la misma sesión, antes de ejecutar el archivo; solo manual con backup y autorización)

### Concurrencia
- `fn_validate_credit_payment`: FOR UPDATE lock en crédito antes de sumar

### Conversiones
- Solo identidad o directa (NO cadenas)
- Error claro si no existe conversión directa
- `unit_conversions`: CHECK from_unit_id <> to_unit_id

### Separación de Roles en Triggers
- Triggers internos insertan directamente en stock_movements
- `add_stock_movement()` es para uso RPC/manual con validación de rol
- Triggers no dependen de JWT role

### Grants
- Sin `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES` para `authenticated`
- Grants explícitos mínimos por tabla: solo las tablas que cada rol necesita según RLS
- `v_product_recipe_cost` y `v_daily_close_summary`: REVOKE ALL para authenticated/anon/public
- Acceso a vistas financieras exclusivamente vía RPC SECURITY DEFINER:
  - `fn_get_product_recipe_cost()` — role check owner/manager, RETURNS SETOF v_product_recipe_cost
  - `fn_get_daily_close_summary()` — role check owner/manager, RETURNS SETOF v_daily_close_summary
- `authenticated`: GRANT EXECUTE a 4 funciones (whitelist):
  - `get_current_user_role()` — helper central requerido por las políticas RLS
  - `add_stock_movement()` — RPC manual
  - `fn_get_product_recipe_cost()` — RPC owner/manager
  - `fn_get_daily_close_summary()` — RPC owner/manager
- `service_role`: GRANT EXECUTE ON ALL FUNCTIONS (bypass RLS)
- Sin grants a `anon`

## Configuración de PostgREST

### CRÍTICO: Solo fullchinavzla

```toml
# supabase/config.toml
[db]
schemas = ["fullchinavzla"]
db_schemas = "fullchinavzla"
```

```yaml
# docker-compose
environment:
  PGRST_DB_SCHEMAS: "fullchinavzla"
```

### Verificación

```bash
# Debe listar tablas de fullchinavzla
curl http://localhost:3000/rest/v1/ | jq '.[].id'

# NO debe haber tablas de public
curl http://localhost:3000/rest/v1/ | jq '.[].id | select(startswith("public"))'
```

## Matriz de Permisos por Rol

| Tabla | Owner | Manager | Cashier |
|-------|-------|---------|---------|
| profiles | ALL | SELECT (own) | SELECT (own) |
| units | ALL | ALL | SELECT |
| unit_conversions | ALL | ALL | SELECT |
| suppliers | ALL | ALL | - |
| ingredients | ALL | ALL | SELECT |
| ingredient_costs | ALL | ALL | - |
| purchases | INSERT/UPDATE | INSERT/UPDATE | - |
| purchase_items | INSERT/UPDATE | INSERT/UPDATE | - |
| stock_movements | INSERT | INSERT | SELECT |
| preparation_batches | INSERT/UPDATE | INSERT/UPDATE | SELECT |
| preparation_batch_costs | ALL | ALL | - |
| preparation_batch_items | INSERT/DELETE | INSERT/DELETE | SELECT |
| sellable_products | INSERT/UPDATE | INSERT/UPDATE | SELECT |
| recipe_components | ALL | ALL | SELECT |
| orders | ALL | ALL | SELECT/INSERT/UPDATE |
| order_items | ALL | ALL | SELECT/INSERT/UPDATE |
| payments | INSERT | INSERT | INSERT |
| credits | INSERT | INSERT | INSERT |
| credit_payments | INSERT | INSERT | INSERT |
| expenses | ALL | ALL | - |
| employees | ALL | ALL | - |
| payroll_periods | ALL | - | - |
| payroll_entries | ALL | - | - |
| advances | ALL | - | - |
| production_bonuses | ALL | - | - |
| daily_closes | INSERT/UPDATE | INSERT/UPDATE | SELECT |
| daily_close_financials | ALL | ALL | - |

## Checklist Dry-Run

### Antes de Ejecutar

- [ ] **Backup completo**: `pg_dump -Fc supabase > backup_$(date +%Y%m%d).dump`
- [ ] **PostgreSQL 15+**: `SELECT version();`
- [ ] **Esquema fullchinavzla no existe** (o está vacío)
- [ ] **Revisar SQL** en entorno de prueba

### Después de Ejecutar

- [ ] **Tablas**: `\dt fullchinavzla.*` (30 tablas)
- [ ] **RLS**: `\d+ fullchinavzla.profiles` (RLS enabled)
- [ ] **Políticas**: `\dp fullchinavzla.*` (75 políticas)
- [ ] **Vistas**: `\dv fullchinavzla.*` (11 vistas)
- [ ] **Funciones**: `\df fullchinavzla.*` (38 funciones)
- [ ] **Triggers**: `\dT fullchinavzla.*` (34 triggers)
- [ ] **RPCs**: `\df fullchinavzla.fn_get_*` (2 RPCs financieras)
- [ ] **Probar por rol**:
  - [ ] Owner: acceso total
  - [ ] Manager: sin profiles, payroll, costs
  - [ ] Cashier: sin costs, expenses, payroll, daily_close_financials
- [ ] **stock_movements append-only**: intentar UPDATE/DELETE (debe fallar)
- [ ] **Payments inmutables**: intentar UPDATE (debe fallar)
- [ ] **Sobreabonos**: abonar más del total (debe fallar)

### Auditoría Estática

| Métrica | Migración inicial | Estado remoto actual (post migraciones adicionales) |
|---------|-----------|----------|
| Tablas | 27 | 27 |
| Funciones | 21 | 30 |
| Vistas | 10 | 11 |
| Triggers | 29 | 33 |
| Políticas RLS | 72 | 72 |
| RLS habilitado | 27 | 27 |
| security_invoker | 10 | 11 |
| SECURITY DEFINER | 21 | 30 |
| GRANT EXECUTE whitelist (authenticated) | 4 | 4 |
| RPCs owner/manager | 2 | 2 |
| fn_update_credit_status | 0 (eliminada) | 0 |
| Guardia datos rollback | - | SÍ (dinámica pg_catalog/pg_tables) |
| BEGIN/COMMIT rollback | - | 1/1 |
| search_path = fullchinavzla, pg_temp | 21 | - |
| NULL role bypass guard | 3 | - |

## Comandos de Verificación

```sql
-- Tablas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'fullchinavzla' AND table_type = 'BASE TABLE';

-- Políticas RLS
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies WHERE schemaname = 'fullchinavzla';

-- RLS habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'fullchinavzla';

-- Funciones y security_type
SELECT routine_name, security_type
FROM information_schema.routines WHERE routine_schema = 'fullchinavzla';

-- Vistas con security_invoker
SELECT table_name FROM information_schema.views WHERE table_schema = 'fullchinavzla';

-- Índices
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'fullchinavzla';

-- Verificar que cashier no ve ingredient_costs
SELECT tablename FROM pg_policies
WHERE schemaname = 'fullchinavzla' AND tablename = 'ingredient_costs'
AND 'cashier' = ANY(roles);

-- Verificar que no existe fn_update_credit_status
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'fullchinavzla' AND routine_name = 'fn_update_credit_status';
-- Debe retornar vacío

-- Verificar GRANT EXECUTE whitelist para authenticated (4 funciones)
SELECT grantee, routine_name, privilege_type
FROM information_schema.role_routines
WHERE routine_schema = 'fullchinavzla' AND grantee = 'authenticated';
-- Debe mostrar SOLO: get_current_user_role, add_stock_movement, fn_get_product_recipe_cost, fn_get_daily_close_summary

-- Verificar REVOKE en vistas financieras
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'fullchinavzla'
  AND table_name IN ('v_product_recipe_cost', 'v_daily_close_summary')
  AND grantee = 'authenticated';
-- Debe retornar vacío (REVOKE efectivo)

-- Verificar que no hay GRANT global ON ALL TABLES
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'fullchinavzla'
  AND grantee = 'authenticated'
  AND table_name LIKE 'v_%';
-- Debe retornar vacío (sin grants directos a vistas para authenticated)
```

## Riesgos Residuales

1. **PG15+ requerido** — `security_invoker` no existe en PG14
2. **PostgREST solo fullchinavzla** — Si expone public, fugas de datos
3. **Payments inmutables** — No se pueden corregir pagos históricos
4. **stock_movements append-only** — Correcciones solo vía adjustment
5. **No hay migración de datos** — Si hay datos existentes, migración adicional
6. **Cálculos en vistas** — `v_product_recipe_cost` calcula costo/porción inline (`pbc.total_input_cost / NULLIF(pb.quantity_produced, 0)`); `v_daily_close_summary` calcula balance (`total_sales - total_expenses`). Verificar performance en producción.

## Rollback

```bash
# Override si hay datos (deliberado, en la misma sesión ANTES del archivo):
psql -c "SET fullchinavzla.allow_rollback_with_data = 'true'; \
  \i 20260803000001_rollback_foodtruck_schema.sql"

# Sin datos (normal):
psql -f 20260803000001_rollback_foodtruck_schema.sql
```

**El rollback usa BEGIN/COMMIT. Si CUALQUIER sentencia falla, se revierte todo.**
