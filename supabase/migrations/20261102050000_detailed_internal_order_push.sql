-- Send internal order alerts only after their items and payments are committed.
BEGIN;

CREATE TABLE IF NOT EXISTS fullchinavzla.push_order_created_events (
  order_id UUID PRIMARY KEY REFERENCES fullchinavzla.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE fullchinavzla.push_order_created_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fullchinavzla.push_order_created_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_order_created_after_items()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_order fullchinavzla.orders%ROWTYPE;
  v_kind TEXT;
  v_items TEXT;
  v_detail TEXT;
  v_total NUMERIC(12,2);
BEGIN
  IF NEW.id IS DISTINCT FROM (
    SELECT item.id
    FROM fullchinavzla.order_items AS item
    WHERE item.order_id = NEW.order_id
    ORDER BY item.created_at DESC, item.id DESC
    LIMIT 1
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order
  FROM fullchinavzla.orders
  WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1
    FROM fullchinavzla.push_notification_outbox AS event
    WHERE event.event_type = 'order_created'
      AND event.payload->>'tag' = 'order-created-' || v_order.id::TEXT
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO fullchinavzla.push_order_created_events(order_id)
  VALUES (v_order.id)
  ON CONFLICT (order_id) DO NOTHING;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- A web request already has its own detailed web-order notification.
  IF COALESCE(v_order.notes, '') LIKE '%[Pedido web WEB-%' THEN RETURN NULL; END IF;

  v_kind := CASE v_order.order_type
    WHEN 'dine-in' THEN 'Mesa ' || COALESCE(v_order.table_number::TEXT, 'sin asignar')
    WHEN 'delivery' THEN 'Delivery'
    ELSE 'Para llevar'
  END;

  SELECT
    COALESCE(sum(item.quantity * item.unit_price), 0)::NUMERIC(12,2),
    string_agg(
      CASE WHEN COALESCE(product.is_delivery, false) THEN
        'Delivery: $' || to_char(item.quantity * item.unit_price, 'FM9999999990.00')
      ELSE
        trim(to_char(item.quantity, 'FM999990.###')) || '× ' ||
        left(COALESCE(NULLIF(product.name, ''), 'Producto'), 80) ||
        CASE WHEN modifier_summary.names IS NULL THEN '' ELSE ' (' || left(modifier_summary.names, 90) || ')' END ||
        ' — $' || to_char(item.quantity * item.unit_price, 'FM9999999990.00')
      END,
      ' · ' ORDER BY item.created_at, item.id
    )
  INTO v_total, v_items
  FROM fullchinavzla.order_items AS item
  LEFT JOIN fullchinavzla.sellable_products AS product ON product.id = item.sellable_product_id
  LEFT JOIN LATERAL (
    SELECT string_agg(
      modifier_option.name || CASE WHEN modifier.quantity = 1 THEN ''
        ELSE ' ×' || trim(to_char(modifier.quantity, 'FM999990.###')) END,
      ', ' ORDER BY modifier_option.display_order NULLS LAST, modifier_option.name
    ) AS names
    FROM fullchinavzla.order_item_modifiers AS modifier
    JOIN fullchinavzla.modifier_options AS modifier_option ON modifier_option.id = modifier.modifier_option_id
    WHERE modifier.order_item_id = item.id
  ) AS modifier_summary ON true
  WHERE item.order_id = v_order.id;

  v_detail := CASE
    WHEN char_length(COALESCE(v_items, '')) > 650 THEN left(v_items, 647) || '…'
    ELSE COALESCE(v_items, 'Detalle de productos no disponible')
  END;

  PERFORM fullchinavzla.fn_enqueue_push_event(
    'order_created', ARRAY['owner', 'manager'],
    jsonb_build_object(
      'title', 'Nueva comanda',
      'body', 'Comanda #' || v_order.order_number || ' · ' || v_kind || ' · ' ||
        left(COALESCE(NULLIF(btrim(v_order.customer_name), ''), 'Cliente'), 70) || E'\n' || v_detail ||
        E'\nTotal: $' || to_char(v_total, 'FM9999999990.00'),
      'url', '/comandas',
      'tag', 'order-created-' || v_order.id::TEXT
    )
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS push_order_created ON fullchinavzla.orders;
DROP TRIGGER IF EXISTS push_order_created_after_items ON fullchinavzla.order_items;
CREATE CONSTRAINT TRIGGER push_order_created_after_items
  AFTER INSERT ON fullchinavzla.order_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_order_created_after_items();

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_order_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_number TEXT := COALESCE(NEW.order_number::TEXT, '?');
  v_kind TEXT := CASE NEW.order_type
    WHEN 'dine-in' THEN 'Mesa ' || COALESCE(NEW.table_number::TEXT, 'sin asignar')
    WHEN 'delivery' THEN 'Delivery'
    ELSE 'Para llevar'
  END;
  v_customer TEXT := left(COALESCE(NULLIF(btrim(NEW.customer_name), ''), 'Cliente'), 70);
  v_stage TEXT;
  v_stage_title TEXT;
BEGIN
  IF OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status
     AND NEW.fulfillment_status IN ('preparing', 'ready', 'delivered') THEN
    v_stage := CASE NEW.fulfillment_status
      WHEN 'preparing' THEN 'está en preparación'
      WHEN 'ready' THEN 'está lista'
      ELSE 'se marcó como entregada'
    END;
    v_stage_title := CASE NEW.fulfillment_status
      WHEN 'preparing' THEN 'Comanda en preparación'
      WHEN 'ready' THEN 'Comanda lista'
      ELSE 'Comanda entregada'
    END;
    PERFORM fullchinavzla.fn_enqueue_push_event(
      'order_fulfillment', ARRAY['owner', 'manager'],
      jsonb_build_object(
        'title', v_stage_title,
        'body', 'Comanda #' || v_number || ' · ' || v_kind || ' · ' || v_customer || ' ' || v_stage,
        'url', '/comandas',
        'tag', 'order-' || NEW.id::TEXT || '-stage-' || NEW.fulfillment_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_order_status_changed ON fullchinavzla.orders;
DROP TRIGGER IF EXISTS push_order_fulfillment_changed ON fullchinavzla.orders;
CREATE TRIGGER push_order_fulfillment_changed
  AFTER UPDATE OF fulfillment_status ON fullchinavzla.orders
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_order_push();

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_paid_order_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_order fullchinavzla.orders%ROWTYPE;
  v_kind TEXT;
  v_payment_summary TEXT;
  v_payment_count BIGINT;
  v_paid_total NUMERIC(12,2);
BEGIN
  IF NEW.id IS DISTINCT FROM (
    SELECT payment.id
    FROM fullchinavzla.payments AS payment
    WHERE payment.order_id = NEW.order_id
    ORDER BY payment.created_at DESC, payment.id DESC
    LIMIT 1
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order
  FROM fullchinavzla.orders
  WHERE id = NEW.order_id;
  IF NOT FOUND OR v_order.status <> 'paid' THEN RETURN NULL; END IF;

  v_kind := CASE v_order.order_type
    WHEN 'dine-in' THEN 'Mesa ' || COALESCE(v_order.table_number::TEXT, 'sin asignar')
    WHEN 'delivery' THEN 'Delivery'
    ELSE 'Para llevar'
  END;

  SELECT
    string_agg(
      CASE payment.method
        WHEN 'cash' THEN 'Efectivo'
        WHEN 'mobile' THEN 'Pago móvil'
        WHEN 'card' THEN 'Tarjeta'
        WHEN 'transfer' THEN 'Transferencia'
        WHEN 'binance' THEN 'Binance'
        WHEN 'zelle' THEN 'Zelle'
        WHEN 'personal_account' THEN 'Cuenta personal'
        ELSE 'Otro'
      END || ' $' || to_char(payment.amount, 'FM9999999990.00'),
      ' + ' ORDER BY payment.method
    ),
    count(*),
    COALESCE(sum(payment.amount), 0)::NUMERIC(12,2)
  INTO v_payment_summary, v_payment_count, v_paid_total
  FROM (
    SELECT payment_rows.method, sum(payment_rows.amount) AS amount
    FROM fullchinavzla.payments AS payment_rows
    WHERE rows.order_id = NEW.order_id
    GROUP BY payment_rows.method
  ) AS payment;

  PERFORM fullchinavzla.fn_enqueue_push_event(
    'order_paid', ARRAY['owner', 'manager'],
    jsonb_build_object(
      'title', 'Comanda cobrada',
      'body', 'Comanda #' || v_order.order_number || ' · ' || v_kind ||
        E'\n' || CASE WHEN v_payment_count = 1 THEN 'Método: ' ELSE 'Métodos: ' END ||
        COALESCE(v_payment_summary, 'No disponible') ||
        E'\nTotal cobrado: $' || to_char(v_paid_total, 'FM9999999990.00'),
      'url', '/comandas',
      'tag', 'order-paid-' || v_order.id::TEXT
    )
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS push_order_paid_after_payment ON fullchinavzla.payments;
CREATE CONSTRAINT TRIGGER push_order_paid_after_payment
  AFTER INSERT ON fullchinavzla.payments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_paid_order_push();

REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_order_created_after_items() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_paid_order_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_order_push() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;