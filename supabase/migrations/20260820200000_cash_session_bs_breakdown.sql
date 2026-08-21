-- =============================================================================
-- FULL CHINA VZLA - Desglose por método también en bolívares (exacto)
-- =============================================================================
-- El desglose de cobros sumaba solo el USD por método. Para mostrar los Bs con
-- precisión histórica (no con la tasa actual), se agrega `paymentBreakdownVes`:
-- por método = SUM(payment.amount * bcv_rate de la orden de cada pago).
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_cash_session_snapshot(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM fullchinavzla.fn_require_cash_role();
  SELECT jsonb_build_object(
    'id', s.id,
    'sessionNumber', s.session_number,
    'registerId', r.id,
    'registerCode', r.code,
    'registerName', r.name,
    'status', s.status,
    'openedAt', s.opened_at,
    'openedBy', s.opened_by,
    'openingCashUsd', s.opening_cash_usd,
    'openingCashVes', s.opening_cash_ves,
    'cashSalesUsd', COALESCE(pay.cash_usd, 0),
    'paymentTotal', COALESCE(pay.payment_total, 0),
    'paymentBreakdown', COALESCE(pay.breakdown, '{}'::jsonb),
    'paymentBreakdownVes', COALESCE(pay.breakdown_ves, '{}'::jsonb),
    'movementInUsd', COALESCE(mov.in_usd, 0),
    'movementOutUsd', COALESCE(mov.out_usd, 0),
    'movementInVes', COALESCE(mov.in_ves, 0),
    'movementOutVes', COALESCE(mov.out_ves, 0),
    'expectedCashUsd', s.opening_cash_usd + COALESCE(pay.cash_usd, 0) + COALESCE(mov.in_usd, 0) - COALESCE(mov.out_usd, 0),
    'expectedCashVes', s.opening_cash_ves + COALESCE(mov.in_ves, 0) - COALESCE(mov.out_ves, 0),
    'countedCashUsd', s.counted_cash_usd,
    'countedCashVes', s.counted_cash_ves,
    'differenceUsd', s.difference_usd,
    'differenceVes', s.difference_ves,
    'closedAt', s.closed_at,
    'movements', COALESCE(mov.items, '[]'::jsonb)
  ) INTO v_result
  FROM fullchinavzla.cash_sessions s
  JOIN fullchinavzla.cash_registers r ON r.id = s.register_id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(p.method_total) FILTER (WHERE p.method = 'cash'), 0) AS cash_usd,
      COALESCE(SUM(p.method_total), 0) AS payment_total,
      COALESCE(jsonb_object_agg(p.method, p.method_total), '{}'::jsonb) AS breakdown,
      COALESCE(jsonb_object_agg(p.method, p.method_total_ves), '{}'::jsonb) AS breakdown_ves
    FROM (
      SELECT pm.method,
             SUM(pm.amount) AS method_total,
             SUM(pm.amount * COALESCE(o.bcv_rate, 0)) AS method_total_ves
      FROM fullchinavzla.payments pm
      LEFT JOIN fullchinavzla.orders o ON o.id = pm.order_id
      WHERE pm.cash_session_id = s.id
      GROUP BY pm.method
    ) p
  ) pay ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND direction='in'), 0) AS in_usd,
      COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND direction='out'), 0) AS out_usd,
      COALESCE(SUM(amount) FILTER (WHERE currency='VES' AND direction='in'), 0) AS in_ves,
      COALESCE(SUM(amount) FILTER (WHERE currency='VES' AND direction='out'), 0) AS out_ves,
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'direction', direction, 'movementType', movement_type,
        'currency', currency, 'amount', amount, 'description', description,
        'referenceNumber', reference_number, 'createdAt', created_at
      ) ORDER BY created_at DESC), '[]'::jsonb) AS items
    FROM fullchinavzla.cash_movements
    WHERE session_id = s.id
  ) mov ON true
  WHERE s.id = p_session_id;

  IF v_result IS NULL THEN RAISE EXCEPTION 'Sesion de caja no existe'; END IF;
  RETURN v_result;
END;
$function$;

COMMIT;
