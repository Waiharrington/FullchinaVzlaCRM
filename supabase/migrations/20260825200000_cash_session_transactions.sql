-- =============================================================================
-- FULL CHINA VZLA - Historial de transacciones por sesión de caja
-- =============================================================================
-- Devuelve los pagos individuales (con datos de orden) y los movimientos
-- manuales de una sesión de caja, unificados en una línea de tiempo.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_cash_session_transactions(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  PERFORM fullchinavzla.fn_require_cash_role();

  PERFORM 1 FROM fullchinavzla.cash_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesion de caja no existe'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_data ORDER BY ts DESC)
    FROM (
      -- Pagos de órdenes (entradas)
      SELECT jsonb_build_object(
        'id',             p.id,
        'kind',           'payment',
        'direction',      'in',
        'orderNumber',    o.order_number,
        'orderType',      o.order_type,
        'customerName',   o.customer_name,
        'method',         p.method,
        'amount',         p.amount,
        'referenceNumber', p.reference_number,
        'createdAt',      p.created_at,
        'itemsSummary',   items.summary
      ) AS row_data,
      p.created_at AS ts
      FROM fullchinavzla.payments p
      JOIN fullchinavzla.orders o ON o.id = p.order_id
      LEFT JOIN LATERAL (
        SELECT string_agg(
          CASE WHEN oi.quantity = 1 THEN sp.name
               ELSE oi.quantity::int::text || 'x ' || sp.name
          END, ', '
          ORDER BY oi.created_at
        ) AS summary
        FROM fullchinavzla.order_items oi
        JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
        WHERE oi.order_id = o.id
          AND COALESCE(sp.is_delivery, false) = false
      ) items ON true
      WHERE p.cash_session_id = p_session_id

      UNION ALL

      -- Movimientos manuales (entradas y salidas)
      SELECT jsonb_build_object(
        'id',             m.id,
        'kind',           'movement',
        'direction',      m.direction,
        'orderNumber',    NULL,
        'orderType',      NULL,
        'customerName',   NULL,
        'method',         m.movement_type,
        'amount',         m.amount,
        'referenceNumber', m.reference_number,
        'createdAt',      m.created_at,
        'itemsSummary',   m.description
      ) AS row_data,
      m.created_at AS ts
      FROM fullchinavzla.cash_movements m
      WHERE m.session_id = p_session_id
    ) combined
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_cash_session_transactions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_cash_session_transactions(UUID)
  TO authenticated, service_role;

COMMIT;
