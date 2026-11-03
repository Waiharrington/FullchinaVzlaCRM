BEGIN;
SET LOCAL search_path = fullchinavzla, pg_temp;

-- Fixes a qualified-column typo in the deferred paid-order notification trigger.
-- The old reference to `rows.order_id` raised 42P01 during payment commit,
-- rolling back the payment even though fn_record_order_payments had run.
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
    WHERE payment_rows.order_id = NEW.order_id
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

REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_paid_order_push() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
