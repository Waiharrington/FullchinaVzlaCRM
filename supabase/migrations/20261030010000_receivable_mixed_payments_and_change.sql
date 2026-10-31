BEGIN;
SET LOCAL search_path = fullchinavzla, pg_temp;

ALTER TABLE fullchinavzla.credit_payments
  ADD COLUMN IF NOT EXISTS received_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS received_currency TEXT CHECK (received_currency IN ('USD','VES')),
  ADD COLUMN IF NOT EXISTS received_exchange_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS change_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  ADD COLUMN IF NOT EXISTS change_currency TEXT CHECK (change_currency IN ('USD','VES')),
  ADD COLUMN IF NOT EXISTS change_account_id UUID REFERENCES fullchinavzla.financial_accounts(id),
  ADD COLUMN IF NOT EXISTS change_exchange_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES fullchinavzla.cash_sessions(id);

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_receivable_payment_batch(
  p_credit_id UUID,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := fullchinavzla.get_current_user_role();
  v_order_id UUID;
  v_credit_total NUMERIC(12,2);
  v_credit_paid NUMERIC(12,2);
  v_order_total NUMERIC(12,2);
  v_order_paid NUMERIC(12,2);
  v_order_rate NUMERIC(14,6);
  v_batch_total NUMERIC(12,2) := 0;
  v_line JSONB;
  v_method TEXT;
  v_amount NUMERIC(12,2);
  v_account UUID;
  v_account_currency TEXT;
  v_account_type TEXT;
  v_rate NUMERIC(14,6);
  v_reference TEXT;
  v_received NUMERIC(14,2);
  v_received_currency TEXT;
  v_received_rate NUMERIC(14,6);
  v_change NUMERIC(14,2);
  v_change_currency TEXT;
  v_change_rate NUMERIC(14,6);
  v_change_account UUID;
  v_expected_change_usd NUMERIC(14,2);
  v_session UUID;
  v_index INTEGER := 0;
  v_inserted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL OR v_role NOT IN ('owner','manager','cashier') THEN
    RAISE EXCEPTION 'Usuario no autorizado para registrar abonos';
  END IF;
  IF jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 OR jsonb_array_length(p_payments) > 8 THEN
    RAISE EXCEPTION 'Agrega entre uno y ocho métodos de pago';
  END IF;

  SELECT c.order_id INTO v_order_id FROM credits c WHERE c.id=p_credit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta por cobrar no existe'; END IF;
  IF v_order_id IS NOT NULL THEN
    PERFORM 1 FROM orders o WHERE o.id=v_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La comanda asociada no existe'; END IF;
  END IF;
  SELECT c.total_amount INTO v_credit_total FROM credits c WHERE c.id=p_credit_id FOR UPDATE;
  SELECT COALESCE(sum(cp.amount),0) INTO v_credit_paid FROM credit_payments cp WHERE cp.credit_id=p_credit_id;
  IF v_order_id IS NOT NULL THEN
    SELECT COALESCE(sum(oi.quantity*oi.unit_price),0),o.bcv_rate,
      COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.order_id=o.id),0)
      INTO v_order_total,v_order_rate,v_order_paid
      FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
      WHERE o.id=v_order_id GROUP BY o.id;
    IF v_order_paid + (SELECT COALESCE(sum((x->>'amount')::numeric),0) FROM jsonb_array_elements(p_payments) x) > v_order_total THEN
      RAISE EXCEPTION 'El abono supera el saldo pendiente de la comanda';
    END IF;
  END IF;
  IF (SELECT COALESCE(sum((x->>'amount')::numeric),0) FROM jsonb_array_elements(p_payments) x) > v_credit_total-v_credit_paid THEN
    RAISE EXCEPTION 'El abono supera el saldo pendiente';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    v_index := v_index + 1;
    BEGIN
      v_method := v_line->>'method';
      v_amount := round((v_line->>'amount')::numeric,2);
      v_account := NULLIF(v_line->>'accountId','')::uuid;
      v_rate := NULLIF(v_line->>'exchangeRate','')::numeric;
      v_reference := NULLIF(btrim(v_line->>'referenceNumber'),'');
      v_received := NULLIF(v_line->>'receivedAmount','')::numeric;
      v_received_currency := upper(NULLIF(v_line->>'receivedCurrency',''));
      v_received_rate := NULLIF(v_line->>'receivedExchangeRate','')::numeric;
      v_change := COALESCE(NULLIF(v_line->>'changeAmount','')::numeric,0);
      v_change_currency := upper(NULLIF(v_line->>'changeCurrency',''));
      v_change_rate := NULLIF(v_line->>'changeExchangeRate','')::numeric;
      v_change_account := NULLIF(v_line->>'changeAccountId','')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Monto, moneda, tasa o cuenta inválida en el método %',v_index;
    END;
    IF v_method IS NULL OR v_method NOT IN ('cash','mobile','card','transfer','binance','other') THEN RAISE EXCEPTION 'Método de pago inválido'; END IF;
    IF v_amount IS NULL OR v_amount<=0 THEN RAISE EXCEPTION 'Cada parte del abono debe ser mayor a cero'; END IF;
    SELECT currency,account_type INTO v_account_currency,v_account_type FROM financial_accounts
      WHERE id=v_account AND is_active AND accepts_customer_payments;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona una cuenta activa que acepte pagos de clientes para el método %',v_index; END IF;
    IF v_method IN ('mobile','card','transfer','binance') AND v_reference IS NULL THEN
      RAISE EXCEPTION 'La referencia es obligatoria para el método %',v_method;
    END IF;
    IF v_account_currency='VES' AND COALESCE(NULLIF(v_rate,0),v_order_rate,0)<=0 THEN
      RAISE EXCEPTION 'La tasa BCV debe ser válida para la cuenta seleccionada';
    END IF;
    IF v_method='cash' THEN
      IF v_received IS NULL OR v_received<=0 OR v_received_currency NOT IN ('USD','VES') THEN
        RAISE EXCEPTION 'Indica el monto y la moneda del efectivo recibido';
      END IF;
      IF v_account_type<>'cash' OR v_account_currency<>v_received_currency THEN
        RAISE EXCEPTION 'La cuenta de efectivo debe coincidir con la moneda recibida';
      END IF;
      IF v_received_currency='VES' AND COALESCE(v_received_rate,v_rate,v_order_rate,0)<=0 THEN
        RAISE EXCEPTION 'La tasa BCV debe ser válida para efectivo recibido en bolívares';
      END IF;
      v_expected_change_usd := round(CASE WHEN v_received_currency='VES'
        THEN v_received/COALESCE(NULLIF(v_received_rate,0),NULLIF(v_rate,0),v_order_rate)
        ELSE v_received END-v_amount,2);
      IF v_expected_change_usd<0 THEN RAISE EXCEPTION 'El efectivo recibido no cubre esta parte del abono'; END IF;
      IF v_expected_change_usd=0 AND (v_change>0 OR v_change_account IS NOT NULL) THEN
        RAISE EXCEPTION 'No debe registrarse vuelto para un pago exacto';
      END IF;
      IF v_expected_change_usd>0 THEN
        IF v_change_account IS NULL OR v_change_currency NOT IN ('USD','VES') OR v_change<=0 THEN
          RAISE EXCEPTION 'Selecciona la cuenta de donde sale el vuelto';
        END IF;
        IF v_change_currency='VES' AND COALESCE(v_change_rate,v_order_rate,0)<=0 THEN
          RAISE EXCEPTION 'La tasa BCV debe ser válida para entregar vuelto en bolívares';
        END IF;
        IF NOT EXISTS(SELECT 1 FROM financial_accounts a WHERE a.id=v_change_account AND a.is_active
            AND a.currency=v_change_currency AND a.account_type IN ('cash','bank','digital','other')) THEN
          RAISE EXCEPTION 'La cuenta de origen del vuelto no está activa o no coincide con su moneda';
        END IF;
        IF round(CASE WHEN v_change_currency='VES' THEN v_change/NULLIF(v_change_rate,0) ELSE v_change END,2)<>v_expected_change_usd THEN
          RAISE EXCEPTION 'El vuelto no coincide con el efectivo recibido menos lo abonado';
        END IF;
      END IF;
    ELSIF v_received IS NOT NULL OR v_change>0 OR v_change_account IS NOT NULL THEN
      RAISE EXCEPTION 'El vuelto solo se registra en el componente pagado en efectivo';
    END IF;
    v_batch_total := v_batch_total + v_amount;
  END LOOP;

  IF v_order_id IS NOT NULL THEN
    SELECT status INTO v_method FROM orders WHERE id=v_order_id;
    IF v_method IN ('cancelled','paid') THEN RAISE EXCEPTION 'La comanda ya está %',v_method; END IF;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    v_method := v_line->>'method';
    v_amount := round((v_line->>'amount')::numeric,2);
    v_account := NULLIF(v_line->>'accountId','')::uuid;
    v_rate := COALESCE(NULLIF(v_line->>'exchangeRate','')::numeric,v_order_rate);
    v_reference := NULLIF(btrim(v_line->>'referenceNumber'),'');
    v_received := NULLIF(v_line->>'receivedAmount','')::numeric;
    v_received_currency := upper(NULLIF(v_line->>'receivedCurrency',''));
    v_received_rate := COALESCE(NULLIF(v_line->>'receivedExchangeRate','')::numeric,v_rate);
    v_change := COALESCE(NULLIF(v_line->>'changeAmount','')::numeric,0);
    v_change_currency := upper(NULLIF(v_line->>'changeCurrency',''));
    v_change_rate := COALESCE(NULLIF(v_line->>'changeExchangeRate','')::numeric,v_order_rate);
    v_change_account := NULLIF(v_line->>'changeAccountId','')::uuid;
    v_session := NULL;

    IF v_order_id IS NOT NULL THEN
      INSERT INTO payments(order_id,method,amount,account_id,reference_number,received_amount,received_currency,
        received_exchange_rate,change_amount,change_currency,change_account_id,change_exchange_rate,notes,created_by)
      VALUES(v_order_id,v_method,v_amount,v_account,v_reference,v_received,v_received_currency,v_received_rate,
        v_change,v_change_currency,v_change_account,v_change_rate,NULLIF(btrim(p_notes),''),v_user_id)
      RETURNING cash_session_id INTO v_session;
    ELSIF v_method='cash' OR v_change>0 THEN
      SELECT id INTO v_session FROM cash_sessions WHERE status='open' ORDER BY opened_at DESC LIMIT 1;
      IF v_session IS NULL THEN RAISE EXCEPTION 'Debes abrir la caja antes de registrar efectivo o entregar vuelto desde caja'; END IF;
      PERFORM 1 FROM cash_sessions WHERE id=v_session AND status='open' FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'La caja ya no está abierta'; END IF;
    END IF;

    IF v_order_id IS NOT NULL THEN
      INSERT INTO credit_payments(credit_id,amount,notes,created_by,account_id,method,reference_number,exchange_rate,
        received_amount,received_currency,received_exchange_rate,change_amount,change_currency,change_account_id,change_exchange_rate)
      VALUES(p_credit_id,v_amount,NULLIF(btrim(p_notes),''),v_user_id,v_account,v_method,v_reference,v_rate,
        v_received,v_received_currency,v_received_rate,v_change,v_change_currency,v_change_account,v_change_rate);
    ELSE
      INSERT INTO credit_payments(credit_id,amount,notes,created_by,account_id,method,reference_number,exchange_rate,
        received_amount,received_currency,received_exchange_rate,change_amount,change_currency,change_account_id,change_exchange_rate,cash_session_id)
      VALUES(p_credit_id,v_amount,NULLIF(btrim(p_notes),''),v_user_id,v_account,v_method,v_reference,v_rate,
        v_received,v_received_currency,v_received_rate,v_change,v_change_currency,v_change_account,v_change_rate,v_session);
    END IF;
    v_inserted := v_inserted + 1;

    IF v_change>0 AND v_session IS NOT NULL AND EXISTS(SELECT 1 FROM financial_accounts WHERE id=v_change_account AND account_type='cash') THEN
      INSERT INTO cash_movements(session_id,direction,movement_type,currency,amount,description,created_by)
      VALUES(v_session,'out','cash_out',v_change_currency,v_change,
        'Vuelto por abono de crédito '||p_credit_id::text,v_user_id);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('creditId',p_credit_id,'orderId',v_order_id,'amount',v_batch_total,
    'components',v_inserted,'balancePending',v_credit_total-v_credit_paid-v_batch_total);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_record_receivable_payment_batch(UUID,JSONB,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_record_receivable_payment_batch(UUID,JSONB,TEXT) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_financial_account_balances()
RETURNS TABLE(id UUID,name TEXT,account_type TEXT,currency TEXT,accepts_customer_payments BOOLEAN,opening_balance NUMERIC,current_balance NUMERIC)
LANGUAGE sql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
  SELECT a.id,a.name,a.account_type,a.currency,a.accepts_customer_payments,a.opening_balance,
    a.opening_balance
    + COALESCE((SELECT sum(CASE WHEN p.received_currency='VES' AND a.currency='VES' THEN p.received_amount
          WHEN p.received_currency='VES' THEN p.received_amount/NULLIF(p.received_exchange_rate,0)
          WHEN a.currency='VES' THEN p.received_amount*COALESCE(o.bcv_rate,1) ELSE p.received_amount END)
      FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.account_id=a.id AND p.method='cash' AND p.received_amount IS NOT NULL AND p.received_currency IS NOT NULL),0)
    + COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN p.amount*COALESCE(o.bcv_rate,1) ELSE p.amount END)
      FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.account_id=a.id AND (p.method<>'cash' OR p.received_currency IS NULL)),0)
    - COALESCE((SELECT sum(CASE WHEN p.change_currency='VES' AND a.currency='VES' THEN p.change_amount
        WHEN p.change_currency='VES' THEN p.change_amount/NULLIF(p.change_exchange_rate,0)
        WHEN a.currency='VES' THEN p.change_amount*COALESCE(o.bcv_rate,1) ELSE p.change_amount END)
      FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.change_account_id=a.id AND p.change_amount>0),0)
    + COALESCE((SELECT sum(CASE WHEN cp.method='cash' AND cp.received_amount IS NOT NULL
        THEN CASE WHEN cp.received_currency='VES' AND a.currency='VES' THEN cp.received_amount
          WHEN cp.received_currency='VES' THEN cp.received_amount/NULLIF(cp.received_exchange_rate,0)
          WHEN a.currency='VES' THEN cp.received_amount*COALESCE(cp.received_exchange_rate,cp.exchange_rate,1)
          ELSE cp.received_amount END
        ELSE CASE WHEN a.currency='VES' THEN cp.amount*COALESCE(cp.exchange_rate,1) ELSE cp.amount END END)
      FROM credit_payments cp JOIN credits c ON c.id=cp.credit_id WHERE cp.account_id=a.id AND c.order_id IS NULL),0)
    - COALESCE((SELECT sum(CASE WHEN cp.change_currency='VES' AND a.currency='VES' THEN cp.change_amount
        WHEN cp.change_currency='VES' THEN cp.change_amount/NULLIF(cp.change_exchange_rate,0)
        WHEN a.currency='VES' THEN cp.change_amount*COALESCE(cp.change_exchange_rate,cp.exchange_rate,1)
        ELSE cp.change_amount END)
      FROM credit_payments cp JOIN credits c ON c.id=cp.credit_id WHERE cp.change_account_id=a.id AND cp.change_amount>0 AND c.order_id IS NULL),0)
    - COALESCE((SELECT sum(ep.amount) FROM expense_payments ep WHERE ep.account_id=a.id),0)
    - COALESCE((SELECT sum(pp.amount) FROM purchase_payments pp JOIN purchases pu ON pu.id=pp.purchase_id WHERE pp.account_id=a.id AND pu.is_paid AND NOT pu.is_voided),0)
    + COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.to_account_id=a.id AND fo.status='confirmed'),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.from_account_id=a.id AND fo.status='confirmed'),0)
    AS current_balance
  FROM financial_accounts a WHERE a.is_active ORDER BY a.name;
