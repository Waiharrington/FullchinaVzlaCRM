-- Payroll cards use a cumulative employee balance with a month-by-month ledger.
-- No historical payroll rows are rewritten by this migration.
BEGIN;

ALTER TABLE fullchinavzla.payroll_adjustments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON fullchinavzla.payroll_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.payroll_adjustments TO service_role;
DROP POLICY IF EXISTS payroll_adjustments_owner ON fullchinavzla.payroll_adjustments;
CREATE POLICY payroll_adjustments_owner ON fullchinavzla.payroll_adjustments
  FOR ALL USING (fullchinavzla.get_current_user_role() = 'owner')
  WITH CHECK (fullchinavzla.get_current_user_role() = 'owner');

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_payroll_card_payment(
  p_employee_id UUID,
  p_amount NUMERIC,
  p_account_id UUID,
  p_exchange_rate NUMERIC DEFAULT NULL,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_employee employees%ROWTYPE;
  v_account financial_accounts%ROWTYPE;
  v_rate NUMERIC;
  v_amount_usd NUMERIC(14,2);
  v_earned NUMERIC(14,2);
  v_paid NUMERIC(14,2);
  v_pending_advances NUMERIC(14,2);
  v_balance NUMERIC(14,2);
  v_account_balance NUMERIC(14,2);
  v_payment_id UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL OR fullchinavzla.get_current_user_role() <> 'owner' THEN
    RAISE EXCEPTION 'Solo la dueña puede registrar pagos de nómina';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor que cero'; END IF;
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El empleado no existe o está inactivo'; END IF;
  SELECT * INTO v_account FROM financial_accounts WHERE id = p_account_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no existe o está inactiva'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('payroll-card-account:' || p_account_id::text));
  SELECT current_balance INTO v_account_balance FROM fn_get_financial_account_balances() WHERE id = p_account_id;
  IF v_account_balance IS NULL THEN RAISE EXCEPTION 'No se pudo verificar el saldo de la cuenta'; END IF;
  IF p_amount > v_account_balance + 0.01 THEN RAISE EXCEPTION 'La cuenta no tiene saldo suficiente (disponible: %)', v_account_balance; END IF;
  IF v_account.currency = 'VES' THEN
    v_rate := NULLIF(p_exchange_rate, 0);
    IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'La tasa BCV es obligatoria para pagos en bolívares'; END IF;
    v_amount_usd := round(p_amount / v_rate, 2);
  ELSE
    v_rate := 1;
    v_amount_usd := round(p_amount, 2);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('payroll-card:' || p_employee_id::text));
  SELECT
    round(COALESCE((SELECT sum(net_pay) FROM payroll_entries pe JOIN payroll_periods pp ON pp.id = pe.payroll_period_id WHERE pe.employee_id = p_employee_id), 0)
      + COALESCE((SELECT sum(CASE WHEN direction = 'add' THEN amount ELSE -amount END) FROM payroll_adjustments WHERE employee_id = p_employee_id), 0)
      + COALESCE((SELECT sum(employee_amount) FROM delivery_assignments WHERE employee_id = p_employee_id AND status <> 'cancelled'), 0), 2),
    round(COALESCE((SELECT sum(CASE WHEN currency = 'Bs' THEN amount / COALESCE(NULLIF(exchange_rate, 0), 1) ELSE amount END) FROM payroll_payments WHERE employee_id = p_employee_id), 0), 2),
    round(COALESCE((SELECT sum(amount) FROM advances WHERE employee_id = p_employee_id AND NOT is_deducted), 0), 2)
  INTO v_earned, v_paid, v_pending_advances;
  v_balance := round(v_earned - v_paid - v_pending_advances, 2);
  IF v_amount_usd > v_balance + 0.01 THEN
    RAISE EXCEPTION 'El pago supera el saldo pendiente (USD %)', GREATEST(v_balance, 0);
  END IF;

  INSERT INTO payroll_payments
    (id, employee_id, amount, currency, exchange_rate, payment_account, account_id, payment_date, reference, notes, created_by, source_system, source_key)
  VALUES
    (v_payment_id, p_employee_id, p_amount, CASE WHEN v_account.currency = 'VES' THEN 'Bs' ELSE 'USD' END,
     v_rate, v_account.name, v_account.id, COALESCE(p_payment_date, CURRENT_DATE), NULLIF(trim(p_reference), ''),
     NULLIF(trim(p_notes), ''), auth.uid(), 'payroll_card', 'payroll-card-payment:' || v_payment_id::text);

  INSERT INTO financial_operations
    (operation_type, concept, operation_date, amount_usd, original_currency, original_amount, exchange_rate,
     from_account_id, counterparty, reference_number, affects_profit, notes, created_by)
  VALUES
    ('payroll', 'Pago de nómina - ' || v_employee.full_name, COALESCE(p_payment_date, CURRENT_DATE),
     v_amount_usd, v_account.currency, p_amount, v_rate, v_account.id, v_employee.full_name,
     'payroll-card-payment:' || v_payment_id::text, false, NULLIF(trim(p_notes), ''), auth.uid());
  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_record_payroll_card_payment(UUID, NUMERIC, UUID, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_record_payroll_card_payment(UUID, NUMERIC, UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
