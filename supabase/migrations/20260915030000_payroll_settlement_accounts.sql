-- Liquidacion de nomina desde una cuenta financiera.
-- El importe interno de nomina sigue normalizado en USD; cuando se paga en
-- bolivares, payroll_payments.amount guarda el importe original en Bs y
-- exchange_rate permite reconstruir el equivalente en USD.

BEGIN;

ALTER TABLE fullchinavzla.delivery_assignments
  ADD COLUMN IF NOT EXISTS payroll_period_id UUID REFERENCES fullchinavzla.payroll_periods(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payroll_payment_id UUID REFERENCES fullchinavzla.payroll_payments(id) ON DELETE RESTRICT;

ALTER TABLE fullchinavzla.payroll_payments
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES fullchinavzla.financial_accounts(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_payroll_period
  ON fullchinavzla.delivery_assignments(payroll_period_id, status);

ALTER TABLE fullchinavzla.financial_operations
  DROP CONSTRAINT IF EXISTS financial_operations_operation_type_check;
ALTER TABLE fullchinavzla.financial_operations
  ADD CONSTRAINT financial_operations_operation_type_check CHECK (operation_type IN (
    'transfer', 'receivable', 'receivable_collection', 'tip', 'tip_distribution',
    'employee_advance', 'loan', 'loan_payment', 'bank_fee', 'adjustment', 'payroll'
  ));

CREATE OR REPLACE FUNCTION fullchinavzla.fn_liquidate_payroll_period(
  p_period_id UUID,
  p_account_id UUID,
  p_currency TEXT,
  p_exchange_rate NUMERIC DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_period fullchinavzla.payroll_periods%ROWTYPE;
  v_account fullchinavzla.financial_accounts%ROWTYPE;
  v_currency TEXT := CASE WHEN upper(trim(p_currency)) IN ('BS', 'VES') THEN 'VES' ELSE 'USD' END;
  v_rate NUMERIC;
  v_total_usd NUMERIC(14,2);
  v_total_original NUMERIC(14,2);
  v_operation_id UUID;
  v_payment_id UUID;
  v_employee RECORD;
  v_employee_usd NUMERIC(14,2);
  v_employee_original NUMERIC(14,2);
  v_source_key TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida para liquidar nómina'; END IF;

  SELECT * INTO v_period
  FROM fullchinavzla.payroll_periods
  WHERE id = p_period_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El período de nómina no existe'; END IF;
  IF v_period.status = 'paid' THEN
    SELECT id INTO v_operation_id
    FROM fullchinavzla.financial_operations
    WHERE reference_number = 'payroll-period:' || p_period_id::text
    ORDER BY created_at DESC LIMIT 1;
    RETURN json_build_object('ok', true, 'already_paid', true, 'operation_id', v_operation_id);
  END IF;
  IF v_period.status <> 'open' THEN RAISE EXCEPTION 'Solo se puede liquidar un período abierto'; END IF;

  SELECT * INTO v_account
  FROM fullchinavzla.financial_accounts
  WHERE id = p_account_id AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta de salida no existe o está inactiva'; END IF;
  IF v_account.currency <> v_currency THEN
    RAISE EXCEPTION 'La moneda seleccionada no coincide con la cuenta';
  END IF;
  IF v_currency = 'VES' THEN
    v_rate := NULLIF(p_exchange_rate, 0);
    IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'La tasa BCV es obligatoria para pagar en bolívares'; END IF;
  ELSE
    v_rate := COALESCE(NULLIF(p_exchange_rate, 0), 1);
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
  v_total_original := round(CASE WHEN v_currency = 'VES' THEN v_total_usd * v_rate ELSE v_total_usd END, 2);

  v_source_key := 'payroll-period:' || p_period_id::text;
  PERFORM pg_advisory_xact_lock(hashtext(v_source_key));
  SELECT id INTO v_operation_id FROM fullchinavzla.financial_operations
  WHERE reference_number = v_source_key AND status <> 'cancelled' LIMIT 1;
  IF v_operation_id IS NOT NULL THEN
    UPDATE fullchinavzla.payroll_periods SET status = 'paid' WHERE id = p_period_id;
    RETURN json_build_object('ok', true, 'already_paid', true, 'operation_id', v_operation_id);
  END IF;

  INSERT INTO fullchinavzla.financial_operations
    (operation_type, concept, operation_date, amount_usd, original_currency, original_amount,
     exchange_rate, from_account_id, counterparty, reference_number, affects_profit, notes, created_by)
  VALUES
    ('payroll', 'Liquidación de nómina ' || v_period.start_date || ' - ' || v_period.end_date,
     CURRENT_DATE, v_total_usd, v_currency, v_total_original, v_rate, p_account_id,
     'Nómina', v_source_key, false, NULLIF(trim(p_notes), ''), auth.uid())
  RETURNING id INTO v_operation_id;

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
    v_employee_original := round(CASE WHEN v_currency = 'VES' THEN v_employee_usd * v_rate ELSE v_employee_usd END, 2);
    v_source_key := 'payroll-period:' || p_period_id::text || ':employee:' || v_employee.employee_id::text;
    INSERT INTO fullchinavzla.payroll_payments
      (payroll_period_id, employee_id, amount, currency, exchange_rate, payment_account, account_id,
       payment_date, reference, notes, created_by, source_system, source_key)
    VALUES (p_period_id, v_employee.employee_id, v_employee_original,
      CASE WHEN v_currency = 'VES' THEN 'Bs' ELSE 'USD' END, v_rate, v_account.name, p_account_id,
      CURRENT_DATE, NULLIF(trim(p_reference), ''), NULLIF(trim(p_notes), ''), auth.uid(), 'payroll', v_source_key)
    ON CONFLICT (source_system, source_key) DO UPDATE SET account_id = EXCLUDED.account_id
    RETURNING id INTO v_payment_id;

    UPDATE fullchinavzla.delivery_assignments
    SET status = 'paid', paid_at = now(), payroll_payment_id = v_payment_id
    WHERE payroll_period_id = p_period_id AND employee_id = v_employee.employee_id AND status <> 'cancelled';
  END LOOP;

  UPDATE fullchinavzla.payroll_periods SET status = 'paid' WHERE id = p_period_id;
  RETURN json_build_object('ok', true, 'operation_id', v_operation_id,
    'total_usd', v_total_usd, 'total_original', v_total_original, 'currency', v_currency);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_liquidate_payroll_period(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_liquidate_payroll_period(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

COMMIT;
