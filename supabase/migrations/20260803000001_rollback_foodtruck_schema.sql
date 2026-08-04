-- =============================================================================
-- ROLLBACK: Migración inicial foodtruck (MANUAL)
-- =============================================================================
-- ⚠️  IMPORTANTE: Este archivo es SOLO PARA USO MANUAL. NO se ejecuta
--     automáticamente. Debe ser revisado y ejecutado por un humano.
--
-- REQUISITOS:
--   1. Conexión directa a PostgreSQL del VPS (NO vía PostgREST/Supabase API)
--   2. Backup completo creado antes de ejecutar
--   3. Confirmación explícita del owner del proyecto
--
-- GUARDIA DE DATOS:
--   ANTES de cualquier DROP, recorre dinámicamente TODAS las tablas del schema
--   foodtruck (pg_catalog/pg_tables) y aborta si cualquiera contiene al menos
--   una fila. No usa lista parcial.
--   Para saltar la guardia (override deliberado), ejecutar ANTES:
--     SET foodtruck.allow_rollback_with_data = 'true';
--   Esto es un override documentado, NO es comentar SQL.
--
-- COMPORTAMIENTO:
--   1. Guardia de datos dinámica (aborta si hay datos sin override)
--   2. BEGIN
--   3. Drops en orden inverso
--   4. COMMIT
--   5. Verificación final
-- =============================================================================

-- =============================================================================
-- BLOQUE 0: GUARDIA DE DATOS (ANTES de cualquier DROP)
-- =============================================================================
-- Verifica si hay datos en tablas principales. Si las hay, aborta.
-- Override: SET foodtruck.allow_rollback_with_data = 'true';

DO $$
DECLARE
  v_override TEXT;
  v_table_name TEXT;
  v_has_data BOOLEAN := false;
BEGIN
  -- Verificar override
  BEGIN
    v_override := current_setting('foodtruck.allow_rollback_with_data');
  EXCEPTION WHEN OTHERS THEN
    v_override := 'false';
  END;

  IF v_override = 'true' THEN
    RAISE NOTICE 'GUARDIA: Override activo; se permite rollback con datos';
    RETURN;
  END IF;

  -- Recorrer dinámicamente TODAS las tablas del schema foodtruck
  FOR v_table_name IN
    SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'foodtruck'
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM foodtruck.%I LIMIT 1)', v_table_name)
    INTO v_has_data;

    IF v_has_data THEN
      RAISE EXCEPTION 'GUARDIA: La tabla % tiene datos. '
        'Use SET foodtruck.allow_rollback_with_data = ''true'' para forzar.',
        v_table_name;
    END IF;
  END LOOP;

  IF NOT v_has_data THEN
    RAISE NOTICE 'GUARDIA: OK - No se encontraron datos en ninguna tabla del schema foodtruck';
  END IF;
END $$;

-- =============================================================================
-- BLOQUE 1: BEGIN
-- =============================================================================

BEGIN;

-- =============================================================================
-- BLOQUE 2: REVOCAR GRANTS
-- =============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA foodtruck FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA foodtruck FROM service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA foodtruck FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA foodtruck FROM service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA foodtruck FROM authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA foodtruck FROM service_role;
REVOKE USAGE ON SCHEMA foodtruck FROM authenticated;
REVOKE USAGE ON SCHEMA foodtruck FROM service_role;

-- =============================================================================
-- BLOQUE 3: ELIMINAR POLÍTICAS RLS
-- =============================================================================

-- daily_close_financials
DROP POLICY IF EXISTS daily_close_fin_update ON foodtruck.daily_close_financials;
DROP POLICY IF EXISTS daily_close_fin_insert ON foodtruck.daily_close_financials;
DROP POLICY IF EXISTS daily_close_fin_select ON foodtruck.daily_close_financials;

