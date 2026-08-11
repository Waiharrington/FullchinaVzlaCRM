BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_confirm_web_order(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_request fullchinavzla.web_order_requests%ROWTYPE;
  v_order_id UUID;
  v_order_number INTEGER;
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_request
  FROM fullchinavzla.web_order_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  IF v_request.converted_order_id IS NOT NULL THEN
    SELECT order_number INTO v_order_number
    FROM fullchinavzla.orders
    WHERE id = v_request.converted_order_id;
    RETURN jsonb_build_object('id', v_request.converted_order_id, 'orderNumber', v_order_number);
  END IF;

  IF v_request.status <> 'pending_confirmation' THEN
    RAISE EXCEPTION 'La solicitud ya no esta pendiente';
  END IF;

  -- Los items solo pueden insertarse mientras la orden esta abierta.
  INSERT INTO fullchinavzla.orders (
    status, notes, created_by, bcv_rate, order_type, customer_name
  ) VALUES (
    'open',
    concat_ws(E'\n', '[Pedido web ' || 'WEB-' || lpad(v_request.request_number::text, 6, '0') || ']', v_request.notes,
      CASE WHEN v_request.order_type = 'delivery' THEN 'Direccion: ' || v_request.delivery_address ELSE NULL END,
      'Telefono: ' || v_request.customer_phone),
    auth.uid(), v_request.bcv_rate, v_request.order_type, v_request.customer_name
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  INSERT INTO fullchinavzla.order_items (order_id, sellable_product_id, quantity, unit_price)
  SELECT v_order_id, sellable_product_id, quantity, unit_price
  FROM fullchinavzla.web_order_items
  WHERE request_id = v_request.id;

  UPDATE fullchinavzla.orders
  SET status = 'confirmed', updated_at = now()
  WHERE id = v_order_id;

  UPDATE fullchinavzla.web_order_requests
  SET status = 'confirmed', converted_order_id = v_order_id,
      confirmed_by = auth.uid(), confirmed_at = now(), updated_at = now()
  WHERE id = v_request.id;

  RETURN jsonb_build_object('id', v_order_id, 'orderNumber', v_order_number);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_confirm_web_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_confirm_web_order(UUID) TO authenticated, service_role;

COMMIT;