$$;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_financial_account_balances() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_financial_account_balances() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_cash_session_snapshot(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'fullchinavzla','pg_temp' AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM fullchinavzla.fn_require_cash_role();
  SELECT jsonb_build_object(
    'id',s.id,'sessionNumber',s.session_number,'registerId',r.id,'registerCode',r.code,'registerName',r.name,
    'status',s.status,'openedAt',s.opened_at,'openedBy',s.opened_by,'openingCashUsd',s.opening_cash_usd,'openingCashVes',s.opening_cash_ves,
    'cashSalesUsd',COALESCE(pay.cash_usd,0),'cashSalesVes',COALESCE(pay.cash_ves,0),'paymentTotal',COALESCE(pay.payment_total,0),
    'paymentBreakdown',jsonb_build_object('cash',COALESCE(pay.payment_total,0)),
    'paymentBreakdownVes',jsonb_build_object('cash',COALESCE(pay.cash_ves,0)),
    'movementInUsd',COALESCE(mov.in_usd,0),'movementOutUsd',COALESCE(mov.out_usd,0),
    'movementInVes',COALESCE(mov.in_ves,0),'movementOutVes',COALESCE(mov.out_ves,0),
    'expectedCashUsd',s.opening_cash_usd+COALESCE(pay.cash_usd,0)+COALESCE(mov.in_usd,0)-COALESCE(mov.out_usd,0),
    'expectedCashVes',s.opening_cash_ves+COALESCE(pay.cash_ves,0)+COALESCE(mov.in_ves,0)-COALESCE(mov.out_ves,0),
    'countedCashUsd',s.counted_cash_usd,'countedCashVes',s.counted_cash_ves,'differenceUsd',s.difference_usd,'differenceVes',s.difference_ves,
    'closedAt',s.closed_at,'movements',COALESCE(mov.items,'[]'::jsonb)) INTO v_result
  FROM cash_sessions s JOIN cash_registers r ON r.id=s.register_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(CASE WHEN x.currency='USD' THEN x.received ELSE 0 END),0) cash_usd,
      COALESCE(SUM(CASE WHEN x.currency='VES' THEN x.received ELSE 0 END),0) cash_ves,
      COALESCE(SUM(x.amount_usd),0) payment_total
    FROM (
      SELECT COALESCE(pm.received_currency,a.currency,'USD') currency,
        CASE WHEN pm.received_currency IS NULL THEN CASE WHEN a.currency='VES' THEN pm.amount*COALESCE(o.bcv_rate,0) ELSE pm.amount END ELSE pm.received_amount END received,
        pm.amount amount_usd
      FROM payments pm JOIN orders o ON o.id=pm.order_id LEFT JOIN financial_accounts a ON a.id=pm.account_id
      WHERE pm.cash_session_id=s.id AND pm.method='cash' AND (a.account_type='cash' OR a.id IS NULL)
      UNION ALL
      SELECT COALESCE(cp.received_currency,a.currency,'USD'),
        CASE WHEN cp.received_currency IS NULL THEN CASE WHEN a.currency='VES' THEN cp.amount*COALESCE(cp.exchange_rate,0) ELSE cp.amount END ELSE cp.received_amount END,
        cp.amount
      FROM credit_payments cp LEFT JOIN financial_accounts a ON a.id=cp.account_id
      WHERE cp.cash_session_id=s.id AND cp.method='cash' AND (a.account_type='cash' OR a.id IS NULL)
    ) x
  ) pay ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(amount) FILTER(WHERE currency='USD' AND direction='in'),0) in_usd,
      COALESCE(SUM(amount) FILTER(WHERE currency='USD' AND direction='out'),0) out_usd,
      COALESCE(SUM(amount) FILTER(WHERE currency='VES' AND direction='in'),0) in_ves,
      COALESCE(SUM(amount) FILTER(WHERE currency='VES' AND direction='out'),0) out_ves,
      COALESCE(jsonb_agg(jsonb_build_object('id',id,'direction',direction,'movementType',movement_type,'currency',currency,'amount',amount,
        'description',description,'referenceNumber',reference_number,'createdAt',created_at) ORDER BY created_at DESC),'[]'::jsonb) items
    FROM cash_movements WHERE session_id=s.id
  ) mov ON true WHERE s.id=p_session_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Sesion de caja no existe'; END IF;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_cash_session_transactions(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'fullchinavzla','pg_temp' AS $$