-- daily_closes
DROP POLICY IF EXISTS daily_closes_update ON foodtruck.daily_closes;
DROP POLICY IF EXISTS daily_closes_insert ON foodtruck.daily_closes;
DROP POLICY IF EXISTS daily_closes_select ON foodtruck.daily_closes;

-- production_bonuses
DROP POLICY IF EXISTS production_bonuses_owner ON foodtruck.production_bonuses;

-- advances
DROP POLICY IF EXISTS advances_owner ON foodtruck.advances;

-- payroll_entries
DROP POLICY IF EXISTS payroll_entries_owner ON foodtruck.payroll_entries;

-- payroll_periods
DROP POLICY IF EXISTS payroll_periods_owner ON foodtruck.payroll_periods;

-- employees
DROP POLICY IF EXISTS employees_write ON foodtruck.employees;
DROP POLICY IF EXISTS employees_select ON foodtruck.employees;

-- expenses
DROP POLICY IF EXISTS expenses_delete ON foodtruck.expenses;
DROP POLICY IF EXISTS expenses_update ON foodtruck.expenses;
DROP POLICY IF EXISTS expenses_insert ON foodtruck.expenses;
DROP POLICY IF EXISTS expenses_select ON foodtruck.expenses;

-- credit_payments
DROP POLICY IF EXISTS credit_payments_no_delete ON foodtruck.credit_payments;
DROP POLICY IF EXISTS credit_payments_no_update ON foodtruck.credit_payments;
DROP POLICY IF EXISTS credit_payments_insert ON foodtruck.credit_payments;
DROP POLICY IF EXISTS credit_payments_select ON foodtruck.credit_payments;

-- credits
DROP POLICY IF EXISTS credits_no_update ON foodtruck.credits;
DROP POLICY IF EXISTS credits_insert ON foodtruck.credits;
DROP POLICY IF EXISTS credits_select ON foodtruck.credits;

-- payments
DROP POLICY IF EXISTS payments_no_delete ON foodtruck.payments;
DROP POLICY IF EXISTS payments_no_update ON foodtruck.payments;
DROP POLICY IF EXISTS payments_insert ON foodtruck.payments;
DROP POLICY IF EXISTS payments_select ON foodtruck.payments;

-- order_items
DROP POLICY IF EXISTS order_items_delete ON foodtruck.order_items;
DROP POLICY IF EXISTS order_items_update ON foodtruck.order_items;
DROP POLICY IF EXISTS order_items_insert ON foodtruck.order_items;
DROP POLICY IF EXISTS order_items_select ON foodtruck.order_items;

-- orders
DROP POLICY IF EXISTS orders_delete ON foodtruck.orders;
DROP POLICY IF EXISTS orders_update ON foodtruck.orders;
DROP POLICY IF EXISTS orders_insert ON foodtruck.orders;
DROP POLICY IF EXISTS orders_select ON foodtruck.orders;

-- recipe_components
DROP POLICY IF EXISTS recipe_components_delete ON foodtruck.recipe_components;
DROP POLICY IF EXISTS recipe_components_update ON foodtruck.recipe_components;
DROP POLICY IF EXISTS recipe_components_insert ON foodtruck.recipe_components;
DROP POLICY IF EXISTS recipe_components_select ON foodtruck.recipe_components;

-- sellable_products
DROP POLICY IF EXISTS sellable_products_update ON foodtruck.sellable_products;
DROP POLICY IF EXISTS sellable_products_insert ON foodtruck.sellable_products;
DROP POLICY IF EXISTS sellable_products_select ON foodtruck.sellable_products;

-- preparation_batch_costs
DROP POLICY IF EXISTS batch_costs_write ON foodtruck.preparation_batch_costs;
DROP POLICY IF EXISTS batch_costs_select ON foodtruck.preparation_batch_costs;

