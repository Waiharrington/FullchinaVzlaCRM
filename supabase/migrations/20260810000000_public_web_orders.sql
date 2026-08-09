-- Public Full China menu and WhatsApp-assisted web orders.
-- Anon can only execute the two whitelisted RPCs below; tables stay private.

BEGIN;

CREATE TABLE IF NOT EXISTS fullchinavzla.web_order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number BIGSERIAL UNIQUE,
  customer_name TEXT NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 100),
  customer_phone TEXT NOT NULL CHECK (char_length(customer_phone) BETWEEN 7 AND 30),
  order_type TEXT NOT NULL CHECK (order_type IN ('takeaway', 'delivery')),
  delivery_address TEXT,
  notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal > 0),
  bcv_rate NUMERIC(14,4) CHECK (bcv_rate IS NULL OR bcv_rate > 0),
  status TEXT NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation', 'confirmed', 'rejected', 'expired')),
  idempotency_key UUID NOT NULL UNIQUE,
  converted_order_id UUID UNIQUE REFERENCES fullchinavzla.orders(id),
  confirmed_by UUID REFERENCES fullchinavzla.profiles(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (order_type <> 'delivery' OR char_length(COALESCE(delivery_address, '')) >= 8)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.web_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES fullchinavzla.web_order_requests(id) ON DELETE CASCADE,
  sellable_product_id UUID NOT NULL REFERENCES fullchinavzla.sellable_products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 30),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_orders_status_created
  ON fullchinavzla.web_order_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_order_items_request
  ON fullchinavzla.web_order_items(request_id);

ALTER TABLE fullchinavzla.web_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.web_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_orders_staff_select ON fullchinavzla.web_order_requests;
CREATE POLICY web_orders_staff_select ON fullchinavzla.web_order_requests
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

DROP POLICY IF EXISTS web_order_items_staff_select ON fullchinavzla.web_order_items;
CREATE POLICY web_order_items_staff_select ON fullchinavzla.web_order_items
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_public_catalog()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'price', p.price,
    'category', p.category,
    'emoji', p.emoji
  ) ORDER BY p.category, p.name), '[]'::jsonb)
  FROM fullchinavzla.sellable_products p
  WHERE p.is_active = true AND p.price > 0;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_web_order(
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_order_type TEXT,
  p_delivery_address TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_bcv_rate NUMERIC,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_request fullchinavzla.web_order_requests%ROWTYPE;
  v_item JSONB;
  v_product fullchinavzla.sellable_products%ROWTYPE;
  v_quantity INTEGER;
  v_subtotal NUMERIC(12,2) := 0;
BEGIN
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Identificador de pedido requerido'; END IF;

  SELECT * INTO v_request FROM fullchinavzla.web_order_requests
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('id', v_request.id, 'code', 'WEB-' || lpad(v_request.request_number::text, 6, '0'), 'total', v_request.subtotal);
  END IF;

  IF char_length(btrim(COALESCE(p_customer_name, ''))) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Nombre invalido'; END IF;
  IF char_length(regexp_replace(COALESCE(p_customer_phone, ''), '\\D', '', 'g')) NOT BETWEEN 7 AND 15 THEN RAISE EXCEPTION 'Telefono invalido'; END IF;
  IF p_order_type NOT IN ('takeaway', 'delivery') THEN RAISE EXCEPTION 'Tipo de pedido invalido'; END IF;
  IF p_order_type = 'delivery' AND char_length(btrim(COALESCE(p_delivery_address, ''))) < 8 THEN RAISE EXCEPTION 'Direccion de entrega requerida'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 40 THEN RAISE EXCEPTION 'Carrito invalido'; END IF;

  IF (SELECT count(*) FROM fullchinavzla.web_order_requests
      WHERE customer_phone = btrim(p_customer_phone)
        AND created_at > now() - interval '15 minutes') >= 5 THEN
    RAISE EXCEPTION 'Demasiados pedidos recientes para este telefono';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;
    IF v_quantity NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Cantidad invalida'; END IF;
    SELECT * INTO v_product FROM fullchinavzla.sellable_products
      WHERE id = (v_item->>'productId')::UUID AND is_active = true AND price > 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible'; END IF;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  END LOOP;

  INSERT INTO fullchinavzla.web_order_requests (
    customer_name, customer_phone, order_type, delivery_address, notes,
    subtotal, bcv_rate, idempotency_key
  ) VALUES (
    btrim(p_customer_name), btrim(p_customer_phone), p_order_type,
    NULLIF(btrim(COALESCE(p_delivery_address, '')), ''),
    NULLIF(left(btrim(COALESCE(p_notes, '')), 500), ''),
    v_subtotal, CASE WHEN p_bcv_rate > 0 THEN p_bcv_rate ELSE NULL END,
    p_idempotency_key
  ) RETURNING * INTO v_request;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;
    SELECT * INTO v_product FROM fullchinavzla.sellable_products
      WHERE id = (v_item->>'productId')::UUID AND is_active = true;
    INSERT INTO fullchinavzla.web_order_items (
      request_id, sellable_product_id, product_name, quantity, unit_price
    ) VALUES (v_request.id, v_product.id, v_product.name, v_quantity, v_product.price);
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_request.id,
    'code', 'WEB-' || lpad(v_request.request_number::text, 6, '0'),
    'total', v_request.subtotal
  );
END;
$$;

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

  SELECT * INTO v_request FROM fullchinavzla.web_order_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_request.converted_order_id IS NOT NULL THEN
    SELECT order_number INTO v_order_number FROM fullchinavzla.orders WHERE id = v_request.converted_order_id;
    RETURN jsonb_build_object('id', v_request.converted_order_id, 'orderNumber', v_order_number);
  END IF;
  IF v_request.status <> 'pending_confirmation' THEN RAISE EXCEPTION 'La solicitud ya no esta pendiente'; END IF;

  INSERT INTO fullchinavzla.orders (
    status, notes, created_by, bcv_rate, order_type, customer_name
  ) VALUES (
    'confirmed', concat_ws(E'\n', '[Pedido web ' || 'WEB-' || lpad(v_request.request_number::text, 6, '0') || ']', v_request.notes,
      CASE WHEN v_request.order_type = 'delivery' THEN 'Direccion: ' || v_request.delivery_address ELSE NULL END,
      'Telefono: ' || v_request.customer_phone),
    auth.uid(), v_request.bcv_rate, v_request.order_type, v_request.customer_name
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  INSERT INTO fullchinavzla.order_items (order_id, sellable_product_id, quantity, unit_price)
  SELECT v_order_id, sellable_product_id, quantity, unit_price
  FROM fullchinavzla.web_order_items WHERE request_id = v_request.id;

  UPDATE fullchinavzla.web_order_requests SET
    status = 'confirmed', converted_order_id = v_order_id,
    confirmed_by = auth.uid(), confirmed_at = now(), updated_at = now()
  WHERE id = v_request.id;

  RETURN jsonb_build_object('id', v_order_id, 'orderNumber', v_order_number);
END;
$$;

REVOKE ALL ON fullchinavzla.web_order_requests, fullchinavzla.web_order_items FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.web_order_requests, fullchinavzla.web_order_items TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE fullchinavzla.web_order_requests_request_number_seq TO service_role;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_public_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_create_web_order(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_confirm_web_order(UUID) FROM PUBLIC;
GRANT USAGE ON SCHEMA fullchinavzla TO anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_public_catalog() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_web_order(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_confirm_web_order(UUID) TO authenticated, service_role;

COMMIT;
