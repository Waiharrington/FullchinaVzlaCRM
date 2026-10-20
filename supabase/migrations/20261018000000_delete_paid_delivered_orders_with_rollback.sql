-- Delete an order as one atomic business operation: restore consumed stock,
-- remove payment/report side effects, and retain only the order deletion event.
-- Apply to production only after a verified backup and explicit authorization.

BEGIN;

SET LOCAL ROLE supabase_admin;

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
  -- The delete RPC writes one explicit order-deletion event after its internal
  -- reversals and related-row cleanup have succeeded.
  IF current_setting('app.suppress_order_delete_activity', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

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
    NULLIF(v_row->>'order_number', ''), NULLIF(v_row->>'code', ''),
    NULLIF(v_row->>'concept', ''), NULLIF(v_row->>'product_name', ''),
    NULLIF(v_row->>'name', ''), NULLIF(v_row->>'full_name', ''),
    NULLIF(v_row->>'invoice_number', ''), NULLIF(v_row->>'id', '')
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
    'order_number', v_row->'order_number', 'status', v_row->'status',
    'fulfillment_status', v_row->'fulfillment_status', 'concept', v_row->'concept',
    'amount', v_row->'amount', 'total_amount', v_row->'total_amount',
    'price', v_row->'price', 'unit_price', v_row->'unit_price', 'unit_cost', v_row->'unit_cost',
    'quantity', v_row->'quantity', 'method', v_row->'method',
    'movement_type', v_row->'movement_type', 'order_type', v_row->'order_type',
    'purchase_date', v_row->'purchase_date', 'currency', v_row->'currency',
    'table_number', v_row->'table_number', 'name', v_row->'name',
    'product_name', v_row->'product_name', 'related_item', to_jsonb(v_related_name), 'code', v_row->'code'
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

CREATE OR REPLACE FUNCTION fullchinavzla.fn_audit_stock_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF current_setting('app.suppress_order_delete_activity', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.movement_type = 'adjustment' THEN
    PERFORM fullchinavzla.fn_log_audit(
      NEW.created_by,
      COALESCE((SELECT full_name FROM fullchinavzla.profiles WHERE id = NEW.created_by), 'Sistema'),
      'Inventario',
      'Ajuste de stock',
      NEW.notes || ' | Ingrediente: ' || (SELECT name FROM fullchinavzla.ingredients WHERE id = NEW.ingredient_id) || ' | Cantidad: ' || NEW.quantity,
      CASE WHEN NEW.quantity < 0 THEN 'warning' ELSE 'info' END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT := fullchinavzla.get_current_user_role();
  v_order RECORD;
  v_actor_id UUID := auth.uid();
  v_actor_name TEXT;
  v_item RECORD;
  v_reversal RECORD;
  v_cash_session_ids UUID[] := ARRAY[]::UUID[];
  v_cash_session_id UUID;
  v_cash_snapshot JSONB;
  v_loyalty RECORD;
  v_loyalty_threshold INTEGER;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado para eliminar comandas. Rol: %', v_role;
  END IF;

  SELECT o.id, o.status, o.fulfillment_status, o.order_number,
         COALESCE((SELECT SUM(oi.quantity * oi.unit_price)
                   FROM fullchinavzla.order_items oi
                   WHERE oi.order_id = o.id), 0) AS total_amount
  INTO v_order
  FROM fullchinavzla.orders o
  WHERE o.id = p_order_id
  FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'La comanda no existe.'; END IF;

  SELECT full_name INTO v_actor_name
  FROM fullchinavzla.profiles WHERE id = v_actor_id;
  v_actor_name := COALESCE(v_actor_name, 'Sistema');

  -- A commission already paid through payroll cannot be erased by deleting an
  -- order; require payroll correction first so the real payout stays accurate.
  IF EXISTS (
    SELECT 1
    FROM fullchinavzla.delivery_assignments da
    LEFT JOIN fullchinavzla.payroll_periods pp ON pp.id = da.payroll_period_id
    WHERE da.order_id = p_order_id
      AND da.status <> 'cancelled'
      AND (da.status = 'paid' OR da.payroll_payment_id IS NOT NULL OR pp.status = 'paid')
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar: la comisión de delivery de esta comanda ya fue liquidada en nómina.';
  END IF;

  -- Retain the explicit sensitive-action audit entry. The detailed activity
  -- event is inserted once at the end, after the entire cleanup succeeds.
  PERFORM fullchinavzla.fn_log_audit(
    v_actor_id, v_actor_name, 'Comandas', 'Comanda eliminada',
    'Comanda #FC-' || LPAD(v_order.order_number::TEXT, 6, '0') || ' eliminada', 'danger'
  );
  PERFORM set_config('app.suppress_order_delete_activity', 'on', true);
  PERFORM set_config('app.bypass_order_items_guard', 'on', true);

  -- Restore every consumed ingredient by append-only compensating movements.
  FOR v_item IN
    SELECT oi.id AS item_id
    FROM fullchinavzla.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    FOR v_reversal IN
      SELECT sm.ingredient_id, sm.unit_id, SUM(sm.quantity) AS total_qty
      FROM fullchinavzla.stock_movements sm
      WHERE sm.movement_type = 'consumption'
        AND sm.reference_type = 'order_item'
        AND sm.reference_id = v_item.item_id
      GROUP BY sm.ingredient_id, sm.unit_id
    LOOP
      IF v_reversal.total_qty = 0 OR EXISTS (
        SELECT 1 FROM fullchinavzla.stock_movements rev
        WHERE rev.movement_type = 'adjustment'
          AND rev.reference_type = 'order_item'
          AND rev.reference_id = v_item.item_id
          AND rev.ingredient_id = v_reversal.ingredient_id
          AND rev.notes = 'Reversa por eliminacion de comanda'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO fullchinavzla.stock_movements (
        ingredient_id, quantity, unit_id, movement_type,
        reference_type, reference_id, notes, created_by
      ) VALUES (
        v_reversal.ingredient_id, -v_reversal.total_qty, v_reversal.unit_id,
        'adjustment', 'order_item', v_item.item_id,
        'Reversa por eliminacion de comanda', v_actor_id
      );
    END LOOP;
  END LOOP;

  -- Remove links that use RESTRICT/default FK behavior before deleting items.
  UPDATE fullchinavzla.web_order_items
  SET confirmed_order_item_id = NULL
  WHERE confirmed_order_item_id IN (
    SELECT id FROM fullchinavzla.order_items WHERE order_id = p_order_id
  );
  DELETE FROM fullchinavzla.web_order_items
  WHERE request_id IN (
    SELECT id FROM fullchinavzla.web_order_requests WHERE converted_order_id = p_order_id
  );
  DELETE FROM fullchinavzla.web_order_requests WHERE converted_order_id = p_order_id;

  DELETE FROM fullchinavzla.gift_card_transactions
  WHERE order_id = p_order_id AND transaction_type = 'redemption';

  -- Remove the receivable and order-specific adjustments/events as part of
  -- the same rollback. Receivable payments for an order also have a matching
  -- row in payments, which is removed below and drives account balances.
  DELETE FROM fullchinavzla.credits WHERE order_id = p_order_id;
  DELETE FROM fullchinavzla.order_adjustments WHERE order_id = p_order_id;
  DELETE FROM fullchinavzla.order_event_logs WHERE order_id = p_order_id;

  -- Remove the earned loyalty visit and recompute the customer's counters.
  FOR v_loyalty IN
    WITH removed_visits AS (
      DELETE FROM fullchinavzla.customer_loyalty_visits
      WHERE order_id = p_order_id
      RETURNING customer_id
    )
    SELECT customer_id FROM removed_visits
  LOOP
    SELECT visits_per_reward INTO v_loyalty_threshold
    FROM fullchinavzla.loyalty_settings WHERE id = TRUE;
    UPDATE fullchinavzla.customers c
    SET total_visits = counts.visit_count,
        rewards_unlocked = floor(counts.visit_count::NUMERIC / GREATEST(1, COALESCE(v_loyalty_threshold, 10)))::INTEGER,
        last_visit = counts.last_visit,
        updated_at = now()
    FROM (
      SELECT COUNT(*)::INTEGER AS visit_count,
             MAX((clv.visited_at AT TIME ZONE 'America/Caracas')::DATE) AS last_visit
      FROM fullchinavzla.customer_loyalty_visits clv
      WHERE clv.customer_id = v_loyalty.customer_id
    ) counts
    WHERE c.id = v_loyalty.customer_id;
  END LOOP;

  -- Capture affected physical-cash sessions so stored close snapshots can be
  -- reconciled after their payments are removed.
  SELECT COALESCE(array_agg(DISTINCT cash_session_id) FILTER (WHERE cash_session_id IS NOT NULL), ARRAY[]::UUID[])
  INTO v_cash_session_ids
  FROM fullchinavzla.payments WHERE order_id = p_order_id;
  PERFORM 1
  FROM fullchinavzla.cash_sessions
  WHERE id = ANY(v_cash_session_ids)
  FOR UPDATE;

  DELETE FROM fullchinavzla.payments WHERE order_id = p_order_id;
  DELETE FROM fullchinavzla.order_item_modifiers
  WHERE order_item_id IN (SELECT id FROM fullchinavzla.order_items WHERE order_id = p_order_id);
  DELETE FROM fullchinavzla.order_items WHERE order_id = p_order_id;
  DELETE FROM fullchinavzla.delivery_assignments WHERE order_id = p_order_id;
  DELETE FROM fullchinavzla.orders WHERE id = p_order_id;

  FOREACH v_cash_session_id IN ARRAY v_cash_session_ids LOOP
    IF EXISTS (SELECT 1 FROM fullchinavzla.cash_sessions WHERE id = v_cash_session_id AND status = 'closed') THEN
      v_cash_snapshot := fullchinavzla.fn_cash_session_snapshot(v_cash_session_id);
      UPDATE fullchinavzla.cash_sessions
      SET expected_cash_usd = (v_cash_snapshot->>'expectedCashUsd')::NUMERIC,
          expected_cash_ves = (v_cash_snapshot->>'expectedCashVes')::NUMERIC,
          difference_usd = counted_cash_usd - (v_cash_snapshot->>'expectedCashUsd')::NUMERIC,
          difference_ves = counted_cash_ves - (v_cash_snapshot->>'expectedCashVes')::NUMERIC,
          payment_breakdown = COALESCE(v_cash_snapshot->'paymentBreakdown', '{}'::JSONB),
          updated_at = now()
      WHERE id = v_cash_session_id;
    END IF;
  END LOOP;

  INSERT INTO fullchinavzla.system_activity_logs (
    actor_id, actor_name, module, action, entity_table, entity_id,
    entity_label, changed_fields, changes, context
  ) VALUES (
    v_actor_id, v_actor_name, 'Ventas y comandas', 'DELETE', 'orders',
    p_order_id::TEXT,
    'Comanda #FC-' || LPAD(v_order.order_number::TEXT, 6, '0'),
    ARRAY['status', 'fulfillment_status', 'total_amount'],
    '{}'::JSONB,
    jsonb_strip_nulls(jsonb_build_object(
      'order_number', v_order.order_number,
      'status', v_order.status,
      'fulfillment_status', v_order.fulfillment_status,
      'total_amount', v_order.total_amount
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_delete_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_delete_order(UUID) TO authenticated;

COMMIT;