-- preparation_batch_items
DROP POLICY IF EXISTS prep_batch_items_delete ON foodtruck.preparation_batch_items;
DROP POLICY IF EXISTS prep_batch_items_insert ON foodtruck.preparation_batch_items;
DROP POLICY IF EXISTS prep_batch_items_select ON foodtruck.preparation_batch_items;

-- preparation_batches
DROP POLICY IF EXISTS prep_batches_update ON foodtruck.preparation_batches;
DROP POLICY IF EXISTS prep_batches_insert ON foodtruck.preparation_batches;
DROP POLICY IF EXISTS prep_batches_select ON foodtruck.preparation_batches;

-- stock_movements
DROP POLICY IF EXISTS stock_movements_no_delete ON foodtruck.stock_movements;
DROP POLICY IF EXISTS stock_movements_no_update ON foodtruck.stock_movements;
DROP POLICY IF EXISTS stock_movements_insert ON foodtruck.stock_movements;
DROP POLICY IF EXISTS stock_movements_select ON foodtruck.stock_movements;

-- purchase_items
DROP POLICY IF EXISTS purchase_items_update ON foodtruck.purchase_items;
DROP POLICY IF EXISTS purchase_items_insert ON foodtruck.purchase_items;
DROP POLICY IF EXISTS purchase_items_select ON foodtruck.purchase_items;

-- purchases
DROP POLICY IF EXISTS purchases_update ON foodtruck.purchases;
DROP POLICY IF EXISTS purchases_insert ON foodtruck.purchases;
DROP POLICY IF EXISTS purchases_select ON foodtruck.purchases;

-- ingredient_costs
DROP POLICY IF EXISTS ingredient_costs_write ON foodtruck.ingredient_costs;
DROP POLICY IF EXISTS ingredient_costs_select ON foodtruck.ingredient_costs;

-- ingredients
DROP POLICY IF EXISTS ingredients_write ON foodtruck.ingredients;
DROP POLICY IF EXISTS ingredients_select ON foodtruck.ingredients;

-- suppliers
DROP POLICY IF EXISTS suppliers_write ON foodtruck.suppliers;
DROP POLICY IF EXISTS suppliers_select ON foodtruck.suppliers;

-- unit_conversions
DROP POLICY IF EXISTS unit_conversions_write ON foodtruck.unit_conversions;
DROP POLICY IF EXISTS unit_conversions_select ON foodtruck.unit_conversions;

-- units
DROP POLICY IF EXISTS units_write ON foodtruck.units;
DROP POLICY IF EXISTS units_select ON foodtruck.units;

-- profiles
DROP POLICY IF EXISTS profiles_own_read ON foodtruck.profiles;
DROP POLICY IF EXISTS profiles_owner_all ON foodtruck.profiles;

