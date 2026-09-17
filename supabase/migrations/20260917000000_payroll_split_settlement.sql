-- Liquidación de nómina pagando desde VARIAS cuentas (pago dividido).
-- Modela la misma lógica que fn_liquidate_payroll_period pero recibe una
-- lista de fuentes [{account_id, amount, rate}] (monto en la moneda de la
-- cuenta; rate obligatorio para cuentas en Bs). Crea un movimiento de salida
-- por cada fuente y valida que la suma (en USD) cuadre con el total.
-- El pago por empleado se registra en USD como "liquidación mixta"; el
-- reparto real por cuenta vive en los movimientos de Finanzas.
BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_liquidate_payroll_period_split(
  p_period_id uuid, p_sources jsonb, p_reference text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_period fullchinavzla.payroll_periods%ROWTYPE;
  v_total_usd NUMERIC(14,2);
  v_assigned_usd NUMERIC(14,2) := 0;
  v_src jsonb;
  v_account fullchinavzla.financial_accounts%ROWTYPE;
  v_amount NUMERIC(14,2);
  v_rate NUMERIC;
  v_src_usd NUMERIC(14,2);
  v_idx INT := 0;
  v_payment_id UUID;
  v_employee RECORD;
  v_employee_usd NUMERIC(14,2);
  v_source_key TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida para liquidar nómina'; END IF;

  SELECT * INTO v_period FROM fullchinavzla.payroll_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El período de nómina no existe'; END IF;
  IF v_period.status = 'paid' THEN
    RETURN json_build_object('ok', true, 'already_paid', true);
  END IF;
  IF v_period.status <> 'open' THEN RAISE EXCEPTION 'Solo se puede liquidar un período abierto'; END IF;

  IF p_sources IS NULL OR jsonb_typeof(p_sources) <> 'array' OR jsonb_array_length(p_sources) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos una cuenta de pago';
  END IF;

  -- Todo delivery pendiente dentro del rango pasa a formar parte de este período.
  UPDATE fullchinavzla.delivery_assignments
  SET payroll_period_id = p_period_id
  WHERE status = 'pending'
    AND assigned_at::date BETWEEN v_period.start_date AND v_period.end_date
    AND payroll_period_id IS NULL;

  SELECT round(COALESCE((SELECT sum(net_pay) FROM fullchinavzla.payroll_entries WHERE payroll_period_id = p_period_id), 0)
    + COALESCE((SELECT sum(employee_amount) FROM fullchinavzla.delivery_assignments WHERE payroll_period_id = p_period_id AND status <> 'cancelled'), 0), 2)
    INTO v_total_usd;
  IF v_total_usd <= 0 THEN RAISE EXCEPTION 'El período no tiene un monto positivo para liquidar'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('payroll-period:' || p_period_id::text));

  -- Un movimiento de salida por cada cuenta indicada.
  FOR v_src IN SELECT * FROM jsonb_array_elements(p_sources)
  LOOP
    v_idx := v_idx + 1;
    SELECT * INTO v_account FROM fullchinavzla.financial_accounts
    WHERE id = (v_src->>'account_id')::uuid AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Una de las cuentas de salida no existe o está inactiva'; END IF;
    v_amount := round((v_src->>'amount')::numeric, 2);
    IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Cada cuenta debe tener un monto mayor que cero'; END IF;
    IF v_account.currency = 'VES' THEN
      v_rate := NULLIF((v_src->>'rate')::numeric, 0);
      IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'La tasa BCV es obligatoria para pagar en bolívares'; END IF;
      v_src_usd := round(v_amount / v_rate, 2);
    ELSE
      v_rate := 1;
      v_src_usd := v_amount;
    END IF;
    v_assigned_usd := v_assigned_usd + v_src_usd;

    INSERT INTO fullchinavzla.financial_operations
      (operation_type, concept, operation_date, amount_usd, original_currency, original_amount,
       exchange_rate, from_account_id, counterparty, reference_number, affects_profit, notes, created_by)
    VALUES
      ('payroll', 'Liquidación de nómina ' || v_period.start_date || ' - ' || v_period.end_date || ' (' || v_account.name || ')',
       CURRENT_DATE, v_src_usd, v_account.currency, v_amount, v_rate, v_account.id,
       'Nómina', 'payroll-period:' || p_period_id::text || ':src:' || v_idx::text, false, NULLIF(trim(p_notes), ''), auth.uid());
  END LOOP;

  IF abs(v_assigned_usd - v_total_usd) > 0.05 THEN
    RAISE EXCEPTION 'La suma de las cuentas (USD %) no coincide con el total a liquidar (USD %)', v_assigned_usd, v_total_usd;
  END IF;

  -- Pago por empleado: su neto, marcado como liquidación mixta (sin cuenta única).
  FOR v_employee IN
    SELECT e.id AS employee_id,
      round(COALESCE((SELECT sum(pe.net_pay) FROM fullchinavzla.payroll_entries pe
        WHERE pe.payroll_period_id = p_period_id AND pe.employee_id = e.id), 0)
        + COALESCE((SELECT sum(da.employee_amount) FROM fullchinavzla.delivery_assignments da
        WHERE da.payroll_period_id = p_period_id AND da.employee_id = e.id AND da.status <> 'cancelled'), 0), 2) AS amount_usd
    FROM fullchinavzla.employees e
    WHERE e.is_active
      AND (EXISTS (SELECT 1 FROM fullchinavzla.payroll_entries pe WHERE pe.payroll_period_id = p_period_id AND pe.employee_id = e.id)
        OR EXISTS (SELECT 1 FROM fullchinavzla.delivery_assignments da WHERE da.payroll_period_id = p_period_id AND da.employee_id = e.id AND da.status <> 'cancelled'))
  LOOP
    v_employee_usd := v_employee.amount_usd;
    IF v_employee_usd <= 0 THEN CONTINUE; END IF;
    v_source_key := 'payroll-period:' || p_period_id::text || ':employee:' || v_employee.employee_id::text;
    INSERT INTO fullchinavzla.payroll_payments
      (payroll_period_id, employee_id, amount, currency, exchange_rate, payment_account, account_id,
       payment_date, reference, notes, created_by, source_system, source_key)
    VALUES (p_period_id, v_employee.employee_id, v_employee_usd, 'USD', 1, 'Varias cuentas', NULL,
       CURRENT_DATE, NULLIF(trim(p_reference), ''), COALESCE(NULLIF(trim(p_notes), ''), 'Liquidación mixta'), auth.uid(), 'payroll', v_source_key)
    ON CONFLICT (source_system, source_key) DO UPDATE SET account_id = EXCLUDED.account_id
    RETURNING id INTO v_payment_id;

    UPDATE fullchinavzla.delivery_assignments
    SET status = 'paid', paid_at = now(), payroll_payment_id = v_payment_id
    WHERE payroll_period_id = p_period_id AND employee_id = v_employee.employee_id AND status <> 'cancelled';
  END LOOP;

  UPDATE fullchinavzla.payroll_periods SET status = 'paid' WHERE id = p_period_id;
  RETURN json_build_object('ok', true, 'total_usd', v_total_usd, 'assigned_usd', v_assigned_usd, 'sources', v_idx);
END;
$function$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_liquidate_payroll_period_split(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_liquidate_payroll_period_split(uuid, jsonb, text, text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;
