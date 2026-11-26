-- Nuevo texto del WhatsApp de confirmación de pedidos web. Solo cambia la
-- redacción: aplica a los pedidos nuevos, no reescribe mensajes ya encolados.
BEGIN;

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
    '• ' || item.quantity::TEXT || 'x ' || regexp_replace(item.product_name, '^(.*?) — (.*)$', '\1 (\2)') || ': ' ||
      'USD ' || fullchinavzla.fn_format_public_order_amount(item.unit_price * item.quantity) ||
      CASE WHEN NULLIF(item.notes, '') IS NULL THEN '' ELSE E'\n  _' || item.notes || '_' END ||
      COALESCE(E'\n  ' || modifier_text.labels, ''),
    E'\n' ORDER BY item.line_number NULLS LAST, item.created_at, item.id
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

  v_message := '¡Hola, ' || v_first_name || '! ' ||
    CASE WHEN NEW.order_type = 'delivery' THEN '🛵' ELSE '🥡' END ||
    ' Este es tu pedido *' || v_code || '*:' || E'\n\n' ||
    '*TU PEDIDO*' || E'\n' || COALESCE(v_item_lines, 'Detalle no disponible') || E'\n\n' ||
    CASE WHEN NEW.order_type = 'delivery' THEN
      'Productos: USD ' || fullchinavzla.fn_format_public_order_amount(NEW.subtotal - COALESCE(NEW.delivery_fee, 0)) || E'\n' ||
      'Delivery: USD ' || fullchinavzla.fn_format_public_order_amount(COALESCE(NEW.delivery_fee, 0)) || E'\n'
    ELSE '' END ||
    '*TOTAL: USD ' || fullchinavzla.fn_format_public_order_amount(NEW.subtotal) || '*' ||
    CASE WHEN NEW.bcv_rate IS NULL THEN '' ELSE E'\nBs. ' ||
      fullchinavzla.fn_format_public_order_amount(NEW.subtotal * NEW.bcv_rate) || ' (tasa BCV)' END || E'\n\n' ||
    CASE WHEN NEW.order_type = 'delivery' THEN
      '*DELIVERY*' ||
      E'\n🏠 ' || COALESCE(NEW.delivery_address, '') ||
      CASE WHEN v_reference IS NULL THEN '' ELSE E'\nReferencia: ' || v_reference END ||
      CASE WHEN v_gps IS NULL THEN '' ELSE E'\n📍 ' || v_gps END
    ELSE
      '*RETIRO EN EL LOCAL*' ||
      CASE WHEN v_pickup IS NULL THEN '' ELSE E'\n🕒 Hora: ' || v_pickup END
    END ||
    CASE WHEN v_payment = '' THEN '' ELSE E'\n💳 Pago: ' || v_payment END ||
    CASE WHEN v_customer_notes = '' THEN '' ELSE E'\n\n📝 *Indicaciones*\n' || v_customer_notes END ||
    E'\n\n*TUS DATOS*\n' || NEW.customer_name || E'\n' ||
    CASE WHEN NEW.customer_identification ~ '^[0-9]' THEN 'C.I. ' ELSE 'Cédula: ' END || NEW.customer_identification || E'\n' ||
    '📱 ' || NEW.customer_phone || E'\n\n' ||
    '👉🏻 *¿Nos confirmas tu pedido?*' || E'\n' || 'O dinos qué quieres cambiar.' || E'\n\n' ||
    '🥢 *FullChina: el mejor arroz chino-venezolano de Aragua* 🔥';

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

COMMIT;
