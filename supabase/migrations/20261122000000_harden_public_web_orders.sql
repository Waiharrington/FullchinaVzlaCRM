-- Endurece la creación pública de pedidos web (/pedir).
--
-- 1. Cierra las versiones antiguas de fn_create_web_order (8 y 11 argumentos):
--    permitían crear pedidos sin cédula y, la de 8, Delivery sin tarifa.
--    La versión pública de 12 argumentos sigue llamándolas internamente; al ser
--    SECURITY DEFINER, esa llamada usa los permisos del propietario.
-- 2. El servidor exige que la tienda esté abierta (mismo horario y estado
--    manual que muestra la página), en hora de Caracas.
-- 3. Rechaza productos ocultos de la carta pública (public_visible = false).
-- 4. Límites contra abuso del bot de WhatsApp: por cédula, por teléfono al día
--    y un freno global por ráfaga. Los reintentos con la misma clave de
--    idempotencia no cuentan y devuelven el pedido ya creado.
-- 5. La tasa BCV enviada por el navegador se contrasta con la última tasa
--    registrada por el personal; si se desvía más de 5 %, se usa la del personal.
--
-- Migración local: aplicar en el VPS solo con autorización explícita y backup.
BEGIN;

REVOKE ALL ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID,NUMERIC,NUMERIC,NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID,NUMERIC,NUMERIC,NUMERIC) TO service_role;

-- Estado de la tienda con la misma regla que PublicMenu.tsx (getStoreClock):
-- forzado abierto/cerrado, o automático por días y horario [apertura, cierre).
CREATE OR REPLACE FUNCTION fullchinavzla.fn_public_order_store_is_open()
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_mode TEXT := 'automatic';
  v_days TEXT := 'Martes a Domingo';
  v_open TEXT := '11:30';
  v_close TEXT := '22:00';
  v_now TIMESTAMP := now() AT TIME ZONE 'America/Caracas';
  v_dow INTEGER;
  v_minutes INTEGER;
  v_first_day INTEGER;
  v_last_day INTEGER;
BEGIN
  SELECT store_status_mode, contact_days, contact_open_time, contact_close_time
    INTO v_mode, v_days, v_open, v_close
    FROM fullchinavzla.public_order_page_settings WHERE id = TRUE;
  v_mode := COALESCE(v_mode, 'automatic');
  IF v_mode = 'open' THEN RETURN TRUE; END IF;
  IF v_mode = 'closed' THEN RETURN FALSE; END IF;

  v_dow := EXTRACT(ISODOW FROM v_now)::INTEGER;
  v_minutes := EXTRACT(HOUR FROM v_now)::INTEGER * 60 + EXTRACT(MINUTE FROM v_now)::INTEGER;
  CASE lower(translate(btrim(COALESCE(v_days, '')), 'áÁ', 'aA'))
    WHEN 'martes a domingo' THEN v_first_day := 2; v_last_day := 7;
    WHEN 'lunes a domingo' THEN v_first_day := 1; v_last_day := 7;
    WHEN 'lunes a sabado' THEN v_first_day := 1; v_last_day := 6;
    WHEN 'lunes a viernes' THEN v_first_day := 1; v_last_day := 5;
    ELSE v_first_day := 1; v_last_day := 7;
  END CASE;
  IF v_dow NOT BETWEEN v_first_day AND v_last_day THEN RETURN FALSE; END IF;

  RETURN v_minutes >= split_part(COALESCE(v_open, '11:30'), ':', 1)::INTEGER * 60 + split_part(COALESCE(v_open, '11:30'), ':', 2)::INTEGER
     AND v_minutes < split_part(COALESCE(v_close, '22:00'), ':', 1)::INTEGER * 60 + split_part(COALESCE(v_close, '22:00'), ':', 2)::INTEGER;
