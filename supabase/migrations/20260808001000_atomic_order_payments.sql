-- =============================================================================
-- FULL CHINA VZLA - PAGOS REALES Y ATOMICOS DESDE COMANDAS
-- =============================================================================
-- Registra pagos simples o combinados en una sola transaccion. La orden pasa a
-- paid exclusivamente cuando la suma registrada cubre exactamente su total.
-- =============================================================================

BEGIN;

ALTER TABLE fullchinavzla.payments
  DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE fullchinavzla.payments
  ADD CONSTRAINT payments_method_check CHECK (method IN (
    'cash', 'mobile', 'card', 'transfer', 'other'
  ));

ALTER TABLE fullchinavzla.payments
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS received_amount NUMERIC(12,2)
    CHECK (received_amount IS NULL OR received_amount > 0);

COMMENT ON COLUMN fullchinavzla.payments.reference_number IS
  'Referencia bancaria para pago movil o transferencia';
COMMENT ON COLUMN fullchinavzla.payments.received_amount IS
  'Monto entregado por el cliente en efectivo; amount es lo aplicado a la orden';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_validate_payment_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_order_status TEXT;
  v_order_total NUMERIC(12,2);
  v_current_paid NUMERIC(12,2);
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a cero';
  END IF;

  IF NEW.method IN ('mobile', 'transfer')
     AND NULLIF(BTRIM(NEW.reference_number), '') IS NULL THEN
    RAISE EXCEPTION 'La referencia es obligatoria para %', NEW.method;
  END IF;

  IF NEW.method = 'cash'
     AND NEW.received_amount IS NOT NULL
     AND NEW.received_amount < NEW.amount THEN
    RAISE EXCEPTION 'El monto recibido no puede ser menor al monto aplicado';
  END IF;

  SELECT o.status,
         COALESCE((
           SELECT SUM(oi.quantity * oi.unit_price)
           FROM fullchinavzla.order_items oi
           WHERE oi.order_id = o.id
         ), 0),
         COALESCE((
           SELECT SUM(p.amount)
           FROM fullchinavzla.payments p
           WHERE p.order_id = o.id
         ), 0)
    INTO v_order_status, v_order_total, v_current_paid
  FROM fullchinavzla.orders o
  WHERE o.id = NEW.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no existe', NEW.order_id;
  END IF;

  IF v_order_status IN ('cancelled', 'paid') THEN
    RAISE EXCEPTION 'No se pueden registrar pagos para una orden en estado %', v_order_status;
  END IF;

  IF v_order_total <= 0 THEN
    RAISE EXCEPTION 'La orden % no tiene un total cobrable', NEW.order_id;
  END IF;

  IF v_current_paid + NEW.amount > v_order_total THEN
    RAISE EXCEPTION 'Sobrepago: total=%, pagado=%, nuevo=%',
      v_order_total, v_current_paid, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_derive_order_status_from_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_total_amount NUMERIC(12,2);
  v_total_paid NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
    INTO v_total_amount
  FROM fullchinavzla.order_items oi
  WHERE oi.order_id = NEW.order_id;

  SELECT COALESCE(SUM(p.amount), 0)
    INTO v_total_paid
  FROM fullchinavzla.payments p
  WHERE p.order_id = NEW.order_id;

  IF v_total_amount > 0 AND v_total_paid = v_total_amount THEN
    UPDATE fullchinavzla.orders
       SET status = 'paid', updated_at = now()
     WHERE id = NEW.order_id
       AND status IN ('open', 'confirmed', 'preparing', 'ready');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_protect_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_total_items NUMERIC(12,2);
  v_total_paid NUMERIC(12,2);
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_role := fullchinavzla.get_current_user_role();

  IF OLD.status IN ('open', 'confirmed', 'preparing', 'ready')
     AND NEW.status = 'paid' THEN
    SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
      INTO v_total_items
    FROM fullchinavzla.order_items oi
    WHERE oi.order_id = NEW.id;

    SELECT COALESCE(SUM(p.amount), 0)
      INTO v_total_paid
    FROM fullchinavzla.payments p
    WHERE p.order_id = NEW.id;

    IF v_total_items > 0 AND v_total_paid = v_total_items THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No se puede marcar la orden % como pagada sin cobertura completa', NEW.id;
  END IF;

  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'Las ordenes pagadas son finales';
  END IF;

  IF v_role IN ('owner', 'manager') THEN
    RETURN NEW;
  END IF;

  IF v_role = 'cashier'
     AND OLD.status = 'open'
     AND NEW.status IN ('confirmed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transicion de estado % a % no permitida para rol %',
    OLD.status, NEW.status, COALESCE(v_role, 'sin perfil');
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_order_payments(
  p_order_id UUID,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
  v_order_status TEXT;
  v_order_total NUMERIC(12,2);
  v_existing_paid NUMERIC(12,2);
  v_batch_total NUMERIC(12,2) := 0;
  v_payment JSONB;
  v_method TEXT;
  v_amount NUMERIC(12,2);
  v_received NUMERIC(12,2);
  v_reference TEXT;
  v_final_status TEXT;
BEGIN
  v_user_id := auth.uid();
  v_role := fullchinavzla.get_current_user_role();

  IF v_user_id IS NULL OR v_role IS NULL
     OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Usuario no autorizado para registrar pagos';
  END IF;

  IF jsonb_typeof(p_payments) <> 'array'
     OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Debe enviar al menos un componente de pago';
  END IF;

  SELECT o.status,
         COALESCE((
           SELECT SUM(oi.quantity * oi.unit_price)
           FROM fullchinavzla.order_items oi
           WHERE oi.order_id = o.id
         ), 0),
         COALESCE((
           SELECT SUM(p.amount)
           FROM fullchinavzla.payments p
           WHERE p.order_id = o.id
         ), 0)
    INTO v_order_status, v_order_total, v_existing_paid
  FROM fullchinavzla.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no existe', p_order_id;
  END IF;

  IF v_order_status IN ('cancelled', 'paid') THEN
    RAISE EXCEPTION 'La orden ya esta %', v_order_status;
  END IF;

  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments)
  LOOP
    BEGIN
      v_method := v_payment->>'method';
      v_amount := (v_payment->>'amount')::NUMERIC(12,2);
      v_received := NULLIF(v_payment->>'receivedAmount', '')::NUMERIC(12,2);
      v_reference := NULLIF(BTRIM(v_payment->>'referenceNumber'), '');
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Monto de pago invalido';
    END;

    IF v_method NOT IN ('cash', 'mobile', 'card', 'transfer', 'other') THEN
      RAISE EXCEPTION 'Metodo de pago invalido: %', COALESCE(v_method, 'null');
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Cada componente de pago debe ser mayor a cero';
    END IF;

    IF v_method IN ('mobile', 'transfer') AND v_reference IS NULL THEN
      RAISE EXCEPTION 'La referencia es obligatoria para %', v_method;
    END IF;

    IF v_method = 'cash' AND v_received IS NOT NULL AND v_received < v_amount THEN
      RAISE EXCEPTION 'El efectivo recibido no cubre su parte del pago';
    END IF;

    v_batch_total := v_batch_total + v_amount;
  END LOOP;

  IF v_existing_paid + v_batch_total <> v_order_total THEN
    RAISE EXCEPTION 'El pago debe completar exactamente el saldo %. Recibido: %',
      v_order_total - v_existing_paid, v_batch_total;
  END IF;

  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO fullchinavzla.payments (
      order_id, method, amount, reference_number, received_amount, notes, created_by
    ) VALUES (
      p_order_id,
      v_payment->>'method',
      (v_payment->>'amount')::NUMERIC(12,2),
      NULLIF(BTRIM(v_payment->>'referenceNumber'), ''),
      NULLIF(v_payment->>'receivedAmount', '')::NUMERIC(12,2),
      COALESCE(NULLIF(BTRIM(v_payment->>'notes'), ''), NULLIF(BTRIM(p_notes), '')),
      v_user_id
    );
  END LOOP;

  SELECT status INTO v_final_status
  FROM fullchinavzla.orders
  WHERE id = p_order_id;

  IF v_final_status <> 'paid' THEN
    RAISE EXCEPTION 'La orden no pudo cerrarse como pagada';
  END IF;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'status', v_final_status,
    'totalPaid', v_existing_paid + v_batch_total,
    'components', jsonb_array_length(p_payments)
  );
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_record_order_payments(UUID, JSONB, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_record_order_payments(UUID, JSONB, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION fullchinavzla.fn_record_order_payments(UUID, JSONB, TEXT) IS
  'Registra atomically pagos simples o combinados y cierra la orden al cubrir el total';

COMMIT;
