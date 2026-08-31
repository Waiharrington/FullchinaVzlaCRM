BEGIN;

ALTER TABLE fullchinavzla.web_order_requests
  ADD COLUMN IF NOT EXISTS customer_identification TEXT;

-- Nueva firma pública: conserva las anteriores y agrega la cédula.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_web_order(
  p_customer_name TEXT, p_customer_phone TEXT, p_customer_identification TEXT,
  p_order_type TEXT, p_delivery_address TEXT, p_notes TEXT, p_items JSONB,
  p_bcv_rate NUMERIC, p_idempotency_key UUID, p_delivery_fee NUMERIC,
  p_delivery_lat NUMERIC, p_delivery_lng NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_result JSONB; v_request_id UUID; v_identification TEXT;
BEGIN
  v_identification := upper(regexp_replace(btrim(COALESCE(p_customer_identification, '')), '\s+', '', 'g'));
  IF v_identification !~ '^(V-?|E-?)?[0-9]{6,10}$' THEN
    RAISE EXCEPTION 'Cedula invalida';
  END IF;
  v_result := fullchinavzla.fn_create_web_order(
    p_customer_name, p_customer_phone, p_order_type, p_delivery_address,
    p_notes, p_items, p_bcv_rate, p_idempotency_key, p_delivery_fee,
    p_delivery_lat, p_delivery_lng
  );
  v_request_id := (v_result->>'id')::UUID;
  UPDATE fullchinavzla.web_order_requests
    SET customer_identification = v_identification, updated_at = now()
    WHERE id = v_request_id;
  RETURN v_result;
END; $$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID,NUMERIC,NUMERIC,NUMERIC)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_confirm_web_order(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_request fullchinavzla.web_order_requests%ROWTYPE;
  v_order_id UUID; v_order_number INTEGER; v_customer_id UUID; v_identity_key TEXT;
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT * INTO v_request FROM fullchinavzla.web_order_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_request.converted_order_id IS NOT NULL THEN
    SELECT order_number INTO v_order_number FROM fullchinavzla.orders WHERE id = v_request.converted_order_id;
    RETURN jsonb_build_object('id', v_request.converted_order_id, 'orderNumber', v_order_number);
  END IF;
  IF v_request.status <> 'pending_confirmation' THEN RAISE EXCEPTION 'La solicitud ya no esta pendiente'; END IF;

  v_identity_key := regexp_replace(upper(COALESCE(v_request.customer_identification, '')), '[^A-Z0-9]', '', 'g');
  IF v_identity_key <> '' THEN
    SELECT id INTO v_customer_id FROM fullchinavzla.customers
      WHERE regexp_replace(upper(COALESCE(identification, '')), '[^A-Z0-9]', '', 'g') = v_identity_key
      ORDER BY is_active DESC, created_at, id LIMIT 1 FOR UPDATE;

    IF v_customer_id IS NULL THEN
      INSERT INTO fullchinavzla.customers(full_name, identification, phone, address, source_system, source_key, is_active)
      VALUES (btrim(v_request.customer_name), v_request.customer_identification, btrim(v_request.customer_phone),
        CASE WHEN v_request.order_type = 'delivery' THEN v_request.delivery_address ELSE NULL END,
        'public_web', v_identity_key, true)
      RETURNING id INTO v_customer_id;
    ELSE
      UPDATE fullchinavzla.customers SET
        full_name = btrim(v_request.customer_name), phone = btrim(v_request.customer_phone),
        address = CASE WHEN v_request.order_type = 'delivery' THEN COALESCE(NULLIF(btrim(v_request.delivery_address), ''), address) ELSE address END,
        identification = v_request.customer_identification, is_active = true, updated_at = now()
      WHERE id = v_customer_id;
    END IF;
  END IF;

  INSERT INTO fullchinavzla.orders(status, notes, created_by, bcv_rate, order_type, customer_name, customer_id)
  VALUES ('open', concat_ws(E'\n', '[Pedido web ' || 'WEB-' || lpad(v_request.request_number::text, 6, '0') || ']', v_request.notes,
    CASE WHEN v_request.order_type = 'delivery' THEN 'Direccion: ' || v_request.delivery_address ELSE NULL END,
    'Cedula: ' || v_request.customer_identification, 'Telefono: ' || v_request.customer_phone),
    auth.uid(), v_request.bcv_rate, v_request.order_type, v_request.customer_name, v_customer_id)
  RETURNING id, order_number INTO v_order_id, v_order_number;

  INSERT INTO fullchinavzla.order_items(order_id, sellable_product_id, quantity, unit_price)
  SELECT v_order_id, sellable_product_id, quantity, unit_price FROM fullchinavzla.web_order_items WHERE request_id = v_request.id;
  UPDATE fullchinavzla.orders SET status = 'confirmed', updated_at = now() WHERE id = v_order_id;
  UPDATE fullchinavzla.web_order_requests SET status = 'confirmed', converted_order_id = v_order_id,
    confirmed_by = auth.uid(), confirmed_at = now(), updated_at = now() WHERE id = v_request.id;
  RETURN jsonb_build_object('id', v_order_id, 'orderNumber', v_order_number, 'customerId', v_customer_id);
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_confirm_web_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_confirm_web_order(UUID) TO authenticated, service_role;

COMMIT;