END; $$;
REVOKE ALL ON FUNCTION fullchinavzla.fn_public_order_store_is_open() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_public_order_store_is_open() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_web_order(
  p_customer_name TEXT, p_customer_phone TEXT, p_customer_identification TEXT,
  p_order_type TEXT, p_delivery_address TEXT, p_notes TEXT, p_items JSONB,
  p_bcv_rate NUMERIC, p_idempotency_key UUID, p_delivery_fee NUMERIC,
  p_delivery_lat NUMERIC, p_delivery_lng NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path=fullchinavzla,pg_temp AS $$
DECLARE
  v_result JSONB; v_request_id UUID; v_identification TEXT; v_existing TEXT;
  v_is_retry BOOLEAN; v_phone TEXT; v_hidden_product TEXT;
  v_reference_rate NUMERIC; v_bcv_rate NUMERIC := p_bcv_rate; v_stored_rate NUMERIC;
BEGIN
  v_identification:=upper(regexp_replace(btrim(COALESCE(p_customer_identification,'')),'\s+','','g'));
  IF v_identification !~ '^(([VE]-?)?[0-9]{6,8}|J-?[0-9]{9})$' THEN
    RAISE EXCEPTION 'Revisa tu cédula (6 a 8 dígitos) o tu RIF (J y 9 dígitos).';
  END IF;
  SELECT customer_identification, bcv_rate INTO v_existing, v_stored_rate FROM fullchinavzla.web_order_requests WHERE idempotency_key=p_idempotency_key;
  v_is_retry := FOUND;
  IF v_is_retry AND v_existing IS NOT NULL AND v_existing<>v_identification THEN RAISE EXCEPTION 'La clave de reintento pertenece a otra solicitud'; END IF;
  -- Si el primer intento reemplazó la tasa por la de referencia, el reintento
  -- debe usar esa misma tasa para que coincida la huella de idempotencia.
  IF v_is_retry AND v_stored_rate IS NOT NULL AND v_stored_rate IS DISTINCT FROM p_bcv_rate THEN
    v_bcv_rate := v_stored_rate;
  END IF;

  -- Un reintento del mismo pedido devuelve el registro existente sin volver a
  -- aplicar horario ni límites (por ejemplo, si la red falló justo al cierre).
  IF NOT v_is_retry THEN
    PERFORM fullchinavzla.fn_expire_stale_web_order_requests();
    IF NOT fullchinavzla.fn_public_order_store_is_open() THEN
      RAISE EXCEPTION 'Full China está cerrado en este momento. Revisa el horario e inténtalo cuando abramos.';
    END IF;

    IF jsonb_typeof(p_items) = 'array' THEN
      SELECT p.name INTO v_hidden_product
        FROM jsonb_array_elements(p_items) AS item(value)
        JOIN fullchinavzla.sellable_products p ON p.id::text = item.value->>'productId'
        WHERE NOT COALESCE(p.public_visible, true)
        LIMIT 1;
      IF v_hidden_product IS NOT NULL THEN
        RAISE EXCEPTION '% ya no está disponible en la carta. Quítalo del pedido para continuar.', v_hidden_product;
      END IF;
    END IF;

    v_phone := btrim(COALESCE(p_customer_phone,''));
    IF (SELECT count(*) FROM fullchinavzla.web_order_requests
        WHERE regexp_replace(upper(COALESCE(customer_identification,'')),'[^A-Z0-9]','','g') = regexp_replace(v_identification,'[^A-Z0-9]','','g')
          AND status = 'pending_confirmation' AND created_at > now() - interval '30 minutes') >= 3 THEN
      RAISE EXCEPTION 'Ya tienes varios pedidos esperando confirmación. Responde el WhatsApp de Full China antes de enviar otro.';
    END IF;
    IF (SELECT count(*) FROM fullchinavzla.web_order_requests
        WHERE customer_phone = v_phone AND created_at > now() - interval '24 hours') >= 8 THEN
      RAISE EXCEPTION 'Este número alcanzó el máximo de pedidos web de hoy. Escríbenos por WhatsApp para ayudarte.';
    END IF;
    IF (SELECT count(*) FROM fullchinavzla.web_order_requests WHERE created_at > now() - interval '10 minutes') >= 40 THEN
      RAISE EXCEPTION 'Estamos recibiendo muchos pedidos en este momento. Espera unos minutos e inténtalo de nuevo.';
    END IF;

    -- Tasa de referencia: la última registrada por el personal en una venta
    -- no web de los últimos 3 días. Sin referencia se conserva la enviada.
    SELECT o.bcv_rate INTO v_reference_rate
      FROM fullchinavzla.orders o
      WHERE o.bcv_rate > 0 AND o.created_at > now() - interval '3 days'
        AND COALESCE(o.notes,'') NOT LIKE '[Pedido web%'
      ORDER BY o.created_at DESC LIMIT 1;
    IF v_reference_rate IS NOT NULL
       AND (v_bcv_rate IS NULL OR v_bcv_rate <= 0 OR abs(v_bcv_rate - v_reference_rate) / v_reference_rate > 0.05) THEN
      v_bcv_rate := v_reference_rate;
    END IF;
  END IF;

  v_result:=fullchinavzla.fn_create_web_order(
    p_customer_name,p_customer_phone,p_order_type,p_delivery_address,p_notes,p_items,v_bcv_rate,p_idempotency_key,
    p_delivery_fee,p_delivery_lat,p_delivery_lng
  );
  IF v_result->>'status' IN ('price_changed','legacy_review') THEN RETURN v_result; END IF;
  IF NOT v_is_retry AND COALESCE((v_result->>'subtotal')::NUMERIC,(v_result->>'total')::NUMERIC,0) < 1 THEN
    RAISE EXCEPTION 'El pedido mínimo es de USD 1,00 en productos.';
  END IF;
  v_request_id:=(v_result->>'id')::UUID;
  UPDATE fullchinavzla.web_order_requests SET customer_identification=v_identification,updated_at=now()
    WHERE id=v_request_id AND (customer_identification IS NULL OR customer_identification=v_identification);
  IF NOT FOUND THEN RAISE EXCEPTION 'La clave de reintento pertenece a otra solicitud'; END IF;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID,NUMERIC,NUMERIC,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,NUMERIC,UUID,NUMERIC,NUMERIC,NUMERIC) TO anon,authenticated,service_role;