-- =============================================================================
-- BLOQUE 4: ELIMINAR TRIGGERS (29 total)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_purchase_items_no_edit ON foodtruck.purchase_items;
DROP TRIGGER IF EXISTS trg_payments_derive_order_status ON foodtruck.payments;
DROP TRIGGER IF EXISTS trg_payments_validate_insert ON foodtruck.payments;
DROP TRIGGER IF EXISTS trg_orders_amount_guard ON foodtruck.orders;
DROP TRIGGER IF EXISTS trg_orders_status_guard ON foodtruck.orders;
DROP TRIGGER IF EXISTS trg_order_items_status_guard ON foodtruck.order_items;
DROP TRIGGER IF EXISTS trg_credit_payments_no_update ON foodtruck.credit_payments;
DROP TRIGGER IF EXISTS trg_credits_no_update ON foodtruck.credits;
DROP TRIGGER IF EXISTS trg_payments_no_update ON foodtruck.payments;
DROP TRIGGER IF EXISTS trg_credit_payments_validate ON foodtruck.credit_payments;
DROP TRIGGER IF EXISTS trg_prep_batch_items_cost ON foodtruck.preparation_batch_items;
DROP TRIGGER IF EXISTS trg_prep_batches_protect_delete ON foodtruck.preparation_batches;
DROP TRIGGER IF EXISTS trg_purchases_protect_delete ON foodtruck.purchases;
DROP TRIGGER IF EXISTS trg_purchase_items_stock ON foodtruck.purchase_items;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON foodtruck.profiles;
DROP TRIGGER IF EXISTS set_updated_at_suppliers ON foodtruck.suppliers;
DROP TRIGGER IF EXISTS set_updated_at_ingredients ON foodtruck.ingredients;
DROP TRIGGER IF EXISTS set_updated_at_purchases ON foodtruck.purchases;
DROP TRIGGER IF EXISTS set_updated_at_prep_batches ON foodtruck.preparation_batches;
DROP TRIGGER IF EXISTS set_updated_at_batch_costs ON foodtruck.preparation_batch_costs;
DROP TRIGGER IF EXISTS set_updated_at_sellable_products ON foodtruck.sellable_products;
DROP TRIGGER IF EXISTS set_updated_at_orders ON foodtruck.orders;
DROP TRIGGER IF EXISTS set_updated_at_credits ON foodtruck.credits;
DROP TRIGGER IF EXISTS set_updated_at_expenses ON foodtruck.expenses;
DROP TRIGGER IF EXISTS set_updated_at_employees ON foodtruck.employees;
DROP TRIGGER IF EXISTS set_updated_at_payroll_periods ON foodtruck.payroll_periods;
DROP TRIGGER IF EXISTS set_updated_at_payroll_entries ON foodtruck.payroll_entries;
DROP TRIGGER IF EXISTS set_updated_at_daily_closes ON foodtruck.daily_closes;
DROP TRIGGER IF EXISTS set_updated_at_daily_close_fin ON foodtruck.daily_close_financials;

-- =============================================================================
-- BLOQUE 5: ELIMINAR FUNCIONES (21 total)
-- =============================================================================

