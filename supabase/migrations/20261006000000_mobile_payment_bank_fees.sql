-- Registra la comisión de Pago Móvil como débito bancario separado.
-- La tarifa sugerida se calcula en el cliente (0,3%, mínimo Bs. 14); se guarda
-- el importe confirmado por el operador para permitir ajustes manuales.
BEGIN;

ALTER TABLE fullchinavzla.purchase_payments
  ADD COLUMN IF NOT EXISTS bank_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE fullchinavzla.expense_payments
  ADD COLUMN IF NOT EXISTS bank_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE fullchinavzla.payroll_payments
  ADD COLUMN IF NOT EXISTS bank_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_sync_mobile_payment_bank_fee()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_account UUID;
  v_currency TEXT;
  v_rate NUMERIC;
  v_fee NUMERIC;
  v_method TEXT;
  v_ref TEXT;
  v_date DATE := CURRENT_DATE;
  v_actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := OLD.id;
    v_ref := 'mobile-fee:' || TG_TABLE_NAME || ':' || v_id::text;
    UPDATE financial_operations SET status = 'cancelled', updated_at = now()
      WHERE reference_number = v_ref AND status <> 'cancelled';
    RETURN OLD;
  END IF;

  v_id := NEW.id;
  v_account := NEW.account_id;
  v_currency := NEW.currency;
  v_rate := COALESCE(NULLIF(NEW.exchange_rate, 0), 1);
  v_fee := COALESCE(NEW.bank_fee_amount, 0);
  IF TG_TABLE_NAME = 'payroll_payments' THEN
    v_method := NEW.payment_method;
    v_date := NEW.payment_date;
  ELSE
    v_method := NEW.method;
  END IF;
  IF TG_TABLE_NAME = 'purchase_payments' THEN
    SELECT purchase_date INTO v_date FROM purchases WHERE id = NEW.purchase_id;
  ELSIF TG_TABLE_NAME = 'expense_payments' THEN
    SELECT expense_date INTO v_date FROM expenses WHERE id = NEW.expense_id;
  END IF;
  v_ref := 'mobile-fee:' || TG_TABLE_NAME || ':' || v_id::text;
  IF v_fee < 0 THEN RAISE EXCEPTION 'La comisión bancaria no puede ser negativa'; END IF;

  IF v_method = 'pago_movil' AND v_currency IN ('VES', 'Bs') AND v_fee > 0 THEN
    IF v_actor IS NULL THEN RAISE EXCEPTION 'No se pudo identificar quién registró la comisión'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(v_ref));
    UPDATE financial_operations SET operation_date = COALESCE(v_date, CURRENT_DATE),
      amount_usd = round(v_fee / v_rate, 2), original_amount = v_fee,
      exchange_rate = v_rate, from_account_id = v_account, affects_profit = true,
      status = 'confirmed', updated_at = now()
      WHERE reference_number = v_ref;
    IF NOT FOUND THEN
    INSERT INTO financial_operations
      (operation_type, concept, operation_date, amount_usd, original_currency, original_amount,
       exchange_rate, from_account_id, reference_number, affects_profit, notes, created_by, status)
    VALUES
      ('bank_fee', 'Comisión Pago Móvil', COALESCE(v_date, CURRENT_DATE), round(v_fee / v_rate, 2),
       'VES', v_fee, v_rate, v_account, v_ref, true,
       'Comisión del pago ' || TG_TABLE_NAME || ' · ' || v_id::text, v_actor, 'confirmed')
    ;
    END IF;
  ELSE
    UPDATE financial_operations SET status = 'cancelled', updated_at = now()
      WHERE reference_number = v_ref AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_payment_bank_fee ON fullchinavzla.purchase_payments;
CREATE TRIGGER purchase_payment_bank_fee AFTER INSERT OR UPDATE OR DELETE ON fullchinavzla.purchase_payments
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_sync_mobile_payment_bank_fee();
DROP TRIGGER IF EXISTS expense_payment_bank_fee ON fullchinavzla.expense_payments;
CREATE TRIGGER expense_payment_bank_fee AFTER INSERT OR UPDATE OR DELETE ON fullchinavzla.expense_payments
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_sync_mobile_payment_bank_fee();
DROP TRIGGER IF EXISTS payroll_payment_bank_fee ON fullchinavzla.payroll_payments;
CREATE TRIGGER payroll_payment_bank_fee AFTER INSERT OR UPDATE OR DELETE ON fullchinavzla.payroll_payments
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_sync_mobile_payment_bank_fee();

-- Mantiene la RPC existente para clientes anteriores y agrega una ruta compatible con comisión.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_payroll_card_payment_with_fee(
  p_employee_id UUID, p_amount NUMERIC, p_account_id UUID,
  p_exchange_rate NUMERIC DEFAULT NULL, p_payment_date DATE DEFAULT CURRENT_DATE,
  p_reference TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL, p_bank_fee_amount NUMERIC DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_account financial_accounts%ROWTYPE;
  v_available NUMERIC;
  v_payment_id UUID;
BEGIN
  IF auth.uid() IS NULL OR fullchinavzla.get_current_user_role() <> 'owner' THEN
    RAISE EXCEPTION 'Solo la dueña puede registrar pagos de nómina';
  END IF;
  IF COALESCE(p_bank_fee_amount, 0) < 0 THEN RAISE EXCEPTION 'La comisión no puede ser negativa'; END IF;
  SELECT * INTO v_account FROM financial_accounts WHERE id = p_account_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no existe o está inactiva'; END IF;
  IF COALESCE(p_bank_fee_amount, 0) > 0 AND
     (v_account.currency <> 'VES' OR p_payment_method <> 'pago_movil') THEN
    RAISE EXCEPTION 'La comisión solo aplica a Pago Móvil en bolívares';
  END IF;
  IF v_account.currency = 'VES' AND COALESCE(p_payment_method, '') = 'pago_movil' THEN
    SELECT current_balance INTO v_available FROM fn_get_financial_account_balances() WHERE id = p_account_id;
    IF p_amount + COALESCE(p_bank_fee_amount, 0) > COALESCE(v_available, 0) + 0.01 THEN
      RAISE EXCEPTION 'La cuenta no tiene saldo suficiente para el pago y la comisión (disponible: %)', v_available;
    END IF;
  END IF;
  v_payment_id := fn_record_payroll_card_payment(
    p_employee_id, p_amount, p_account_id, p_exchange_rate, p_payment_date, p_reference, p_notes
  );
  UPDATE payroll_payments SET payment_method = p_payment_method,
    bank_fee_amount = COALESCE(p_bank_fee_amount, 0) WHERE id = v_payment_id;
  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_record_payroll_card_payment_with_fee(UUID, NUMERIC, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_record_payroll_card_payment_with_fee(UUID, NUMERIC, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, NUMERIC) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