-- 6. Las solicitudes web sin confirmar vencen a la medianoche (hora de Caracas).
CREATE OR REPLACE FUNCTION fullchinavzla.fn_web_order_today_start()
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
  SELECT date_trunc('day', now() AT TIME ZONE 'America/Caracas') AT TIME ZONE 'America/Caracas'
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_expire_stale_web_order_requests()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE fullchinavzla.web_order_requests
    SET status = 'expired', updated_at = now()
    WHERE status = 'pending_confirmation' AND created_at < fullchinavzla.fn_web_order_today_start();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION fullchinavzla.fn_expire_stale_web_order_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_expire_stale_web_order_requests() TO authenticated, service_role;

-- Aunque nadie haya ejecutado la limpieza, no se puede confirmar una solicitud de un día anterior.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_guard_expired_web_order_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF OLD.status = 'pending_confirmation' AND NEW.status = 'confirmed'
     AND OLD.created_at < fullchinavzla.fn_web_order_today_start() THEN
    RAISE EXCEPTION 'Esta solicitud venció a la medianoche y ya no se puede confirmar. Pide al cliente que haga un pedido nuevo.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_expired_web_order_confirmation ON fullchinavzla.web_order_requests;
CREATE TRIGGER guard_expired_web_order_confirmation
  BEFORE UPDATE OF status ON fullchinavzla.web_order_requests
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_guard_expired_web_order_confirmation();

-- 7. El WhatsApp al cliente muestra la hora de retiro elegida y no repite
--    los metadatos (referencia, GPS, pago, hora) dentro de las indicaciones.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_public_order_whatsapp_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_created_by UUID;
  v_first_name TEXT := split_part(btrim(NEW.customer_name), ' ', 1);
  v_code TEXT := 'WEB-' || lpad(NEW.request_number::TEXT, 6, '0');
  v_separator TEXT := '━━━━━━━━━━━━━━';
  v_item_lines TEXT;
  v_customer_phone TEXT := regexp_replace(NEW.customer_phone, '\D', '', 'g');
  v_payment TEXT;
  v_reference TEXT;
  v_gps TEXT;
  v_pickup TEXT;
  v_customer_notes TEXT;
  v_message TEXT;
