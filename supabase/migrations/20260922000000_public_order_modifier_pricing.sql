-- Server-authoritative pricing and durable modifier records for public orders.
-- This migration is intentionally local until explicitly reviewed/applied.
BEGIN;

ALTER TABLE fullchinavzla.web_order_items
  ADD COLUMN IF NOT EXISTS line_number INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_order_item_id UUID REFERENCES fullchinavzla.order_items(id);
ALTER TABLE fullchinavzla.web_order_requests
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fingerprint TEXT;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_public_catalog()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=fullchinavzla,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'description',p.description,'price',p.price,'category',p.category,
    'categories',(SELECT jsonb_agg(cat) FROM (
      SELECT p.category AS cat UNION SELECT spc.category_key
      FROM fullchinavzla.sellable_product_categories spc WHERE spc.sellable_product_id=p.id
    ) s),'emoji',p.emoji,'menu_label',p.menu_label,'image_url',p.image_url
  ) ORDER BY p.category,p.name),'[]'::jsonb)
  FROM fullchinavzla.sellable_products p WHERE p.is_active=true AND p.price>=0.50 AND NOT COALESCE(p.is_delivery,false);
$$;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_public_catalog() TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_web_order(
  p_customer_name TEXT, p_customer_phone TEXT, p_order_type TEXT,
  p_delivery_address TEXT, p_notes TEXT, p_items JSONB, p_bcv_rate NUMERIC,
  p_idempotency_key UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_request fullchinavzla.web_order_requests%ROWTYPE;
  v_item JSONB; v_mod JSONB; v_product fullchinavzla.sellable_products%ROWTYPE;
  v_qty INTEGER; v_opt_id UUID; v_opt_qty NUMERIC(12,3); v_opt_price NUMERIC(12,2);
  v_group_id UUID; v_group_min INTEGER; v_group_max INTEGER; v_allow_repeat BOOLEAN;
  v_group_count INTEGER; v_unit_price NUMERIC(12,2); v_subtotal NUMERIC(12,2) := 0;
  v_modifiers JSONB; v_normalized_modifiers JSONB; v_option_name TEXT; v_group_name TEXT;
  v_line INTEGER := 0; v_expected_price NUMERIC(12,2);
  v_price_changed BOOLEAN := false; v_priced_items JSONB := '[]'::jsonb;
  v_fingerprint TEXT;
BEGIN
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Identificador de pedido requerido'; END IF;
  v_fingerprint:=md5(jsonb_build_object(
    'name',btrim(COALESCE(p_customer_name,'')), 'phone',btrim(COALESCE(p_customer_phone,'')),
    'orderType',p_order_type,'address',NULLIF(btrim(COALESCE(p_delivery_address,'')),''),
    'notes',NULLIF(left(btrim(COALESCE(p_notes,'')),500),''),'bcvRate',p_bcv_rate,'items',p_items
  )::text);
  SELECT * INTO v_request FROM fullchinavzla.web_order_requests WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_request.idempotency_fingerprint IS NULL THEN
      RETURN jsonb_build_object('status','legacy_review','id',v_request.id,'code','WEB-'||lpad(v_request.request_number::text,6,'0'),'total',v_request.subtotal);
    END IF;
    IF v_request.idempotency_fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'La clave de reintento pertenece a un pedido diferente'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('lineNumber',line_number,'productId',sellable_product_id,'unitPrice',unit_price) ORDER BY line_number),'[]'::jsonb)
      INTO v_priced_items FROM fullchinavzla.web_order_items WHERE request_id=v_request.id AND line_number IS NOT NULL;
    RETURN jsonb_build_object('status','created','id',v_request.id,'code','WEB-'||lpad(v_request.request_number::text,6,'0'),'total',v_request.subtotal,'items',v_priced_items);
  END IF;
  IF char_length(btrim(COALESCE(p_customer_name,''))) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Nombre invalido'; END IF;
  IF char_length(regexp_replace(COALESCE(p_customer_phone,''),'[^0-9]','','g')) NOT BETWEEN 7 AND 15 THEN RAISE EXCEPTION 'Telefono invalido'; END IF;
  IF p_order_type NOT IN ('takeaway','delivery') THEN RAISE EXCEPTION 'Tipo de pedido invalido'; END IF;
  IF p_order_type='delivery' AND char_length(btrim(COALESCE(p_delivery_address,'')))<8 THEN RAISE EXCEPTION 'Direccion de entrega requerida'; END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Carrito invalido'; END IF;
  IF (SELECT count(*) FROM fullchinavzla.web_order_requests WHERE customer_phone=btrim(p_customer_phone) AND created_at>now()-interval '15 minutes')>=5 THEN RAISE EXCEPTION 'Demasiados pedidos recientes para este telefono'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Cantidad invalida'; END IF;
    SELECT * INTO v_product FROM fullchinavzla.sellable_products WHERE id=(v_item->>'productId')::UUID AND is_active AND price>=0.50 AND NOT COALESCE(is_delivery,false);
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible'; END IF;
    v_unit_price := v_product.price;
    v_modifiers := COALESCE(v_item->'modifiers','[]'::jsonb);
    v_normalized_modifiers := '[]'::jsonb;
    IF jsonb_typeof(v_modifiers)<>'array' THEN RAISE EXCEPTION 'Modificadores invalidos'; END IF;
    IF jsonb_array_length(v_modifiers)>40 THEN RAISE EXCEPTION 'Demasiadas opciones para un producto'; END IF;
    FOR v_mod IN SELECT value FROM jsonb_array_elements(v_modifiers) LOOP
      v_opt_id := (v_mod->>'optionId')::UUID;
      v_opt_qty := COALESCE(NULLIF(v_mod->>'quantity','')::NUMERIC(12,3),1);
      IF v_opt_qty<=0 OR v_opt_qty>30 OR v_opt_qty<>trunc(v_opt_qty) THEN RAISE EXCEPTION 'Cantidad de modificador invalida'; END IF;
      SELECT mo.sale_price, mo.modifier_id, m.allow_repeat, mo.name, m.name INTO v_opt_price,v_group_id,v_allow_repeat,v_option_name,v_group_name
        FROM fullchinavzla.modifier_options mo JOIN fullchinavzla.modifiers m ON m.id=mo.modifier_id
        JOIN fullchinavzla.sellable_product_modifiers spm ON spm.modifier_id=m.id
        WHERE mo.id=v_opt_id AND mo.is_active AND m.is_active AND spm.sellable_product_id=v_product.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Opcion no valida para el producto'; END IF;
      IF NOT v_allow_repeat AND v_opt_qty<>1 THEN RAISE EXCEPTION 'Esta opcion no permite repeticion'; END IF;
      IF NOT v_allow_repeat AND (SELECT count(*) FROM jsonb_array_elements(v_modifiers) AS repeated(value) WHERE (repeated.value->>'optionId')::UUID=v_opt_id)>1 THEN
        RAISE EXCEPTION 'Esta opcion no permite repeticion';
      END IF;
      v_unit_price := v_unit_price + v_opt_price*v_opt_qty;
      v_normalized_modifiers:=v_normalized_modifiers||jsonb_build_array(jsonb_build_object(
        'optionId',v_opt_id,'modifierId',v_group_id,'groupName',v_group_name,'optionName',v_option_name,
        'quantity',v_opt_qty,'unitPrice',v_opt_price
      ));
    END LOOP;
    FOR v_group_id,v_group_min,v_group_max,v_allow_repeat IN
      SELECT m.id,m.min_selections,m.max_selections,m.allow_repeat FROM fullchinavzla.modifiers m
      JOIN fullchinavzla.sellable_product_modifiers spm ON spm.modifier_id=m.id
      WHERE spm.sellable_product_id=v_product.id AND m.is_active
    LOOP
      SELECT COALESCE(sum(COALESCE(NULLIF(mods.value->>'quantity','')::NUMERIC,1)),0)::INTEGER INTO v_group_count
        FROM jsonb_array_elements(v_modifiers) AS mods(value) JOIN fullchinavzla.modifier_options mo ON mo.id=(mods.value->>'optionId')::UUID
        WHERE mo.modifier_id=v_group_id;
      IF v_group_count<v_group_min OR (v_group_max IS NOT NULL AND v_group_count>v_group_max) THEN
        RAISE EXCEPTION 'Seleccion incompleta o excesiva para un grupo de modificadores';
      END IF;
    END LOOP;
    v_subtotal := v_subtotal + v_unit_price*v_qty;
    v_line:=v_line+1;
    v_priced_items:=v_priced_items||jsonb_build_array(jsonb_build_object('lineNumber',v_line,'productId',v_product.id,'unitPrice',v_unit_price));
    IF v_item ? 'expectedUnitPrice' THEN
      BEGIN v_expected_price:=(v_item->>'expectedUnitPrice')::NUMERIC(12,2);
      EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Precio esperado invalido'; END;
      IF v_expected_price IS NULL OR v_expected_price<>v_unit_price THEN v_price_changed:=true; END IF;
    END IF;
  END LOOP;
  IF v_price_changed THEN
    RETURN jsonb_build_object('status','price_changed','total',v_subtotal,'items',v_priced_items);
  END IF;

  INSERT INTO fullchinavzla.web_order_requests(customer_name,customer_phone,order_type,delivery_address,notes,subtotal,bcv_rate,idempotency_key,idempotency_fingerprint)
  VALUES(btrim(p_customer_name),btrim(p_customer_phone),p_order_type,NULLIF(btrim(COALESCE(p_delivery_address,'')),''),NULLIF(left(btrim(COALESCE(p_notes,'')),500),''),v_subtotal,CASE WHEN p_bcv_rate>0 THEN p_bcv_rate ELSE NULL END,p_idempotency_key,v_fingerprint)
  RETURNING * INTO v_request;
  v_line:=0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_line:=v_line+1; v_qty:=(v_item->>'quantity')::INTEGER;
    SELECT * INTO v_product FROM fullchinavzla.sellable_products WHERE id=(v_item->>'productId')::UUID;
    v_unit_price:=v_product.price; v_modifiers:=COALESCE(v_item->'modifiers','[]'::jsonb);
    FOR v_mod IN SELECT value FROM jsonb_array_elements(v_modifiers) LOOP
      SELECT mo.sale_price INTO v_opt_price FROM fullchinavzla.modifier_options mo WHERE mo.id=(v_mod->>'optionId')::UUID;
      v_unit_price:=v_unit_price+v_opt_price*COALESCE(NULLIF(v_mod->>'quantity','')::NUMERIC,1);
    END LOOP;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'optionId',mo.id,'modifierId',m.id,'groupName',m.name,'optionName',mo.name,
      'quantity',COALESCE(NULLIF(mods.value->>'quantity','')::NUMERIC,1),'unitPrice',mo.sale_price
    )),'[]'::jsonb) INTO v_normalized_modifiers
    FROM jsonb_array_elements(v_modifiers) AS mods(value)
    JOIN fullchinavzla.modifier_options mo ON mo.id=(mods.value->>'optionId')::UUID
    JOIN fullchinavzla.modifiers m ON m.id=mo.modifier_id;
    INSERT INTO fullchinavzla.web_order_items(request_id,sellable_product_id,product_name,quantity,unit_price,notes,modifiers,line_number)
    VALUES(v_request.id,v_product.id,v_product.name,v_qty,v_unit_price,NULLIF(left(v_item->>'notes',300),''),v_normalized_modifiers,v_line);
  END LOOP;
  RETURN jsonb_build_object('status','created','id',v_request.id,'code','WEB-'||lpad(v_request.request_number::text,6,'0'),'total',v_request.subtotal,'subtotal',v_request.subtotal,'deliveryFee',0,'items',v_priced_items);
