-- Adelantos y bonos deben registrar la cuenta de salida y su movimiento financiero.
-- Los importes de advances/production_bonuses siguen normalizados a USD; el
-- importe original conserva lo que realmente salió de la cuenta seleccionada.

BEGIN;

ALTER TABLE fullchinavzla.advances
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES fullchinavzla.financial_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency IN ('USD', 'VES')),
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS financial_operation_id UUID REFERENCES fullchinavzla.financial_operations(id) ON DELETE RESTRICT;

ALTER TABLE fullchinavzla.production_bonuses
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES fullchinavzla.financial_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS currency TEXT CHECK (currency IN ('USD', 'VES')),
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS financial_operation_id UUID REFERENCES fullchinavzla.financial_operations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_advances_account ON fullchinavzla.advances(account_id);
CREATE INDEX IF NOT EXISTS idx_production_bonuses_account ON fullchinavzla.production_bonuses(account_id);

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_employee_advance(
  p_employee_id UUID,
  p_original_amount NUMERIC,
  p_account_id UUID,
  p_exchange_rate NUMERIC DEFAULT NULL,
  p_advance_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_employee employees%ROWTYPE;
  v_account financial_accounts%ROWTYPE;
  v_id UUID := gen_random_uuid();
  v_operation_id UUID;
  v_rate NUMERIC;
  v_amount_usd NUMERIC(14,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida para registrar un adelanto'; END IF;
  IF p_original_amount IS NULL OR p_original_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor que cero'; END IF;
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El empleado no existe o está inactivo'; END IF;
  SELECT * INTO v_account FROM financial_accounts WHERE id = p_account_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta de salida no existe o está inactiva'; END IF;
  IF v_account.currency = 'VES' THEN
    v_rate := NULLIF(p_exchange_rate, 0);
    IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'La tasa BCV es obligatoria para adelantos en bolívares'; END IF;
    v_amount_usd := round(p_original_amount / v_rate, 2);
  ELSE
    v_rate := 1;
    v_amount_usd := round(p_original_amount, 2);
  END IF;

  INSERT INTO advances (id, employee_id, amount, advance_date, notes, created_by, account_id, currency, original_amount, exchange_rate)
  VALUES (v_id, p_employee_id, v_amount_usd, COALESCE(p_advance_date, CURRENT_DATE), NULLIF(trim(p_notes), ''), auth.uid(), v_account.id, v_account.currency, p_original_amount, v_rate);
  INSERT INTO financial_operations
    (operation_type, concept, operation_date, amount_usd, original_currency, original_amount, exchange_rate,
     from_account_id, counterparty, reference_number, affects_profit, notes, created_by)
  VALUES
    ('employee_advance', 'Adelanto de salario - ' || v_employee.full_name, COALESCE(p_advance_date, CURRENT_DATE),
     v_amount_usd, v_account.currency, p_original_amount, v_rate, v_account.id, v_employee.full_name,
     'employee-advance:' || v_id::text, false, NULLIF(trim(p_notes), ''), auth.uid())
  RETURNING id INTO v_operation_id;
  UPDATE advances SET financial_operation_id = v_operation_id WHERE id = v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_production_bonus(
  p_employee_id UUID,
  p_original_amount NUMERIC,
  p_account_id UUID,
  p_exchange_rate NUMERIC DEFAULT NULL,
  p_bonus_date DATE DEFAULT CURRENT_DATE,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_employee employees%ROWTYPE;
  v_account financial_accounts%ROWTYPE;
  v_id UUID := gen_random_uuid();
  v_operation_id UUID;
  v_rate NUMERIC;
  v_amount_usd NUMERIC(14,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida para registrar un bono'; END IF;
  IF p_original_amount IS NULL OR p_original_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor que cero'; END IF;
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El empleado no existe o está inactivo'; END IF;
  SELECT * INTO v_account FROM financial_accounts WHERE id = p_account_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta de salida no existe o está inactiva'; END IF;
  IF v_account.currency = 'VES' THEN
    v_rate := NULLIF(p_exchange_rate, 0);
    IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'La tasa BCV es obligatoria para bonos en bolívares'; END IF;
    v_amount_usd := round(p_original_amount / v_rate, 2);
  ELSE
    v_rate := 1;
    v_amount_usd := round(p_original_amount, 2);
  END IF;

  INSERT INTO production_bonuses (id, employee_id, amount, bonus_date, reason, created_by, account_id, currency, original_amount, exchange_rate)
  VALUES (v_id, p_employee_id, v_amount_usd, COALESCE(p_bonus_date, CURRENT_DATE), NULLIF(trim(p_reason), ''), auth.uid(), v_account.id, v_account.currency, p_original_amount, v_rate);
  INSERT INTO financial_operations
    (operation_type, concept, operation_date, amount_usd, original_currency, original_amount, exchange_rate,
     from_account_id, counterparty, reference_number, affects_profit, notes, created_by)
  VALUES
    ('payroll', 'Bono de producción - ' || v_employee.full_name, COALESCE(p_bonus_date, CURRENT_DATE),
     v_amount_usd, v_account.currency, p_original_amount, v_rate, v_account.id, v_employee.full_name,
     'production-bonus:' || v_id::text, false, NULLIF(trim(p_reason), ''), auth.uid())
  RETURNING id INTO v_operation_id;
  UPDATE production_bonuses SET financial_operation_id = v_operation_id WHERE id = v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_create_employee_advance(UUID, NUMERIC, UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_create_production_bonus(UUID, NUMERIC, UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_employee_advance(UUID, NUMERIC, UUID, NUMERIC, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_production_bonus(UUID, NUMERIC, UUID, NUMERIC, DATE, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
