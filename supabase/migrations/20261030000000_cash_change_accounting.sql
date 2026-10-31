BEGIN;
SET LOCAL search_path = fullchinavzla, pg_temp;

ALTER TABLE fullchinavzla.payments
  ADD COLUMN IF NOT EXISTS received_currency TEXT CHECK (received_currency IN ('USD','VES')),
  ADD COLUMN IF NOT EXISTS received_exchange_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS change_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  ADD COLUMN IF NOT EXISTS change_currency TEXT CHECK (change_currency IN ('USD','VES')),
  ADD COLUMN IF NOT EXISTS change_account_id UUID REFERENCES fullchinavzla.financial_accounts(id),
  ADD COLUMN IF NOT EXISTS change_exchange_rate NUMERIC(14,6);

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
    + COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN cp.amount*COALESCE(cp.exchange_rate,1) ELSE cp.amount END)
      FROM credit_payments cp JOIN credits c ON c.id=cp.credit_id WHERE cp.account_id=a.id AND c.order_id IS NULL),0)
    - COALESCE((SELECT sum(ep.amount) FROM expense_payments ep WHERE ep.account_id=a.id),0)
    - COALESCE((SELECT sum(pp.amount) FROM purchase_payments pp JOIN purchases pu ON pu.id=pp.purchase_id WHERE pp.account_id=a.id AND pu.is_paid AND NOT pu.is_voided),0)
    + COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.to_account_id=a.id AND fo.status='confirmed'),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.from_account_id=a.id AND fo.status='confirmed'),0)
    AS current_balance
  FROM financial_accounts a WHERE a.is_active ORDER BY a.name;
$$;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_financial_account_balances() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_financial_account_balances() TO authenticated,service_role;

CREATE OR REPLACE VIEW fullchinavzla.v_orders_with_items WITH (security_invoker=true) AS
SELECT o.id,o.order_number,o.status,o.notes,o.order_type,COALESCE(cu.full_name,o.customer_name) AS customer_name,o.bcv_rate,o.created_by,o.created_at,o.updated_at,
  COALESCE((SELECT json_agg(json_build_object('id',oi.id,'sellable_product_id',oi.sellable_product_id,'product_name',sp.name,'emoji',sp.emoji,'category',sp.category,'quantity',oi.quantity,'unit_price',oi.unit_price,
    'modifiers',COALESCE((SELECT json_agg(json_build_object('option_id',oim.modifier_option_id,'option_name',mo.name,'modifier_name',COALESCE(m.name,'Modificador'),'price',oim.unit_price,'quantity',oim.quantity) ORDER BY mo.display_order,mo.name)
      FROM order_item_modifiers oim JOIN modifier_options mo ON mo.id=oim.modifier_option_id LEFT JOIN modifiers m ON m.id=mo.modifier_id WHERE oim.order_item_id=oi.id),'[]'::json)) ORDER BY oi.created_at)
    FROM order_items oi LEFT JOIN sellable_products sp ON sp.id=oi.sellable_product_id WHERE oi.order_id=o.id),'[]'::json) AS items,
  COALESCE((SELECT SUM(oi.quantity*oi.unit_price) FROM order_items oi WHERE oi.order_id=o.id),0) AS total_amount,
  (SELECT count(*) FROM order_items oi WHERE oi.order_id=o.id) AS item_count,
  (SELECT json_agg(json_build_object('id',p.id,'method',p.method,'amount',p.amount,'account_id',p.account_id,'personal_account_id',p.personal_account_id,'reference_number',p.reference_number,
    'received_amount',p.received_amount,'received_currency',p.received_currency,'received_exchange_rate',p.received_exchange_rate,
    'change_amount',p.change_amount,'change_currency',p.change_currency,'change_account_id',p.change_account_id,
    'change_exchange_rate',p.change_exchange_rate,'notes',p.notes,'created_at',p.created_at) ORDER BY p.created_at)
    FROM payments p WHERE p.order_id=o.id) AS payments,
  o.fulfillment_status,o.customer_id,o.table_number,cu.phone AS customer_phone,cu.address AS customer_address,cu.identification AS customer_identification
