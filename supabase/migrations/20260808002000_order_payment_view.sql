-- =============================================================================
-- FULL CHINA VZLA - VISTA DE COMANDAS CON PAGOS
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW fullchinavzla.v_orders_with_items
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.notes,
  o.order_type,
  o.customer_name,
  o.bcv_rate,
  o.created_by,
  o.created_at,
  o.updated_at,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', oi.id,
        'sellable_product_id', oi.sellable_product_id,
        'product_name', sp.name,
        'emoji', sp.emoji,
        'category', sp.category,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price
      ) ORDER BY oi.created_at
    )
    FROM fullchinavzla.order_items oi
    LEFT JOIN fullchinavzla.sellable_products sp
      ON sp.id = oi.sellable_product_id
    WHERE oi.order_id = o.id
  ), '[]'::json) AS items,
  COALESCE((
    SELECT SUM(oi.quantity * oi.unit_price)
    FROM fullchinavzla.order_items oi
    WHERE oi.order_id = o.id
  ), 0) AS total_amount,
  (
    SELECT COUNT(*)
    FROM fullchinavzla.order_items oi
    WHERE oi.order_id = o.id
  ) AS item_count,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'method', p.method,
        'amount', p.amount,
        'reference_number', p.reference_number,
        'received_amount', p.received_amount,
        'notes', p.notes,
        'created_at', p.created_at
      ) ORDER BY p.created_at
    )
    FROM fullchinavzla.payments p
    WHERE p.order_id = o.id
  ), '[]'::json) AS payments
FROM fullchinavzla.orders o;

COMMENT ON VIEW fullchinavzla.v_orders_with_items IS
  'Ordenes con items y pagos anidados; security_invoker respeta RLS del usuario';

REVOKE ALL ON fullchinavzla.v_orders_with_items FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.v_orders_with_items TO authenticated, service_role;

COMMIT;
