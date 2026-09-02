-- La caja operativa representa solo el efectivo físico del foodtruck.
-- Separa ventas USD/VES por la cuenta destino y excluye otros métodos.

BEGIN;
SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_cash_session_snapshot(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE v_result jsonb;
BEGIN
  PERFORM fullchinavzla.fn_require_cash_role();
  SELECT jsonb_build_object(
    'id', s.id, 'sessionNumber', s.session_number,
    'registerId', r.id, 'registerCode', r.code, 'registerName', r.name,
    'status', s.status, 'openedAt', s.opened_at, 'openedBy', s.opened_by,
    'openingCashUsd', s.opening_cash_usd, 'openingCashVes', s.opening_cash_ves,
    'cashSalesUsd', COALESCE(pay.cash_usd, 0),
    'cashSalesVes', COALESCE(pay.cash_ves, 0),
    'paymentTotal', COALESCE(pay.cash_usd_equivalent, 0),
    'paymentBreakdown', jsonb_build_object('cash', COALESCE(pay.cash_usd_equivalent, 0)),
    'paymentBreakdownVes', jsonb_build_object('cash', COALESCE(pay.cash_ves, 0)),
    'movementInUsd', COALESCE(mov.in_usd, 0), 'movementOutUsd', COALESCE(mov.out_usd, 0),
    'movementInVes', COALESCE(mov.in_ves, 0), 'movementOutVes', COALESCE(mov.out_ves, 0),
    'expectedCashUsd', s.opening_cash_usd + COALESCE(pay.cash_usd, 0) + COALESCE(mov.in_usd, 0) - COALESCE(mov.out_usd, 0),
    'expectedCashVes', s.opening_cash_ves + COALESCE(pay.cash_ves, 0) + COALESCE(mov.in_ves, 0) - COALESCE(mov.out_ves, 0),
    'countedCashUsd', s.counted_cash_usd, 'countedCashVes', s.counted_cash_ves,
    'differenceUsd', s.difference_usd, 'differenceVes', s.difference_ves,
    'closedAt', s.closed_at, 'movements', COALESCE(mov.items, '[]'::jsonb)
  ) INTO v_result
  FROM fullchinavzla.cash_sessions s
  JOIN fullchinavzla.cash_registers r ON r.id = s.register_id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(pm.amount) FILTER (WHERE COALESCE(a.currency, 'USD') = 'USD'), 0) cash_usd,
      COALESCE(SUM(pm.amount * COALESCE(o.bcv_rate, 0)) FILTER (WHERE a.currency = 'VES'), 0) cash_ves,
      COALESCE(SUM(pm.amount), 0) cash_usd_equivalent
    FROM fullchinavzla.payments pm
    JOIN fullchinavzla.orders o ON o.id = pm.order_id
    LEFT JOIN fullchinavzla.financial_accounts a ON a.id = pm.account_id
    WHERE pm.cash_session_id = s.id AND pm.method = 'cash'
      AND (a.account_type = 'cash' OR a.id IS NULL)
  ) pay ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND direction='in'), 0) in_usd,
      COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND direction='out'), 0) out_usd,
      COALESCE(SUM(amount) FILTER (WHERE currency='VES' AND direction='in'), 0) in_ves,
      COALESCE(SUM(amount) FILTER (WHERE currency='VES' AND direction='out'), 0) out_ves,
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'direction', direction, 'movementType', movement_type,
        'currency', currency, 'amount', amount, 'description', description,
        'referenceNumber', reference_number, 'createdAt', created_at
      ) ORDER BY created_at DESC), '[]'::jsonb) items
    FROM fullchinavzla.cash_movements WHERE session_id = s.id
  ) mov ON true
  WHERE s.id = p_session_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Sesion de caja no existe'; END IF;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_cash_session_transactions(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
BEGIN
  PERFORM fullchinavzla.fn_require_cash_role();
  PERFORM 1 FROM fullchinavzla.cash_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesion de caja no existe'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(row_data ORDER BY ts DESC) FROM (
    SELECT jsonb_build_object(
      'id', p.id, 'kind', 'payment', 'direction', 'in',
      'orderNumber', o.order_number, 'orderType', o.order_type,
      'customerName', o.customer_name, 'method', p.method,
      'currency', COALESCE(a.currency, 'USD'),
      'amount', CASE WHEN a.currency = 'VES' THEN p.amount * COALESCE(o.bcv_rate, 0) ELSE p.amount END,
      'referenceNumber', p.reference_number, 'createdAt', p.created_at,
      'itemsSummary', items.summary
    ) row_data, p.created_at ts
    FROM fullchinavzla.payments p
    JOIN fullchinavzla.orders o ON o.id = p.order_id
    LEFT JOIN fullchinavzla.financial_accounts a ON a.id = p.account_id
    LEFT JOIN LATERAL (
      SELECT string_agg(CASE WHEN oi.quantity = 1 THEN sp.name ELSE oi.quantity::int::text || 'x ' || sp.name END, ', ' ORDER BY oi.created_at) summary
      FROM fullchinavzla.order_items oi
      JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
      WHERE oi.order_id = o.id AND COALESCE(sp.is_delivery, false) = false
    ) items ON true
    WHERE p.cash_session_id = p_session_id AND p.method = 'cash'
      AND (a.account_type = 'cash' OR a.id IS NULL)
    UNION ALL
    SELECT jsonb_build_object(
      'id', m.id, 'kind', 'movement', 'direction', m.direction,
      'orderNumber', NULL, 'orderType', NULL, 'customerName', NULL,
      'method', m.movement_type, 'currency', m.currency, 'amount', m.amount,
      'referenceNumber', m.reference_number, 'createdAt', m.created_at,
      'itemsSummary', m.description
    ) row_data, m.created_at ts
    FROM fullchinavzla.cash_movements m WHERE m.session_id = p_session_id
  ) combined), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_cash_session_transactions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_cash_session_transactions(uuid) TO authenticated, service_role;
COMMIT;
