BEGIN;

ALTER TABLE fullchinavzla.web_order_requests
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC(10,7);

-- Extiende el RPC público existente sin romper clientes antiguos.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_web_order(
  p_customer_name TEXT, p_customer_phone TEXT, p_order_type TEXT,
  p_delivery_address TEXT, p_notes TEXT, p_items JSONB, p_bcv_rate NUMERIC,
  p_idempotency_key UUID, p_delivery_fee NUMERIC, p_delivery_lat NUMERIC,
  p_delivery_lng NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_result JSONB; v_request_id UUID; v_fee NUMERIC := 0; v_delivery_id UUID; v_total NUMERIC;
  v_origin_lat NUMERIC; v_origin_lng NUMERIC; v_road_factor NUMERIC; v_distance NUMERIC;
BEGIN
  v_result := fullchinavzla.fn_create_web_order(p_customer_name, p_customer_phone, p_order_type, p_delivery_address, p_notes, p_items, p_bcv_rate, p_idempotency_key);
  v_request_id := (v_result->>'id')::UUID;
  IF p_order_type = 'delivery' THEN
    SELECT origin_lat, origin_lng, road_factor INTO v_origin_lat, v_origin_lng, v_road_factor
      FROM fullchinavzla.delivery_config WHERE id = 1 AND is_enabled = true;
    IF v_origin_lat IS NULL OR v_origin_lng IS NULL OR p_delivery_lat IS NULL OR p_delivery_lng IS NULL THEN
      RAISE EXCEPTION 'Ubicacion de delivery incompleta';
    END IF;
    v_distance := 6371 * 2 * asin(LEAST(1, sqrt(
      power(sin(radians((p_delivery_lat - v_origin_lat) / 2)), 2) +
      cos(radians(v_origin_lat)) * cos(radians(p_delivery_lat)) *
      power(sin(radians((p_delivery_lng - v_origin_lng) / 2)), 2)
    ))) * COALESCE(v_road_factor, 1);
    SELECT price INTO v_fee FROM fullchinavzla.delivery_zones
      WHERE is_active = true AND v_distance >= min_km AND (max_km IS NULL OR v_distance <= max_km)
      ORDER BY sort_order, min_km LIMIT 1;
    IF v_fee IS NULL THEN RAISE EXCEPTION 'Ubicacion fuera de las zonas de delivery'; END IF;
    SELECT id INTO v_delivery_id FROM fullchinavzla.sellable_products WHERE is_delivery = true LIMIT 1;
    IF v_delivery_id IS NULL THEN RAISE EXCEPTION 'No existe el producto de Delivery configurado'; END IF;
    UPDATE fullchinavzla.web_order_requests
      SET delivery_fee = v_fee, delivery_lat = p_delivery_lat, delivery_lng = p_delivery_lng,
          subtotal = subtotal - delivery_fee + v_fee, updated_at = now() WHERE id = v_request_id;
    DELETE FROM fullchinavzla.web_order_items
      WHERE request_id = v_request_id AND sellable_product_id = v_delivery_id;
    INSERT INTO fullchinavzla.web_order_items(request_id, sellable_product_id, product_name, quantity, unit_price)
      VALUES (v_request_id, v_delivery_id, 'Delivery', 1, v_fee);
    SELECT subtotal INTO v_total FROM fullchinavzla.web_order_requests WHERE id = v_request_id;
    v_result := jsonb_set(v_result, '{total}', to_jsonb(v_total));
  END IF;
  RETURN v_result;
END; $$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID,NUMERIC,NUMERIC,NUMERIC) TO anon, authenticated, service_role;
COMMIT;