DROP FUNCTION IF EXISTS foodtruck.fn_protect_purchase_item_edit();
DROP FUNCTION IF EXISTS foodtruck.fn_protect_order_amount_fields();
DROP FUNCTION IF EXISTS foodtruck.fn_protect_order_status_transition();
DROP FUNCTION IF EXISTS foodtruck.fn_derive_order_status_from_payments();
DROP FUNCTION IF EXISTS foodtruck.fn_validate_payment_before_insert();
DROP FUNCTION IF EXISTS foodtruck.fn_protect_order_items_closed();
DROP FUNCTION IF EXISTS foodtruck.fn_protect_credit_payment_update();
DROP FUNCTION IF EXISTS foodtruck.fn_protect_credit_update();
DROP FUNCTION IF EXISTS foodtruck.fn_protect_payment_update();
DROP FUNCTION IF EXISTS foodtruck.fn_validate_credit_payment();
DROP FUNCTION IF EXISTS foodtruck.fn_batch_items_cost_trigger();
DROP FUNCTION IF EXISTS foodtruck.fn_protect_batch_delete();
DROP FUNCTION IF EXISTS foodtruck.fn_protect_purchase_delete();
DROP FUNCTION IF EXISTS foodtruck.fn_purchase_item_to_stock();
DROP FUNCTION IF EXISTS foodtruck.update_batch_cost(UUID);
DROP FUNCTION IF EXISTS foodtruck.add_stock_movement(UUID, NUMERIC, UUID, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS foodtruck.normalize_to_base_unit(UUID, NUMERIC, UUID);
DROP FUNCTION IF EXISTS foodtruck.handle_updated_at();
DROP FUNCTION IF EXISTS foodtruck.get_current_user_role();
DROP FUNCTION IF EXISTS foodtruck.fn_get_product_recipe_cost();
DROP FUNCTION IF EXISTS foodtruck.fn_get_daily_close_summary();

-- =============================================================================
-- BLOQUE 6: ELIMINAR VISTAS
-- =============================================================================

DROP VIEW IF EXISTS foodtruck.v_daily_close_summary;
DROP VIEW IF EXISTS foodtruck.v_daily_closes_safe;
DROP VIEW IF EXISTS foodtruck.v_employees_safe;
DROP VIEW IF EXISTS foodtruck.v_expenses_by_category;
DROP VIEW IF EXISTS foodtruck.v_payroll_summary;
DROP VIEW IF EXISTS foodtruck.v_credit_balances;
DROP VIEW IF EXISTS foodtruck.v_order_summary;
DROP VIEW IF EXISTS foodtruck.v_product_recipe_cost;
DROP VIEW IF EXISTS foodtruck.v_ingredients_safe;
DROP VIEW IF EXISTS foodtruck.v_current_stock;

-- =============================================================================
-- BLOQUE 7: ELIMINAR TABLAS (orden inverso de dependencias)
-- =============================================================================

DROP TABLE IF EXISTS foodtruck.daily_close_financials;
DROP TABLE IF EXISTS foodtruck.daily_closes;
DROP TABLE IF EXISTS foodtruck.production_bonuses;
DROP TABLE IF EXISTS foodtruck.advances;
DROP TABLE IF EXISTS foodtruck.payroll_entries;
DROP TABLE IF EXISTS foodtruck.payroll_periods;
DROP TABLE IF EXISTS foodtruck.employees;
DROP TABLE IF EXISTS foodtruck.expenses;
DROP TABLE IF EXISTS foodtruck.credit_payments;
DROP TABLE IF EXISTS foodtruck.credits;
DROP TABLE IF EXISTS foodtruck.payments;
DROP TABLE IF EXISTS foodtruck.order_items;
DROP TABLE IF EXISTS foodtruck.orders;
DROP TABLE IF EXISTS foodtruck.recipe_components;
DROP TABLE IF EXISTS foodtruck.sellable_products;
DROP TABLE IF EXISTS foodtruck.preparation_batch_items;
DROP TABLE IF EXISTS foodtruck.preparation_batch_costs;
DROP TABLE IF EXISTS foodtruck.preparation_batches;
DROP TABLE IF EXISTS foodtruck.stock_movements;
DROP TABLE IF EXISTS foodtruck.purchase_items;
DROP TABLE IF EXISTS foodtruck.purchases;
DROP TABLE IF EXISTS foodtruck.ingredient_costs;
DROP TABLE IF EXISTS foodtruck.ingredients;
DROP TABLE IF EXISTS foodtruck.suppliers;
DROP TABLE IF EXISTS foodtruck.unit_conversions;
DROP TABLE IF EXISTS foodtruck.units;
DROP TABLE IF EXISTS foodtruck.profiles;

-- =============================================================================
-- BLOQUE 8: ELIMINAR ESQUEMA
-- =============================================================================

DROP SCHEMA IF EXISTS foodtruck CASCADE;

-- =============================================================================
-- BLOQUE 9: VERIFICACIÓN FINAL
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'foodtruck'
  ) THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: Aún existen tablas en foodtruck';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.routines WHERE routine_schema = 'foodtruck'
  ) THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: Aún existen funciones en foodtruck';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_schema = 'foodtruck'
  ) THEN
    RAISE EXCEPTION 'VERIFICACIÓN FALLIDA: Aún existen vistas en foodtruck';
  END IF;

  RAISE NOTICE 'Verificación OK: Esquema foodtruck eliminado completamente';
END $$;

-- =============================================================================
-- BLOQUE 10: COMMIT
-- =============================================================================

COMMIT;

-- =============================================================================
-- FIN DEL ROLLBACK
-- =============================================================================
-- Después de ejecutar exitosamente:
--   1. Verificar: \dt foodtruck.* debe retornar vacío
--   2. Verificar que otros esquemas no se afectaron
--   3. Confirmar que PostgREST sigue funcionando
-- =============================================================================
