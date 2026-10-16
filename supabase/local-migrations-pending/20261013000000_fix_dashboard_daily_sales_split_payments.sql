-- Mantiene el gráfico diario alineado con fn_get_today_stats cuando una
-- comanda combina pagos reales y consumo a cuenta personal. Se excluye solo
-- el importe personal, no toda la comanda.
BEGIN;

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
    COUNT(DISTINCT o.id) FILTER (WHERE p.id IS NOT NULL)::BIGINT AS order_count
  FROM generate_series(
    (v_today - (GREATEST(p_days, 1) - 1))::date,
    v_today,
    '1 day'
  ) d
  LEFT JOIN fullchinavzla.orders o
    ON (o.created_at AT TIME ZONE 'America/Caracas')::date = d::date
   AND o.status = 'paid'
  LEFT JOIN fullchinavzla.payments p
    ON p.order_id = o.id
   AND p.method <> 'personal_account'
  GROUP BY d
  ORDER BY d;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_daily_sales(INTEGER) IS
  'Ventas diarias en America/Caracas: suma pagos no personales incluso en comandas con pagos mixtos.';

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_daily_sales(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_daily_sales(INTEGER) TO authenticated, service_role;

COMMIT;
