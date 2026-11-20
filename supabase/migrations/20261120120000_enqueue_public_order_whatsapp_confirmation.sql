-- Send the public order summary to the customer's WhatsApp through the bot.
-- The status transition happens only after all order data has been persisted.
BEGIN;

ALTER TABLE fullchinavzla.whatsapp_messages
  ADD COLUMN IF NOT EXISTS web_order_request_id UUID
  REFERENCES fullchinavzla.web_order_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_web_order_request
  ON fullchinavzla.whatsapp_messages(web_order_request_id)
  WHERE web_order_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_format_public_order_amount(p_amount NUMERIC)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT replace(
    replace(replace(to_char(p_amount, 'FM999,999,999,990.00'), ',', chr(1)), '.', ','),
    chr(1), '.'
  )
$$;

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
  v_customer_notes := btrim(COALESCE(NEW.notes, ''));
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

DROP TRIGGER IF EXISTS enqueue_public_order_whatsapp_confirmation ON fullchinavzla.web_order_requests;
CREATE TRIGGER enqueue_public_order_whatsapp_confirmation
  AFTER UPDATE OF customer_identification ON fullchinavzla.web_order_requests
  FOR EACH ROW
  WHEN (OLD.customer_identification IS NULL AND NEW.customer_identification IS NOT NULL)
  EXECUTE FUNCTION fullchinavzla.fn_enqueue_public_order_whatsapp_confirmation();

COMMENT ON COLUMN fullchinavzla.whatsapp_messages.web_order_request_id IS
  'Solicitud web asociada a la confirmación enviada al cliente por WhatsApp; evita duplicados.';

COMMIT;