BEGIN
  PERFORM fullchinavzla.fn_require_cash_role();
  IF NOT EXISTS(SELECT 1 FROM cash_sessions WHERE id=p_session_id) THEN RAISE EXCEPTION 'Sesion de caja no existe'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(row_data ORDER BY ts DESC) FROM (
    SELECT jsonb_build_object('id',p.id,'kind','payment','direction','in','orderNumber',o.order_number,'orderType',o.order_type,
      'customerName',o.customer_name,'method',p.method,'currency',COALESCE(p.received_currency,a.currency,'USD'),
      'amount',CASE WHEN p.received_currency IS NULL THEN CASE WHEN a.currency='VES' THEN p.amount*COALESCE(o.bcv_rate,0) ELSE p.amount END ELSE p.received_amount END,
      'referenceNumber',p.reference_number,'createdAt',p.created_at,'itemsSummary',items.summary) row_data,p.created_at ts
    FROM payments p JOIN orders o ON o.id=p.order_id LEFT JOIN financial_accounts a ON a.id=p.account_id
    LEFT JOIN LATERAL (SELECT string_agg(CASE WHEN oi.quantity=1 THEN sp.name ELSE oi.quantity::int::text||'x '||sp.name END,', ' ORDER BY oi.created_at) summary
      FROM order_items oi JOIN sellable_products sp ON sp.id=oi.sellable_product_id WHERE oi.order_id=o.id AND COALESCE(sp.is_delivery,false)=false) items ON true
    WHERE p.cash_session_id=p_session_id AND p.method='cash' AND (a.account_type='cash' OR a.id IS NULL)
    UNION ALL
    SELECT jsonb_build_object('id',cp.id,'kind','payment','direction','in','orderNumber',NULL,'orderType',NULL,
      'customerName',c.customer_name,'method',cp.method,'currency',COALESCE(cp.received_currency,a.currency,'USD'),
      'amount',CASE WHEN cp.received_currency IS NULL THEN CASE WHEN a.currency='VES' THEN cp.amount*COALESCE(cp.exchange_rate,0) ELSE cp.amount END ELSE cp.received_amount END,
      'referenceNumber',cp.reference_number,'createdAt',cp.created_at,'itemsSummary','Abono a crédito') row_data,cp.created_at ts
    FROM credit_payments cp JOIN credits c ON c.id=cp.credit_id LEFT JOIN financial_accounts a ON a.id=cp.account_id
    WHERE cp.cash_session_id=p_session_id AND cp.method='cash' AND c.order_id IS NULL AND (a.account_type='cash' OR a.id IS NULL)
    UNION ALL SELECT jsonb_build_object('id',m.id,'kind','movement','direction',m.direction,'orderNumber',NULL,'orderType',NULL,
      'customerName',NULL,'method',m.movement_type,'currency',m.currency,'amount',m.amount,'referenceNumber',m.reference_number,
      'createdAt',m.created_at,'itemsSummary',m.description) row_data,m.created_at ts FROM cash_movements m WHERE m.session_id=p_session_id
  ) combined),'[]'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_cash_session_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_cash_session_snapshot(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_cash_session_transactions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_cash_session_transactions(uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