BEGIN
  IF NEW.status <> 'pending_confirmation' OR NEW.customer_identification IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_created_by FROM fullchinavzla.profiles ORDER BY created_at LIMIT 1;
  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'No existe un perfil para registrar la confirmación de WhatsApp';
  END IF;

  SELECT string_agg(
    '• *' || item.quantity::TEXT || 'x ' || item.product_name || '* — ' ||
      'USD ' || fullchinavzla.fn_format_public_order_amount(item.unit_price * item.quantity) ||
      CASE WHEN NULLIF(item.notes, '') IS NULL THEN '' ELSE E'\n  _' || item.notes || '_' END ||
      COALESCE(E'\n  ' || modifier_text.labels, ''),
    E'\n\n' ORDER BY item.line_number NULLS LAST, item.created_at, item.id
  ) INTO v_item_lines
  FROM fullchinavzla.web_order_items item
  LEFT JOIN LATERAL (
    SELECT string_agg(
      COALESCE(option_row.value->>'optionName', 'Opción') ||
        CASE WHEN COALESCE(NULLIF(option_row.value->>'quantity', '')::NUMERIC, 1) = 1 THEN ''
             ELSE ' ×' || trim(to_char((option_row.value->>'quantity')::NUMERIC, 'FM999990.###')) END,
      ', ' ORDER BY option_row.ordinality
    ) AS labels
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(item.modifiers) = 'array' THEN item.modifiers ELSE '[]'::JSONB END)
      WITH ORDINALITY AS option_row(value, ordinality)
  ) modifier_text ON true
  WHERE item.request_id = NEW.id AND NOT EXISTS (
    SELECT 1 FROM fullchinavzla.sellable_products p
    WHERE p.id = item.sellable_product_id AND p.is_delivery
  );

  v_payment := (regexp_match(COALESCE(NEW.notes, ''), 'Pago preferido: ([a-z_]+(?:\+[a-z_]+)?)', 'i'))[1];
  IF position('+' IN COALESCE(v_payment, '')) > 0 THEN
    v_payment := CASE split_part(v_payment, '+', 1)
      WHEN 'cash' THEN 'Efectivo' WHEN 'mobile' THEN 'Pago móvil'
      WHEN 'transfer' THEN 'Transferencia' WHEN 'card' THEN 'Punto' WHEN 'binance' THEN 'Binance'
      ELSE split_part(v_payment, '+', 1) END || ' + ' ||
      CASE split_part(v_payment, '+', 2)
      WHEN 'cash' THEN 'Efectivo' WHEN 'mobile' THEN 'Pago móvil'
      WHEN 'transfer' THEN 'Transferencia' WHEN 'card' THEN 'Punto' WHEN 'binance' THEN 'Binance'
      ELSE split_part(v_payment, '+', 2) END;
  ELSE
    v_payment := CASE v_payment
      WHEN 'cash' THEN 'Efectivo' WHEN 'mobile' THEN 'Pago móvil'
      WHEN 'transfer' THEN 'Transferencia' WHEN 'card' THEN 'Punto' WHEN 'binance' THEN 'Binance'
      ELSE COALESCE(v_payment, '') END;
  END IF;
  v_reference := (regexp_match(COALESCE(NEW.notes, ''), 'Referencia: ([^·\n]+)', 'i'))[1];
  v_gps := (regexp_match(COALESCE(NEW.notes, ''), 'Ubicación GPS: ([^·\n]+)', 'i'))[1];
  v_pickup := (regexp_match(COALESCE(NEW.notes, ''), 'Hora de retiro: ([^\n]+)', 'i'))[1];
  v_customer_notes := btrim(regexp_replace(COALESCE(NEW.notes, ''), '\n(Referencia|Ubicación GPS|Pago preferido|Hora de retiro):[^\n]*', '', 'gi'));
  IF v_customer_notes ~* '^Referencia:' THEN
    v_customer_notes := regexp_replace(v_customer_notes, '^Referencia:[^·]*( · )?', '', 'i');
  END IF;
  v_customer_notes := btrim(regexp_replace(v_customer_notes, '(^| · )(Personalizaciones:|Ubicación GPS:|Pago preferido:).*$', '', 'i'));

  v_message := 'Hola ' || v_first_name || ', aquí está tu pedido *' || v_code || '*.' || E'\n\n' ||
    '━━━━━━━━━━━━━━' || E'\n' || '*🥡 RESUMEN DEL PEDIDO*' || E'\n\n' ||
    COALESCE(v_item_lines, 'Detalle no disponible') || E'\n' || v_separator || E'\n' ||
    '*💰 RESUMEN DE PAGO*' || E'\n\n' ||
    'Subtotal productos: USD ' || fullchinavzla.fn_format_public_order_amount(NEW.subtotal - COALESCE(NEW.delivery_fee, 0)) || E'\n' ||
    'Delivery: ' || CASE WHEN NEW.order_type = 'delivery' THEN 'USD ' || fullchinavzla.fn_format_public_order_amount(COALESCE(NEW.delivery_fee, 0)) ELSE 'No aplica' END || E'\n' ||
    '*Total del pedido: USD ' || fullchinavzla.fn_format_public_order_amount(NEW.subtotal) || '*' ||
    CASE WHEN NEW.bcv_rate IS NULL THEN '' ELSE E'\n*Referencia BCV: Bs. ' ||
      fullchinavzla.fn_format_public_order_amount(NEW.subtotal * NEW.bcv_rate) || '*' END || E'\n\n' ||
    v_separator || E'\n' || '*👤 DATOS DEL CLIENTE*' || E'\n\n' ||
    'Nombre: ' || NEW.customer_name || E'\n' || 'Teléfono: ' || NEW.customer_phone || E'\n' ||
    'Cédula: ' || NEW.customer_identification || E'\n' ||
    CASE WHEN v_payment = '' THEN '' ELSE '💳 Pago: ' || v_payment || E'\n' END ||
    'Modalidad: ' || CASE WHEN NEW.order_type = 'delivery' THEN '🛵 Delivery' ELSE '🥡 Retiro en el local' END ||
    CASE WHEN NEW.order_type = 'delivery' OR v_pickup IS NULL THEN '' ELSE E'\n🕒 Hora de retiro: ' || v_pickup END ||
    CASE WHEN NEW.order_type = 'delivery' THEN E'\n\n🏠 ' || COALESCE(NEW.delivery_address, '') ELSE '' END ||
    CASE WHEN v_reference IS NULL THEN '' ELSE E'\nReferencia: ' || v_reference END ||
    CASE WHEN v_gps IS NULL THEN '' ELSE E'\n\n📍 Ubicación:\n' || v_gps END ||
    CASE WHEN v_customer_notes = '' THEN '' ELSE E'\n\n' || v_separator || E'\n*📝 INDICACIONES*' || E'\n\n' || v_customer_notes END ||
    E'\n\n' || v_separator || E'\n' || 'Nos lo confirmas por favor.';

  IF length(v_customer_phone) = 10 THEN v_customer_phone := '58' || v_customer_phone; END IF;
  IF length(v_customer_phone) = 11 AND left(v_customer_phone, 1) = '0' THEN
    v_customer_phone := '58' || right(v_customer_phone, 10);
  END IF;

  INSERT INTO fullchinavzla.whatsapp_messages
    (template_type, phone, message, status, created_by, web_order_request_id)
  VALUES
    ('web_order_confirmation', v_customer_phone, v_message, 'queued', v_created_by, NEW.id)
  ON CONFLICT (web_order_request_id) WHERE web_order_request_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

SELECT fullchinavzla.fn_expire_stale_web_order_requests();

COMMIT;
