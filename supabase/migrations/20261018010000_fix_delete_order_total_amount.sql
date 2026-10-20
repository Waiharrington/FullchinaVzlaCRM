-- Fix order total lookup in fn_delete_order: orders.total_amount is calculated from order_items.
BEGIN;

SET LOCAL ROLE supabase_admin;

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
