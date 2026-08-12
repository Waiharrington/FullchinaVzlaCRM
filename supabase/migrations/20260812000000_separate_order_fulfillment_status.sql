-- Separa el avance de cocina/entrega del estado financiero de la orden.
-- Una orden puede estar pagada y continuar preparando/lista hasta ser entregada.
BEGIN;

ALTER TABLE fullchinavzla.orders
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'new';

ALTER TABLE fullchinavzla.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;

ALTER TABLE fullchinavzla.orders
  ADD CONSTRAINT orders_fulfillment_status_check
  CHECK (fulfillment_status IN ('new', 'preparing', 'ready', 'delivered'));

COMMENT ON COLUMN fullchinavzla.orders.fulfillment_status IS
  'Flujo operativo independiente del cobro: new -> preparing -> ready -> delivered.';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_protect_order_amount_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF OLD.status IN ('paid', 'cancelled') THEN
    v_role := fullchinavzla.get_current_user_role();
    IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
      IF (to_jsonb(NEW) - 'fulfillment_status' - 'updated_at')
         IS DISTINCT FROM
         (to_jsonb(OLD) - 'fulfillment_status' - 'updated_at') THEN
        RAISE EXCEPTION 'No se puede modificar la información financiera de la orden % en estado %.',
          OLD.id, OLD.status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE fullchinavzla.orders
SET fulfillment_status = CASE
  WHEN status = 'preparing' THEN 'preparing'
  WHEN status = 'ready' THEN 'ready'
  ELSE fulfillment_status
END
WHERE status IN ('preparing', 'ready');

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
    LEFT JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
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
  ), '[]'::json) AS payments,
  o.fulfillment_status
FROM fullchinavzla.orders o;

COMMENT ON VIEW fullchinavzla.v_orders_with_items IS
  'Ordenes con estado financiero, avance operativo, items y pagos; security_invoker respeta RLS.';

REVOKE ALL ON fullchinavzla.v_orders_with_items FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.v_orders_with_items TO authenticated, service_role;

COMMIT;
