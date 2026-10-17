-- Return a customer's own paid order details for the public reorder flow.
-- This function intentionally exposes no payment records and never creates an order.
BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_customer_order_for_repeat(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'orderId', o.id,
    'orderType', o.order_type,
    'customerName', COALESCE(NULLIF(btrim(a_customer.full_name), ''), o.customer_name),
    'customerPhone', COALESCE(NULLIF(btrim(a_customer.phone), ''), request.customer_phone),
    'customerIdentification', COALESCE(NULLIF(btrim(a_customer.identification), ''), request.customer_identification),
    'deliveryAddress', request.delivery_address,
    'deliveryLat', request.delivery_lat,
    'deliveryLng', request.delivery_lng,
    'customerNotes', request.notes,
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'productId', oi.sellable_product_id,
        'productName', sp.name,
        'available', sp.is_active AND NOT COALESCE(sp.is_delivery, false),
        'quantity', oi.quantity,
        'notes', web_item.notes,
        'modifiers', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'optionId', oim.modifier_option_id,
            'quantity', oim.quantity
          ) ORDER BY oim.id)
          FROM fullchinavzla.order_item_modifiers oim
          WHERE oim.order_item_id = oi.id
        ), '[]'::jsonb)
      ) ORDER BY oi.created_at, oi.id), '[]'::jsonb)
      FROM fullchinavzla.order_items oi
      JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
      LEFT JOIN LATERAL (
        SELECT wi.notes
        FROM fullchinavzla.web_order_items wi
        WHERE wi.confirmed_order_item_id = oi.id
        ORDER BY wi.created_at, wi.id
        LIMIT 1
      ) web_item ON TRUE
      WHERE oi.order_id = o.id
    )
  ) INTO v_result
  FROM fullchinavzla.orders o
  JOIN fullchinavzla.customer_accounts account
    ON account.customer_id = o.customer_id
   AND account.auth_user_id = auth.uid()
   AND account.status = 'active'
  JOIN fullchinavzla.customers a_customer ON a_customer.id = account.customer_id
  LEFT JOIN LATERAL (
    SELECT r.customer_phone, r.customer_identification, r.delivery_address, r.delivery_lat, r.delivery_lng
    FROM fullchinavzla.web_order_requests r
    WHERE r.converted_order_id = o.id
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 1
  ) request ON TRUE
  WHERE o.id = p_order_id
    AND o.status = 'paid'
    AND EXISTS (
      SELECT 1 FROM fullchinavzla.customer_loyalty_visits visit
      WHERE visit.order_id = o.id AND visit.customer_id = account.customer_id
    );

  IF v_result IS NULL OR jsonb_array_length(COALESCE(v_result->'items', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Este pedido no está disponible para repetirlo';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_customer_order_for_repeat(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_customer_order_for_repeat(UUID) TO authenticated;

COMMIT;
