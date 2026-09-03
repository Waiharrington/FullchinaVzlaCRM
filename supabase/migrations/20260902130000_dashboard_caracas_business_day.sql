-- Dashboard: el dia operativo de Full China corresponde a Venezuela, no a UTC.
-- Sin esta conversion, entre las 8:00 p. m. y medianoche local el servidor ya
-- considera que comenzo el dia siguiente y los KPI de "hoy" aparecen en cero.

BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_today_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Caracas')::date;
  v_total_sales NUMERIC(12,2);
  v_orders_count BIGINT;
  v_pending_count BIGINT;
  v_ready_count BIGINT;
  v_avg_ticket NUMERIC(12,2);
  v_result JSON;
BEGIN
  SELECT COALESCE(SUM(p.amount), 0), COUNT(DISTINCT o.id)
  INTO v_total_sales, v_orders_count
  FROM fullchinavzla.orders o
  JOIN fullchinavzla.payments p ON p.order_id = o.id
  WHERE o.status = 'paid'
    AND (o.created_at AT TIME ZONE 'America/Caracas')::date = v_today;

  SELECT COUNT(*)
  INTO v_pending_count
  FROM fullchinavzla.orders
  WHERE status IN ('open', 'confirmed', 'preparing')
    AND (created_at AT TIME ZONE 'America/Caracas')::date = v_today;

  SELECT COUNT(*)
  INTO v_ready_count
  FROM fullchinavzla.orders
  WHERE status = 'ready'
    AND (created_at AT TIME ZONE 'America/Caracas')::date = v_today;

  v_avg_ticket := CASE
    WHEN v_orders_count > 0 THEN v_total_sales / v_orders_count
    ELSE 0
  END;

  v_result := json_build_object(
    'totalSales', v_total_sales,
    'ordersCount', v_orders_count,
    'pendingOrders', v_pending_count,
    'readyOrders', v_ready_count,
    'avgTicket', v_avg_ticket
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_today_stats() IS
  'RPC: retorna estadisticas del dia operativo en America/Caracas';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_daily_sales(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  sale_date DATE,
  total NUMERIC(12,2),
  order_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Caracas')::date;
BEGIN
  RETURN QUERY
  SELECT
    d::date AS sale_date,
    COALESCE(SUM(p.amount), 0)::NUMERIC(12,2) AS total,
    COUNT(DISTINCT o.id)::BIGINT AS order_count
  FROM generate_series((v_today - (GREATEST(p_days, 1) - 1))::date, v_today, '1 day') d
  LEFT JOIN fullchinavzla.orders o
    ON (o.created_at AT TIME ZONE 'America/Caracas')::date = d
   AND o.status = 'paid'
  LEFT JOIN fullchinavzla.payments p ON p.order_id = o.id
  GROUP BY d
  ORDER BY d;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_daily_sales(INTEGER) IS
  'RPC: retorna ventas diarias usando el dia operativo de America/Caracas';

COMMIT;