END; $$;

-- Preserve the existing server-side delivery-zone calculation while exposing
-- the exact split used to render the customer's final WhatsApp summary.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_web_order(
  p_customer_name TEXT, p_customer_phone TEXT, p_order_type TEXT,
  p_delivery_address TEXT, p_notes TEXT, p_items JSONB, p_bcv_rate NUMERIC,
  p_idempotency_key UUID, p_delivery_fee NUMERIC, p_delivery_lat NUMERIC,
  p_delivery_lng NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path=fullchinavzla,pg_temp AS $$
DECLARE
  v_result JSONB; v_request_id UUID; v_fee NUMERIC:=0; v_delivery_id UUID; v_total NUMERIC; v_core_subtotal NUMERIC;
  v_origin_lat NUMERIC; v_origin_lng NUMERIC; v_road_factor NUMERIC; v_distance NUMERIC; v_existing_delivery_fingerprint TEXT;
BEGIN
  BEGIN
    v_result:=fullchinavzla.fn_create_web_order(p_customer_name,p_customer_phone,p_order_type,p_delivery_address,p_notes,p_items,p_bcv_rate,p_idempotency_key);
    IF v_result->>'status' IN ('price_changed','legacy_review') THEN RETURN v_result; END IF;
    v_request_id:=(v_result->>'id')::UUID;
    IF p_order_type='delivery' THEN
      SELECT delivery_fingerprint INTO v_existing_delivery_fingerprint FROM fullchinavzla.web_order_requests WHERE id=v_request_id;
      IF v_existing_delivery_fingerprint IS NOT NULL AND v_existing_delivery_fingerprint<>md5(jsonb_build_array(p_delivery_lat,p_delivery_lng)::text) THEN
        RAISE EXCEPTION 'La clave de reintento pertenece a otra ubicacion de entrega';
      END IF;
    END IF;
    IF p_order_type='delivery' THEN
      SELECT origin_lat,origin_lng,road_factor INTO v_origin_lat,v_origin_lng,v_road_factor
        FROM fullchinavzla.delivery_config WHERE id=1 AND is_enabled=true;
      IF v_origin_lat IS NULL OR v_origin_lng IS NULL OR p_delivery_lat IS NULL OR p_delivery_lng IS NULL THEN RAISE EXCEPTION 'Ubicacion de delivery incompleta'; END IF;
      v_distance:=6371*2*asin(LEAST(1,sqrt(
        power(sin(radians((p_delivery_lat-v_origin_lat)/2)),2)+
        cos(radians(v_origin_lat))*cos(radians(p_delivery_lat))*power(sin(radians((p_delivery_lng-v_origin_lng)/2)),2)
      )))*COALESCE(v_road_factor,1);
      SELECT price INTO v_fee FROM fullchinavzla.delivery_zones
        WHERE is_active=true AND v_distance>=min_km AND (max_km IS NULL OR v_distance<=max_km)
        ORDER BY sort_order,min_km LIMIT 1;
      IF v_fee IS NULL THEN RAISE EXCEPTION 'Ubicacion fuera de las zonas de delivery'; END IF;
      IF round(COALESCE(p_delivery_fee,0),2)<>v_fee THEN
        v_core_subtotal:=COALESCE((v_result->>'subtotal')::NUMERIC,(v_result->>'total')::NUMERIC);
        RAISE EXCEPTION USING ERRCODE='PZ001', MESSAGE='El costo de delivery cambio; confirma el nuevo total';
      END IF;
      SELECT id INTO v_delivery_id FROM fullchinavzla.sellable_products WHERE is_delivery=true LIMIT 1;
      IF v_delivery_id IS NULL THEN RAISE EXCEPTION 'No existe el producto de Delivery configurado'; END IF;
      UPDATE fullchinavzla.web_order_requests SET delivery_fee=v_fee,delivery_lat=p_delivery_lat,delivery_lng=p_delivery_lng,
        delivery_fingerprint=COALESCE(delivery_fingerprint,md5(jsonb_build_array(p_delivery_lat,p_delivery_lng)::text)),
        subtotal=subtotal-delivery_fee+v_fee,updated_at=now() WHERE id=v_request_id;
      DELETE FROM fullchinavzla.web_order_items WHERE request_id=v_request_id AND sellable_product_id=v_delivery_id;
      IF v_fee>0 THEN
        INSERT INTO fullchinavzla.web_order_items(request_id,sellable_product_id,product_name,quantity,unit_price)
          VALUES(v_request_id,v_delivery_id,'Delivery',1,v_fee);
      END IF;
      SELECT subtotal INTO v_total FROM fullchinavzla.web_order_requests WHERE id=v_request_id;
      v_result:=jsonb_set(v_result,'{total}',to_jsonb(v_total),true);
      v_result:=jsonb_set(v_result,'{subtotal}',to_jsonb(v_total-v_fee),true);
      v_result:=jsonb_set(v_result,'{deliveryFee}',to_jsonb(v_fee),true);
    ELSE
      v_result:=jsonb_set(v_result,'{subtotal}',v_result->'total',true);
      v_result:=jsonb_set(v_result,'{deliveryFee}','0'::jsonb,true);
    END IF;
  EXCEPTION WHEN SQLSTATE 'PZ001' THEN
    RETURN jsonb_build_object('status','price_changed','total',v_core_subtotal+v_fee,'subtotal',v_core_subtotal,'deliveryFee',v_fee,'items',v_result->'items');
  END;
  RETURN v_result;
