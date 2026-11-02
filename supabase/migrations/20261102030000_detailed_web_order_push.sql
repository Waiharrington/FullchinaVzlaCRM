-- Enrich the single public web-order push after all order lines are persisted.
BEGIN;
CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_web_order_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_kind TEXT := CASE NEW.order_type WHEN 'delivery' THEN 'Delivery' ELSE 'Para llevar' END;
  v_name TEXT := left(btrim(COALESCE(NEW.customer_name, 'Cliente')), 100);
  v_items TEXT;
  v_detail TEXT;
BEGIN
  SELECT string_agg(
    CASE WHEN item.line_number IS NULL THEN
      'Delivery: $' || to_char(item.unit_price * item.quantity, 'FM9999999990.00')
    ELSE
      item.quantity::TEXT || '× ' || left(item.product_name, 80) ||
      CASE WHEN modifier_text.labels IS NULL THEN '' ELSE ' (' || left(modifier_text.labels, 100) || ')' END ||
      ' — $' || to_char(item.unit_price * item.quantity, 'FM9999999990.00')
    END,
    ' · ' ORDER BY item.line_number NULLS LAST, item.created_at, item.id
  )
  INTO v_items
  FROM fullchinavzla.web_order_items AS item
  LEFT JOIN LATERAL (
    SELECT string_agg(
      COALESCE(NULLIF(option_row.value->>'optionName', ''), 'Opción') ||
      CASE WHEN COALESCE(NULLIF(option_row.value->>'quantity', '')::NUMERIC, 1) = 1 THEN ''
           ELSE ' ×' || trim(to_char((option_row.value->>'quantity')::NUMERIC, 'FM999990.###')) END,
      ', ' ORDER BY option_row.ordinality
    ) AS labels
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(item.modifiers) = 'array' THEN item.modifiers ELSE '[]'::JSONB END
    ) WITH ORDINALITY AS option_row(value, ordinality)
  ) AS modifier_text ON true
  WHERE item.request_id = NEW.id;

  v_detail := CASE
    WHEN char_length(COALESCE(v_items, '')) > 700 THEN left(v_items, 697) || '…'
    ELSE COALESCE(v_items, 'Detalle de productos no disponible')
  END;

  PERFORM fullchinavzla.fn_enqueue_push_event(
    'web_order_new', ARRAY['owner', 'manager', 'cashier'],
    jsonb_build_object(
      'title', 'Nuevo pedido web',
      'body', 'WEB-' || lpad(NEW.request_number::TEXT, 6, '0') || ' · ' || v_kind || ' · ' || v_name ||
        E'\nTotal: $' || to_char(NEW.subtotal, 'FM9999999990.00') || E'\n' || v_detail,
      'url', '/comandas',
      'tag', 'web-order-' || NEW.id::TEXT
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_web_order_created ON fullchinavzla.web_order_requests;
CREATE TRIGGER push_web_order_created
  AFTER UPDATE OF customer_identification ON fullchinavzla.web_order_requests
  FOR EACH ROW
  WHEN (OLD.customer_identification IS NULL AND NEW.customer_identification IS NOT NULL)
  EXECUTE FUNCTION fullchinavzla.fn_enqueue_web_order_push();
CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_admin_activity_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, fullchinavzla, pg_temp
AS $$
DECLARE
  v_action TEXT := CASE NEW.action WHEN 'INSERT' THEN 'creó' WHEN 'DELETE' THEN 'eliminó' ELSE 'actualizó' END;
  v_module TEXT := COALESCE(NULLIF(NEW.module, ''), 'Sistema');
  v_label TEXT := NULLIF(NEW.entity_label, '');
BEGIN
  IF NEW.entity_table = 'web_order_requests' THEN RETURN NEW; END IF;
  PERFORM fullchinavzla.fn_enqueue_push_event(
    'admin_activity', ARRAY['owner', 'manager'],
    jsonb_build_object(
      'title', v_module || ' · actividad',
      'body', v_action || ' un registro' || CASE WHEN v_label IS NULL THEN '' ELSE ': ' || left(v_label, 90) END,
      'url', '/auditoria',
      'tag', 'activity-' || NEW.id::TEXT
    )
  );
  RETURN NEW;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