FROM orders o LEFT JOIN customers cu ON cu.id=o.customer_id;
GRANT SELECT ON fullchinavzla.v_orders_with_items TO authenticated,service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_order_payments(p_order_id UUID,p_payments JSONB,p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE
  v_role TEXT; v_user_id UUID; v_order_status TEXT; v_order_total NUMERIC(12,2); v_order_rate NUMERIC(14,6);
  v_existing_paid NUMERIC(12,2); v_batch_total NUMERIC(12,2):=0; v_payment JSONB;
  v_method TEXT; v_amount NUMERIC(12,2); v_received NUMERIC(14,2); v_received_currency TEXT;
  v_rate NUMERIC(14,6); v_change NUMERIC(14,2); v_expected_change NUMERIC(14,2); v_change_currency TEXT; v_change_rate NUMERIC(14,6);
  v_reference TEXT; v_account UUID; v_account_currency TEXT; v_legacy_cash BOOLEAN; v_personal UUID; v_personal_seen UUID; v_change_account UUID; v_final_status TEXT; v_cash_session UUID; v_count INTEGER:=0;
BEGIN
  v_user_id:=auth.uid(); v_role:=fullchinavzla.get_current_user_role();
  IF v_user_id IS NULL OR v_role NOT IN ('owner','manager','cashier') THEN RAISE EXCEPTION 'Usuario no autorizado para registrar pagos'; END IF;
  IF jsonb_typeof(p_payments)<>'array' OR jsonb_array_length(p_payments)=0 THEN RAISE EXCEPTION 'Debe enviar al menos un componente de pago'; END IF;
  SELECT o.status,COALESCE((SELECT SUM(oi.quantity*oi.unit_price) FROM order_items oi WHERE oi.order_id=o.id),0),o.bcv_rate,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id),0)
    INTO v_order_status,v_order_total,v_order_rate,v_existing_paid FROM orders o WHERE o.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden % no existe',p_order_id; END IF;
  IF v_order_status IN ('cancelled','paid') THEN RAISE EXCEPTION 'La orden ya esta %',v_order_status; END IF;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    BEGIN
      v_method:=v_payment->>'method'; v_amount:=(v_payment->>'amount')::NUMERIC(12,2);
      v_received:=NULLIF(v_payment->>'receivedAmount','')::NUMERIC(14,2);
      v_legacy_cash:=v_method='cash' AND NULLIF(v_payment->>'receivedCurrency','') IS NULL;
      v_received_currency:=upper(COALESCE(NULLIF(v_payment->>'receivedCurrency',''),CASE WHEN v_method='cash' THEN 'USD' END));
      v_rate:=NULLIF(v_payment->>'receivedExchangeRate','')::NUMERIC(14,6);
      v_change:=COALESCE(NULLIF(v_payment->>'changeAmount','')::NUMERIC(14,2),0);
      v_change_currency:=upper(COALESCE(NULLIF(v_payment->>'changeCurrency',''),v_received_currency));
      v_change_rate:=NULLIF(v_payment->>'changeExchangeRate','')::NUMERIC(14,6);
      v_reference:=NULLIF(BTRIM(v_payment->>'referenceNumber'),'');
      v_account:=NULLIF(v_payment->>'accountId','')::UUID;
      v_personal:=NULLIF(v_payment->>'personalAccountId','')::UUID;
      v_change_account:=NULLIF(v_payment->>'changeAccountId','')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Monto, moneda, cuenta o referencia inválida'; END;
    IF v_method IS NULL OR v_method NOT IN ('cash','mobile','card','transfer','binance','zelle','other','personal_account') THEN RAISE EXCEPTION 'Metodo de pago invalido: %',COALESCE(v_method,'null'); END IF;
    IF v_amount IS NULL OR v_amount<=0 THEN RAISE EXCEPTION 'Cada componente de pago debe ser mayor a cero'; END IF;
    IF v_method='personal_account' THEN
      IF v_personal IS NULL OR v_account IS NOT NULL THEN RAISE EXCEPTION 'Selecciona una cuenta personal'; END IF;
      IF NOT EXISTS(SELECT 1 FROM personal_accounts WHERE id=v_personal AND is_active) THEN RAISE EXCEPTION 'La cuenta personal no está activa'; END IF;
      IF v_personal_seen IS NOT NULL AND v_personal_seen<>v_personal THEN RAISE EXCEPTION 'Una comanda solo puede acumularse en una cuenta personal'; END IF;
      v_personal_seen:=v_personal;
    ELSIF v_personal IS NOT NULL THEN RAISE EXCEPTION 'La cuenta personal solo aplica al método Cuenta personal'; END IF;
    IF v_method IN ('mobile','card','transfer','binance','zelle') AND v_reference IS NULL THEN RAISE EXCEPTION 'La referencia es obligatoria para %',v_method; END IF;
    IF v_account IS NOT NULL AND NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=v_account AND is_active) THEN RAISE EXCEPTION 'La cuenta de destino no está activa'; END IF;
    IF v_method='cash' THEN
      IF v_received IS NULL THEN RAISE EXCEPTION 'Indica el efectivo recibido para registrar el cobro'; END IF;
      IF v_received_currency NOT IN ('USD','VES') THEN RAISE EXCEPTION 'Moneda de efectivo inválida'; END IF;
      IF v_received_currency='VES' AND COALESCE(v_rate,0)<=0 THEN RAISE EXCEPTION 'La tasa BCV debe ser válida para efectivo en bolívares'; END IF;
      IF v_account IS NULL OR NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=v_account AND is_active AND account_type='cash' AND (v_legacy_cash OR currency=v_received_currency)) THEN RAISE EXCEPTION 'Selecciona una cuenta de efectivo activa en la moneda recibida'; END IF;
      SELECT currency INTO v_account_currency FROM financial_accounts WHERE id=v_account;
      IF v_legacy_cash AND v_account_currency='VES' AND COALESCE(v_order_rate,0)<=0 THEN RAISE EXCEPTION 'La tasa BCV debe ser válida para efectivo en bolívares'; END IF;
      v_expected_change:=round(CASE WHEN v_legacy_cash THEN v_received WHEN v_received_currency='VES' THEN v_received/NULLIF(v_rate,0) ELSE v_received END-v_amount,2);
      IF v_expected_change<0 THEN RAISE EXCEPTION 'El efectivo recibido no cubre su parte del pago'; END IF;
      IF v_expected_change>0 AND v_change<=0 THEN RAISE EXCEPTION 'Registra la cuenta y el monto exacto de donde saldrá el vuelto'; END IF;
      IF v_expected_change=0 AND (v_change>0 OR v_change_account IS NOT NULL) THEN RAISE EXCEPTION 'No debe registrarse vuelto cuando el pago es exacto'; END IF;
      IF v_change>0 THEN
        IF v_change_currency NOT IN ('USD','VES') OR v_change_account IS NULL THEN RAISE EXCEPTION 'Selecciona cuenta y moneda de origen del vuelto'; END IF;
        IF NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=v_change_account AND is_active AND account_type IN ('cash','bank','digital','other') AND currency=v_change_currency) THEN RAISE EXCEPTION 'Selecciona una cuenta activa y disponible en la moneda de origen del vuelto'; END IF;
        IF v_change_currency='VES' AND COALESCE(v_change_rate,0)<=0 THEN RAISE EXCEPTION 'La tasa BCV es obligatoria para entregar vuelto en bolívares'; END IF;
        IF round(CASE WHEN v_change_currency='VES' THEN v_change/NULLIF(v_change_rate,0) ELSE v_change END,2)
           <> round(CASE WHEN v_received_currency='VES' THEN v_received/NULLIF(v_rate,0) ELSE v_received END-v_amount,2)
          THEN RAISE EXCEPTION 'El vuelto no coincide con el efectivo recibido menos el monto del pago'; END IF;
      ELSIF v_change_account IS NOT NULL THEN RAISE EXCEPTION 'No debe elegirse cuenta de vuelto si no hay vuelto'; END IF;
    ELSIF v_change>0 OR v_change_account IS NOT NULL THEN RAISE EXCEPTION 'Solo un componente en efectivo puede generar vuelto';
    END IF;
    v_count:=v_count+1;
    v_batch_total:=v_batch_total+v_amount;
  END LOOP;
  IF v_personal_seen IS NOT NULL AND (v_count<>1 OR v_existing_paid<>0 OR v_batch_total<>v_order_total) THEN
    RAISE EXCEPTION 'La cuenta personal debe cubrir la comanda completa en un solo pago';
  END IF;
  IF v_existing_paid+v_batch_total<>v_order_total THEN RAISE EXCEPTION 'El pago debe completar exactamente el saldo %. Recibido: %',v_order_total-v_existing_paid,v_batch_total; END IF;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    INSERT INTO payments(order_id,method,amount,account_id,personal_account_id,reference_number,received_amount,received_currency,received_exchange_rate,
      change_amount,change_currency,change_account_id,change_exchange_rate,notes,created_by)
    VALUES(p_order_id,v_payment->>'method',(v_payment->>'amount')::NUMERIC(12,2),
      COALESCE(NULLIF(v_payment->>'accountId','')::UUID,
        (SELECT id FROM financial_accounts WHERE is_active AND name=CASE v_payment->>'method'
          WHEN 'mobile' THEN 'Banco Exterior' WHEN 'transfer' THEN 'Banco Exterior' WHEN 'card' THEN 'Banesco'
          WHEN 'cash' THEN 'Efectivo dolares' WHEN 'binance' THEN 'Binance' ELSE NULL END LIMIT 1)),
      NULLIF(v_payment->>'personalAccountId','')::UUID,NULLIF(BTRIM(v_payment->>'referenceNumber'),''),NULLIF(v_payment->>'receivedAmount','')::NUMERIC(14,2),
      CASE WHEN v_payment->>'method'='cash' AND NULLIF(v_payment->>'receivedCurrency','') IS NOT NULL THEN upper(v_payment->>'receivedCurrency') END,NULLIF(v_payment->>'receivedExchangeRate','')::NUMERIC(14,6),
      COALESCE(NULLIF(v_payment->>'changeAmount','')::NUMERIC(14,2),0),upper(NULLIF(v_payment->>'changeCurrency','')),
      NULLIF(v_payment->>'changeAccountId','')::UUID,NULLIF(v_payment->>'changeExchangeRate','')::NUMERIC(14,6),
      COALESCE(NULLIF(BTRIM(v_payment->>'notes'),''),NULLIF(BTRIM(p_notes),'')),v_user_id)
    RETURNING cash_session_id INTO v_cash_session;
    IF COALESCE(NULLIF(v_payment->>'changeAmount','')::NUMERIC(14,2),0)>0 AND v_cash_session IS NOT NULL
       AND EXISTS(SELECT 1 FROM financial_accounts WHERE id=NULLIF(v_payment->>'changeAccountId','')::UUID AND account_type='cash') THEN
      INSERT INTO cash_movements(session_id,direction,movement_type,currency,amount,description,reference_number,created_by)
      VALUES(v_cash_session,'out','cash_out',upper(v_payment->>'changeCurrency'),
        (v_payment->>'changeAmount')::NUMERIC(14,2),
        'Vuelto comanda #'||(SELECT order_number::TEXT FROM orders WHERE id=p_order_id),NULL,v_user_id);
    END IF;
  END LOOP;
  SELECT status INTO v_final_status FROM orders WHERE id=p_order_id;
  IF v_final_status<>'paid' THEN RAISE EXCEPTION 'La orden no pudo cerrarse como pagada'; END IF;
  RETURN jsonb_build_object('orderId',p_order_id,'status',v_final_status,'totalPaid',v_existing_paid+v_batch_total,'components',jsonb_array_length(p_payments));
END; $$;
REVOKE ALL ON FUNCTION fullchinavzla.fn_record_order_payments(UUID,JSONB,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_record_order_payments(UUID,JSONB,TEXT) TO authenticated,service_role;

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
    SELECT COALESCE(SUM(CASE WHEN COALESCE(pm.received_currency,a.currency,'USD')='USD' THEN CASE WHEN pm.received_currency IS NULL THEN pm.amount ELSE pm.received_amount END ELSE 0 END),0) cash_usd,
      COALESCE(SUM(CASE WHEN COALESCE(pm.received_currency,a.currency,'USD')='VES' THEN CASE WHEN pm.received_currency IS NULL THEN pm.amount*COALESCE(o.bcv_rate,0) ELSE pm.received_amount END ELSE 0 END),0) cash_ves,
      COALESCE(SUM(pm.amount),0) payment_total
    FROM payments pm JOIN orders o ON o.id=pm.order_id LEFT JOIN financial_accounts a ON a.id=pm.account_id
    WHERE pm.cash_session_id=s.id AND pm.method='cash' AND (a.account_type='cash' OR a.id IS NULL)
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