END; $$;

-- Keep the public customer-identification overload aligned with the menu:
-- Venezuelan J juridical IDs are valid, and retries cannot mutate an order.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_web_order(
  p_customer_name TEXT, p_customer_phone TEXT, p_customer_identification TEXT,
  p_order_type TEXT, p_delivery_address TEXT, p_notes TEXT, p_items JSONB,
  p_bcv_rate NUMERIC, p_idempotency_key UUID, p_delivery_fee NUMERIC,
  p_delivery_lat NUMERIC, p_delivery_lng NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_result JSONB; v_request_id UUID; v_identification TEXT; v_existing TEXT;
BEGIN
  v_identification:=upper(regexp_replace(btrim(COALESCE(p_customer_identification,'')),'\s+','','g'));
  IF v_identification !~ '^([VEJ]-?)?[0-9]{6,8}$' THEN RAISE EXCEPTION 'Cedula invalida'; END IF;
  SELECT customer_identification INTO v_existing FROM fullchinavzla.web_order_requests WHERE idempotency_key=p_idempotency_key;
  IF FOUND AND v_existing IS NOT NULL AND v_existing<>v_identification THEN RAISE EXCEPTION 'La clave de reintento pertenece a otra solicitud'; END IF;
  v_result:=fullchinavzla.fn_create_web_order(
    p_customer_name,p_customer_phone,p_order_type,p_delivery_address,p_notes,p_items,p_bcv_rate,p_idempotency_key,
    p_delivery_fee,p_delivery_lat,p_delivery_lng
  );
  IF v_result->>'status' IN ('price_changed','legacy_review') THEN RETURN v_result; END IF;
  v_request_id:=(v_result->>'id')::UUID;
  UPDATE fullchinavzla.web_order_requests SET customer_identification=v_identification,updated_at=now()
    WHERE id=v_request_id AND (customer_identification IS NULL OR customer_identification=v_identification);
  IF NOT FOUND THEN RAISE EXCEPTION 'La clave de reintento pertenece a otra solicitud'; END IF;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_confirm_web_order(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE
  v_request fullchinavzla.web_order_requests%ROWTYPE; v_web_item RECORD;
  v_order_id UUID; v_order_number INTEGER; v_customer_id UUID; v_identity_key TEXT;
  v_order_item_id UUID; v_mod JSONB; v_option_id UUID; v_option_qty NUMERIC(12,3); v_option_price NUMERIC(12,2);
  v_legacy_modifier_risk BOOLEAN;
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner','manager','cashier') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_request FROM fullchinavzla.web_order_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_request.converted_order_id IS NOT NULL THEN
    SELECT order_number INTO v_order_number FROM fullchinavzla.orders WHERE id=v_request.converted_order_id;
    RETURN jsonb_build_object('id',v_request.converted_order_id,'orderNumber',v_order_number);
  END IF;
  IF v_request.status<>'pending_confirmation' THEN RAISE EXCEPTION 'La solicitud ya no esta pendiente'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM fullchinavzla.web_order_items wi
    JOIN fullchinavzla.sellable_products p ON p.id=wi.sellable_product_id
    WHERE wi.request_id=v_request.id AND wi.line_number IS NULL AND NOT COALESCE(p.is_delivery,false)
      AND (
        EXISTS (SELECT 1 FROM fullchinavzla.sellable_product_modifiers spm JOIN fullchinavzla.modifiers m ON m.id=spm.modifier_id WHERE spm.sellable_product_id=p.id AND m.is_active)
        OR COALESCE(v_request.notes,'') ILIKE '%Personalizaciones:%'
      )
  ) INTO v_legacy_modifier_risk;
  IF v_legacy_modifier_risk THEN
    RAISE EXCEPTION 'Este pedido es anterior al guardado seguro de opciones. No se convirtió para evitar cobrar o descontar inventario incorrectamente; revisa sus indicaciones y solicita que el cliente vuelva a enviarlo antes de confirmarlo.';
  END IF;
  v_identity_key:=regexp_replace(upper(COALESCE(v_request.customer_identification,'')),'[^A-Z0-9]','','g');
  IF v_identity_key<>'' THEN
    SELECT id INTO v_customer_id FROM fullchinavzla.customers WHERE regexp_replace(upper(COALESCE(identification,'')),'[^A-Z0-9]','','g')=v_identity_key ORDER BY is_active DESC,created_at,id LIMIT 1 FOR UPDATE;
    IF v_customer_id IS NULL THEN
      INSERT INTO fullchinavzla.customers(full_name,identification,phone,address,source_system,source_key,is_active)
      VALUES(btrim(v_request.customer_name),v_request.customer_identification,btrim(v_request.customer_phone),CASE WHEN v_request.order_type='delivery' THEN v_request.delivery_address ELSE NULL END,'public_web',v_identity_key,true) RETURNING id INTO v_customer_id;
    ELSE
      UPDATE fullchinavzla.customers SET full_name=btrim(v_request.customer_name),phone=btrim(v_request.customer_phone),address=CASE WHEN v_request.order_type='delivery' THEN COALESCE(NULLIF(btrim(v_request.delivery_address),''),address) ELSE address END,identification=v_request.customer_identification,is_active=true,updated_at=now() WHERE id=v_customer_id;
    END IF;
  END IF;
  INSERT INTO fullchinavzla.orders(status,notes,created_by,bcv_rate,order_type,customer_name,customer_id)
  VALUES('open',concat_ws(E'\n','[Pedido web WEB-'||lpad(v_request.request_number::text,6,'0')||']',v_request.notes,CASE WHEN v_request.order_type='delivery' THEN 'Direccion: '||v_request.delivery_address END,'Cedula: '||v_request.customer_identification,'Telefono: '||v_request.customer_phone),auth.uid(),v_request.bcv_rate,v_request.order_type,v_request.customer_name,v_customer_id)
  RETURNING id,order_number INTO v_order_id,v_order_number;
  FOR v_web_item IN SELECT * FROM fullchinavzla.web_order_items WHERE request_id=v_request.id ORDER BY line_number NULLS LAST,created_at,id LOOP
    INSERT INTO fullchinavzla.order_items(order_id,sellable_product_id,quantity,unit_price)
    VALUES(v_order_id,v_web_item.sellable_product_id,v_web_item.quantity,v_web_item.unit_price) RETURNING id INTO v_order_item_id;
    UPDATE fullchinavzla.web_order_items SET confirmed_order_item_id=v_order_item_id WHERE id=v_web_item.id;
    FOR v_mod IN SELECT value FROM jsonb_array_elements(COALESCE(v_web_item.modifiers,'[]'::jsonb)) LOOP
      v_option_id:=(v_mod->>'optionId')::UUID; v_option_qty:=COALESCE(NULLIF(v_mod->>'quantity','')::NUMERIC(12,3),1);
      SELECT sale_price INTO v_option_price FROM fullchinavzla.modifier_options WHERE id=v_option_id AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Una opcion de modificador ya no esta disponible'; END IF;
      INSERT INTO fullchinavzla.order_item_modifiers(order_item_id,modifier_option_id,quantity,unit_price)
      VALUES(v_order_item_id,v_option_id,v_option_qty,v_option_price);
    END LOOP;
  END LOOP;
  UPDATE fullchinavzla.orders SET status='confirmed',updated_at=now() WHERE id=v_order_id;
  UPDATE fullchinavzla.web_order_requests SET status='confirmed',converted_order_id=v_order_id,confirmed_by=auth.uid(),confirmed_at=now(),updated_at=now() WHERE id=v_request.id;
  RETURN jsonb_build_object('id',v_order_id,'orderNumber',v_order_number,'customerId',v_customer_id);
END; $$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID,NUMERIC,NUMERIC,NUMERIC) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_confirm_web_order(UUID) TO authenticated,service_role;
COMMIT;
