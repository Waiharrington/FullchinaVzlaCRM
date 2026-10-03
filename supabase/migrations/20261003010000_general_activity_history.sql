-- Registro general de cambios operativos. Migracion local: requiere backup y
-- autorizacion explicita antes de aplicarse al VPS.
BEGIN;

CREATE TABLE IF NOT EXISTS fullchinavzla.system_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_id UUID,
  actor_name TEXT NOT NULL DEFAULT 'Sistema',
  module TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity_table TEXT NOT NULL,
  entity_id TEXT,
  entity_label TEXT,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_activity_logs_occurred
  ON fullchinavzla.system_activity_logs (occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_actor
  ON fullchinavzla.system_activity_logs (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_module
  ON fullchinavzla.system_activity_logs (module, occurred_at DESC);

DROP TRIGGER IF EXISTS fullchina_data_change_feed ON fullchinavzla.system_activity_logs;
CREATE TRIGGER fullchina_data_change_feed
  AFTER INSERT OR UPDATE OR DELETE ON fullchinavzla.system_activity_logs
  FOR EACH STATEMENT EXECUTE FUNCTION fullchinavzla.bump_data_change_version();

ALTER TABLE fullchinavzla.system_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_activity_logs_owner_read ON fullchinavzla.system_activity_logs;
CREATE POLICY system_activity_logs_owner_read
  ON fullchinavzla.system_activity_logs
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() = 'owner');
REVOKE ALL ON fullchinavzla.system_activity_logs FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.system_activity_logs TO authenticated;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_capture_system_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, fullchinavzla, pg_temp
AS $$
DECLARE
  v_old JSONB := '{}'::jsonb;
  v_new JSONB := '{}'::jsonb;
  v_row JSONB;
  v_actor_id UUID := auth.uid();
  v_actor_name TEXT := 'Sistema';
  v_entity_id TEXT;
  v_entity_label TEXT;
  v_module TEXT;
  v_fields TEXT[] := '{}';
  v_changes JSONB := '{}'::jsonb;
  v_context JSONB;
  v_order_number TEXT;
  v_related_name TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN v_old ELSE v_new END;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(n.key ORDER BY n.key), '{}') INTO v_fields
    FROM jsonb_each(v_new) AS n(key, value)
    LEFT JOIN jsonb_each(v_old) AS o(key, value) USING (key)
    WHERE o.value IS DISTINCT FROM n.value
      AND n.key NOT IN ('updated_at', 'last_seen_at', 'last_activity_at', 'sync_version');
    IF cardinality(v_fields) = 0 THEN RETURN NEW; END IF;
    SELECT COALESCE(jsonb_object_agg(n.key, jsonb_build_object('before', o.value, 'after', n.value)), '{}'::jsonb)
      INTO v_changes
    FROM jsonb_each(v_new) AS n(key, value)
    JOIN jsonb_each(v_old) AS o(key, value) USING (key)
    WHERE o.value IS DISTINCT FROM n.value
      AND n.key = ANY (ARRAY[
        'status', 'fulfillment_status', 'amount', 'amount_usd', 'total_amount',
        'price', 'unit_price', 'unit_cost', 'quantity', 'concept', 'method',
        'movement_type', 'order_type', 'table_number', 'purchase_date',
        'currency', 'is_paid', 'is_active', 'name', 'full_name', 'product_name', 'code'
      ]::TEXT[]);
  ELSIF TG_OP = 'INSERT' THEN
    SELECT COALESCE(array_agg(key ORDER BY key), '{}') INTO v_fields
    FROM jsonb_object_keys(v_new) AS fields(key)
    WHERE key !~* '(password|pin|token|secret|credential|api.?key|authorization)';
  ELSE
    SELECT COALESCE(array_agg(key ORDER BY key), '{}') INTO v_fields
    FROM jsonb_object_keys(v_old) AS fields(key)
    WHERE key !~* '(password|pin|token|secret|credential|api.?key|authorization)';
  END IF;

  IF v_actor_id IS NULL THEN
    IF COALESCE(v_row->>'created_by', v_row->>'updated_by') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_actor_id := COALESCE(v_row->>'created_by', v_row->>'updated_by')::UUID;
    END IF;
  END IF;
  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(full_name, ''), 'Usuario') INTO v_actor_name
    FROM fullchinavzla.profiles WHERE id = v_actor_id;
    v_actor_name := COALESCE(v_actor_name, 'Usuario');
  END IF;

  v_module := CASE
    WHEN TG_TABLE_NAME IN ('orders', 'order_items', 'order_item_modifiers', 'payments', 'customers', 'credits', 'credit_payments', 'order_adjustments', 'floor_tables', 'legacy_sales') THEN 'Ventas y comandas'
    WHEN TG_TABLE_NAME IN ('purchases', 'purchase_items', 'purchase_payments', 'suppliers') THEN 'Compras'
    WHEN TG_TABLE_NAME IN ('expenses', 'expense_payments') THEN 'Gastos'
    WHEN TG_TABLE_NAME IN ('stock_movements', 'ingredients', 'ingredient_costs', 'units', 'unit_conversions', 'inventory_requisitions') THEN 'Inventario'
    WHEN TG_TABLE_NAME IN ('cash_sessions', 'cash_movements', 'daily_closes', 'daily_close_financials', 'financial_accounts', 'financial_operations') THEN 'Caja y finanzas'
    WHEN TG_TABLE_NAME IN ('employees', 'profiles', 'employee_attendance', 'payroll_periods', 'payroll_entries', 'payroll_payments', 'advances') THEN 'Equipo y nómina'
    WHEN TG_TABLE_NAME IN ('sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'menu_categories', 'weekly_menu_items', 'weekly_menu_activations', 'promotions') THEN 'Menú y promociones'
    WHEN TG_TABLE_NAME IN ('preparation_batches', 'preparation_batch_items', 'preparation_batch_costs', 'production_bonuses', 'recipe_components', 'portion_recipes') THEN 'Producción y recetas'
    WHEN TG_TABLE_NAME IN ('gift_cards', 'gift_card_transactions') THEN 'Fidelización'
    WHEN TG_TABLE_NAME IN ('whatsapp_messages', 'whatsapp_templates', 'whatsapp_segments', 'whatsapp_segment_members', 'whatsapp_queue_batches') THEN 'Marketing y WhatsApp'
    WHEN TG_TABLE_NAME IN ('delivery_config', 'delivery_zones', 'app_settings') THEN 'Configuración'
    ELSE 'Sistema'
  END;

  v_entity_label := COALESCE(
    NULLIF(v_row->>'order_number', ''),
    NULLIF(v_row->>'code', ''),
    NULLIF(v_row->>'concept', ''),
    NULLIF(v_row->>'product_name', ''),
    NULLIF(v_row->>'name', ''),
    NULLIF(v_row->>'full_name', ''),
    NULLIF(v_row->>'invoice_number', ''),
    NULLIF(v_row->>'id', '')
  );
  v_entity_id := NULLIF(v_row->>'id', '');

  IF NULLIF(v_row->>'ingredient_id', '') IS NOT NULL THEN
    SELECT name INTO v_related_name FROM fullchinavzla.ingredients WHERE id::TEXT = v_row->>'ingredient_id';
  ELSIF NULLIF(v_row->>'sellable_product_id', '') IS NOT NULL THEN
    SELECT name INTO v_related_name FROM fullchinavzla.sellable_products WHERE id::TEXT = v_row->>'sellable_product_id';
  END IF;

  IF TG_TABLE_NAME IN ('payments', 'order_items') AND NULLIF(v_row->>'order_id', '') IS NOT NULL THEN
    SELECT order_number::TEXT INTO v_order_number
    FROM fullchinavzla.orders WHERE id::TEXT = v_row->>'order_id';
    IF v_order_number IS NOT NULL THEN v_entity_label := 'Comanda #' || v_order_number; END IF;
  ELSIF TG_TABLE_NAME IN ('purchase_items', 'purchase_payments') AND NULLIF(v_row->>'purchase_id', '') IS NOT NULL THEN
    SELECT COALESCE(NULLIF(invoice_number, ''), id::TEXT) INTO v_entity_label
    FROM fullchinavzla.purchases WHERE id::TEXT = v_row->>'purchase_id';
  ELSIF TG_TABLE_NAME = 'purchases' AND NULLIF(v_row->>'supplier_id', '') IS NOT NULL THEN
    SELECT COALESCE(NULLIF(v_entity_label, ''), name) INTO v_entity_label
    FROM fullchinavzla.suppliers WHERE id::TEXT = v_row->>'supplier_id';
  END IF;

  v_context := jsonb_strip_nulls(jsonb_build_object(
    'order_number', v_row->'order_number',
    'status', v_row->'status',
    'fulfillment_status', v_row->'fulfillment_status',
    'concept', v_row->'concept',
    'amount', v_row->'amount',
    'total_amount', v_row->'total_amount',
    'price', v_row->'price',
    'unit_price', v_row->'unit_price',
    'unit_cost', v_row->'unit_cost',
    'quantity', v_row->'quantity',
    'method', v_row->'method',
    'movement_type', v_row->'movement_type',
    'order_type', v_row->'order_type',
    'purchase_date', v_row->'purchase_date',
    'currency', v_row->'currency',
    'table_number', v_row->'table_number',
    'name', v_row->'name',
    'product_name', v_row->'product_name',
    'related_item', to_jsonb(v_related_name),
    'code', v_row->'code'
  ));

  INSERT INTO fullchinavzla.system_activity_logs (
    actor_id, actor_name, module, action, entity_table, entity_id,
    entity_label, changed_fields, changes, context
  ) VALUES (
    v_actor_id, v_actor_name, v_module, TG_OP, TG_TABLE_NAME, v_entity_id,
    v_entity_label, v_fields, v_changes, v_context
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_capture_system_activity() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  target_table RECORD;
BEGIN
  FOR target_table IN
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'fullchinavzla'
      AND tablename NOT IN (
        'audit_logs', 'system_activity_logs', 'data_change_versions',
        'order_event_logs'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_system_activity ON fullchinavzla.%I', target_table.tablename);
    EXECUTE format(
      'CREATE TRIGGER trg_system_activity AFTER INSERT OR UPDATE OR DELETE ON fullchinavzla.%I FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_capture_system_activity()',
      target_table.tablename
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
