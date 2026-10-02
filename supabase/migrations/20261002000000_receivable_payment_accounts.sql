-- Registra los abonos de cuentas por cobrar como ingresos en su cuenta de destino.
-- Para comandas, el pago se refleja también en payments en la misma transacción.
BEGIN;

ALTER TABLE fullchinavzla.credit_payments
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES fullchinavzla.financial_accounts(id),
  ADD COLUMN IF NOT EXISTS method TEXT,
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14,6);

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_financial_account_balances()
RETURNS TABLE(id UUID,name TEXT,account_type TEXT,currency TEXT,accepts_customer_payments BOOLEAN,opening_balance NUMERIC,current_balance NUMERIC)
LANGUAGE sql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
  SELECT a.id,a.name,a.account_type,a.currency,a.accepts_customer_payments,a.opening_balance,
    a.opening_balance
    + COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN p.amount*COALESCE(o.bcv_rate,1) ELSE p.amount END) FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.account_id=a.id),0)
    + COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN cp.amount*COALESCE(cp.exchange_rate,1) ELSE cp.amount END)
      FROM credit_payments cp JOIN credits c ON c.id=cp.credit_id WHERE cp.account_id=a.id AND c.order_id IS NULL),0)
    - COALESCE((SELECT sum(ep.amount) FROM expense_payments ep WHERE ep.account_id=a.id),0)
    - COALESCE((SELECT sum(pp.amount) FROM purchase_payments pp JOIN purchases pu ON pu.id=pp.purchase_id WHERE pp.account_id=a.id AND pu.is_paid AND NOT pu.is_voided),0)
    + COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.to_account_id=a.id AND fo.status='confirmed'),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.from_account_id=a.id AND fo.status='confirmed'),0)
    AS current_balance
  FROM financial_accounts a WHERE a.is_active ORDER BY a.name;
$$;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_financial_account_balances() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_receivable_payment(
  p_credit_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_account_id UUID,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_exchange_rate NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=fullchinavzla,pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := fullchinavzla.get_current_user_role();
  v_order_id UUID;
  v_amount NUMERIC(12,2) := p_amount;
  v_credit_total NUMERIC(12,2);
  v_credit_paid NUMERIC(12,2);
  v_order_status TEXT;
  v_order_rate NUMERIC(14,6);
  v_order_paid NUMERIC(12,2);
  v_reference TEXT := NULLIF(BTRIM(p_reference_number), '');
  v_notes TEXT := NULLIF(BTRIM(p_notes), '');
  v_account_currency TEXT;
BEGIN
  IF v_user_id IS NULL OR v_role NOT IN ('owner','manager','cashier') THEN
    RAISE EXCEPTION 'Usuario no autorizado para registrar abonos';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'El abono debe ser mayor a cero'; END IF;
  IF p_method NOT IN ('cash','mobile','card','transfer','binance','zelle','other') THEN
    RAISE EXCEPTION 'Método de pago inválido';
  END IF;
  IF p_method IN ('mobile','card','transfer','binance','zelle') AND v_reference IS NULL THEN
    RAISE EXCEPTION 'La referencia es obligatoria para %', p_method;
  END IF;

  SELECT c.order_id INTO v_order_id FROM credits c WHERE c.id=p_credit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta por cobrar no existe'; END IF;
  -- Mantiene el mismo orden de bloqueo que los cobros normales: primero comanda,
  -- después crédito, evitando carreras y deadlocks con el trigger de pagos.
  IF v_order_id IS NOT NULL THEN PERFORM 1 FROM orders o WHERE o.id=v_order_id FOR UPDATE; END IF;
  SELECT c.total_amount INTO v_credit_total FROM credits c WHERE c.id=p_credit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta por cobrar no existe'; END IF;
  SELECT COALESCE(sum(cp.amount),0) INTO v_credit_paid FROM credit_payments cp WHERE cp.credit_id=p_credit_id;
  IF v_amount > v_credit_total-v_credit_paid THEN RAISE EXCEPTION 'El abono supera el saldo pendiente'; END IF;

  SELECT a.currency INTO v_account_currency FROM financial_accounts a
    WHERE a.id=p_account_id AND a.is_active AND a.accepts_customer_payments;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona una cuenta activa que acepte pagos de clientes'; END IF;

  IF v_order_id IS NOT NULL THEN
    SELECT o.status,COALESCE(o.bcv_rate,1),COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.order_id=o.id),0)
      INTO v_order_status,v_order_rate,v_order_paid FROM orders o WHERE o.id=v_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La comanda asociada no existe'; END IF;
    IF v_order_status IN ('cancelled','paid') THEN RAISE EXCEPTION 'La comanda ya está %',v_order_status; END IF;
    IF v_order_paid+v_amount > (SELECT COALESCE(sum(oi.quantity*oi.unit_price),0) FROM order_items oi WHERE oi.order_id=v_order_id) THEN
      RAISE EXCEPTION 'El abono supera el saldo pendiente de la comanda';
    END IF;
  ELSE
    v_order_rate := COALESCE(NULLIF(p_exchange_rate,0),1);
  END IF;
  IF v_account_currency='VES' AND COALESCE(v_order_rate,0)<=0 THEN RAISE EXCEPTION 'La tasa BCV debe ser mayor a cero'; END IF;

  IF v_order_id IS NOT NULL THEN
    INSERT INTO payments(order_id,method,amount,account_id,reference_number,notes,created_by)
    VALUES(v_order_id,p_method,v_amount,p_account_id,v_reference,v_notes,v_user_id);
  END IF;

  INSERT INTO credit_payments(credit_id,amount,notes,created_by,account_id,method,reference_number,exchange_rate)
  VALUES(p_credit_id,v_amount,v_notes,v_user_id,p_account_id,p_method,v_reference,v_order_rate);

  RETURN jsonb_build_object('creditId',p_credit_id,'orderId',v_order_id,'amount',v_amount,
    'accountId',p_account_id,'method',p_method,'balancePending',v_credit_total-v_credit_paid-v_amount);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_record_receivable_payment(UUID,NUMERIC,TEXT,UUID,TEXT,TEXT,NUMERIC) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_record_receivable_payment(UUID,NUMERIC,TEXT,UUID,TEXT,TEXT,NUMERIC) TO authenticated,service_role;

COMMIT;
