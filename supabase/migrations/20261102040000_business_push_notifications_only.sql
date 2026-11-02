-- Keep only actionable order notifications; remove generic audit-record pushes.
BEGIN;

ALTER TABLE fullchinavzla.push_notification_outbox
  DROP CONSTRAINT IF EXISTS push_notification_outbox_event_type_check;
ALTER TABLE fullchinavzla.push_notification_outbox
  ADD CONSTRAINT push_notification_outbox_event_type_check
  CHECK (event_type IN ('web_order_new', 'order_created', 'order_paid', 'order_delivered', 'order_fulfillment', 'admin_activity'));

-- Remove generic audit pushes (creation/update/deletion of arbitrary rows).
DO $$
DECLARE v_trigger RECORD;
BEGIN
  IF to_regclass('fullchinavzla.system_activity_logs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS push_admin_activity_created ON fullchinavzla.system_activity_logs';
  END IF;
  FOR v_trigger IN
    SELECT table_namespace.nspname, table_class.relname
    FROM pg_catalog.pg_trigger AS trigger_row
    JOIN pg_catalog.pg_class AS table_class ON table_class.oid = trigger_row.tgrelid
    JOIN pg_catalog.pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'fullchinavzla'
      AND trigger_row.tgname = 'push_admin_table_activity'
      AND NOT trigger_row.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', 'push_admin_table_activity', v_trigger.nspname, v_trigger.relname);
  END LOOP;
END;
$$;

DELETE FROM fullchinavzla.push_notification_outbox
 WHERE event_type = 'admin_activity' AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_order_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_order JSONB := to_jsonb(NEW);
  v_number TEXT := COALESCE(v_order->>'order_number', '?');
  v_kind TEXT := CASE v_order->>'order_type'
    WHEN 'dine-in' THEN 'Mesa ' || COALESCE(v_order->>'table_number', 'sin asignar')
    WHEN 'delivery' THEN 'Delivery'
    ELSE 'Para llevar'
  END;
  v_customer TEXT := left(COALESCE(NULLIF(btrim(v_order->>'customer_name'), ''), 'Cliente'), 70);
  v_notes TEXT := COALESCE(v_order->>'notes', '');
  v_payment_summary TEXT;
  v_paid_total NUMERIC(12,2);
  v_stage TEXT;
  v_stage_title TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Public web requests already receive their own detailed notification.
    IF v_notes LIKE '%[Pedido web WEB-%' THEN RETURN NEW; END IF;
    PERFORM fullchinavzla.fn_enqueue_push_event(
      'order_created', ARRAY['owner', 'manager'],
      jsonb_build_object(
        'title', 'Nueva comanda',
        'body', 'Comanda #' || v_number || ' · ' || v_kind || ' · ' || v_customer,
        'url', '/comandas',
        'tag', 'order-created-' || NEW.id::TEXT
      )
    );
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid' THEN
    SELECT
      string_agg(
        CASE payment_rows.method
          WHEN 'cash' THEN 'Efectivo'
          WHEN 'mobile' THEN 'Pago móvil'
          WHEN 'card' THEN 'Tarjeta'
          WHEN 'transfer' THEN 'Transferencia'
          WHEN 'binance' THEN 'Binance'
          WHEN 'zelle' THEN 'Zelle'
          WHEN 'personal_account' THEN 'Cuenta personal'
          ELSE 'Otro'
        END || ' $' || to_char(payment_rows.amount, 'FM9999999990.00'),
        ' + ' ORDER BY payment_rows.method
      ),
      COALESCE(sum(payment_rows.amount), 0)
    INTO v_payment_summary, v_paid_total
    FROM (
      SELECT payment.method, sum(payment.amount) AS amount
      FROM fullchinavzla.payments AS payment
      WHERE payment.order_id = NEW.id
      GROUP BY payment.method
    ) AS payment_rows;

    PERFORM fullchinavzla.fn_enqueue_push_event(
      'order_paid', ARRAY['owner', 'manager'],
      jsonb_build_object(
        'title', 'Comanda cobrada',
        'body', 'Comanda #' || v_number || ' · ' || v_kind || E'\nCobro: ' ||
          COALESCE(v_payment_summary, 'Método no disponible') || E'\nTotal: $' || to_char(v_paid_total, 'FM9999999990.00'),
        'url', '/comandas',
        'tag', 'order-paid-' || NEW.id::TEXT
      )
    );
  END IF;

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

DROP TRIGGER IF EXISTS push_order_created ON fullchinavzla.orders;
CREATE TRIGGER push_order_created AFTER INSERT ON fullchinavzla.orders
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_order_push();
DROP TRIGGER IF EXISTS push_order_status_changed ON fullchinavzla.orders;
CREATE TRIGGER push_order_status_changed AFTER UPDATE OF status, fulfillment_status ON fullchinavzla.orders
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_order_push();

NOTIFY pgrst, 'reload schema';
COMMIT;