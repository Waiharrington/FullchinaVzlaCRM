-- El dashboard llama a esta RPC como "cobros de hoy".
-- La version anterior agrupaba todos los pagos historicos y no consideraba
-- el cambio de dia local de Venezuela.

BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_payment_method_sales()
RETURNS TABLE (
  method TEXT,
  total NUMERIC(12,2),
  count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'America/Caracas') AT TIME ZONE 'America/Caracas';
  v_end TIMESTAMPTZ := (date_trunc('day', now() AT TIME ZONE 'America/Caracas') + interval '1 day') AT TIME ZONE 'America/Caracas';
BEGIN
  RETURN QUERY
  SELECT
    p.method,
    SUM(p.amount)::NUMERIC(12,2) AS total,
    COUNT(*)::BIGINT AS count
  FROM fullchinavzla.payments p
  JOIN fullchinavzla.orders o ON o.id = p.order_id
  WHERE o.status = 'paid'
    AND o.created_at >= v_start
    AND o.created_at < v_end
  GROUP BY p.method
  ORDER BY total DESC;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_payment_method_sales() IS
  'RPC: retorna cobros pagados del dia calendario actual en America/Caracas agrupados por metodo';

COMMIT;
