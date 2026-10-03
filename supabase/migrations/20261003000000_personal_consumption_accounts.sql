-- Cuentas personales para consumos internos que deben cerrar la comanda y
-- descontar inventario, sin representar un ingreso ni aumentar caja/ventas.
BEGIN;
SET LOCAL ROLE supabase_admin;
SET LOCAL search_path TO fullchinavzla, pg_temp;

CREATE TABLE IF NOT EXISTS fullchinavzla.personal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS personal_accounts_active_name_uidx
  ON fullchinavzla.personal_accounts (lower(btrim(name))) WHERE is_active;

INSERT INTO fullchinavzla.personal_accounts (name)
VALUES ('Full China'), ('Maribel')
ON CONFLICT DO NOTHING;

ALTER TABLE fullchinavzla.payments
  ADD COLUMN IF NOT EXISTS personal_account_id UUID
    REFERENCES fullchinavzla.personal_accounts(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_payments_personal_account
  ON fullchinavzla.payments(personal_account_id) WHERE personal_account_id IS NOT NULL;

ALTER TABLE fullchinavzla.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE fullchinavzla.payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cash','mobile','card','transfer','binance','zelle','other','personal_account'));
ALTER TABLE fullchinavzla.payments DROP CONSTRAINT IF EXISTS payments_personal_account_method_check;
ALTER TABLE fullchinavzla.payments ADD CONSTRAINT payments_personal_account_method_check CHECK (
  (method = 'personal_account' AND personal_account_id IS NOT NULL AND account_id IS NULL)
  OR (method <> 'personal_account' AND personal_account_id IS NULL)
);

ALTER TABLE fullchinavzla.personal_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS personal_accounts_select ON fullchinavzla.personal_accounts;
CREATE POLICY personal_accounts_select ON fullchinavzla.personal_accounts FOR SELECT
  TO authenticated USING (
    fullchinavzla.get_current_user_role()='owner'
    OR (fullchinavzla.get_current_user_role() IN ('manager','cashier') AND is_active)
  );
GRANT SELECT ON fullchinavzla.personal_accounts TO authenticated, service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_personal_accounts()
RETURNS TABLE(id UUID, name TEXT, is_active BOOLEAN, total_consumption NUMERIC, movement_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_role TEXT := fullchinavzla.get_current_user_role();
BEGIN
  IF v_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Solo owner puede ver los acumulados de cuentas personales'; END IF;
  RETURN QUERY SELECT a.id,a.name,a.is_active,
    COALESCE(sum(p.amount) FILTER (WHERE p.id IS NOT NULL),0)::NUMERIC,
    count(p.id)::BIGINT
  FROM personal_accounts a LEFT JOIN payments p ON p.personal_account_id=a.id
  GROUP BY a.id,a.name,a.is_active ORDER BY a.created_at,a.name;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_personal_account_options()
RETURNS TABLE(id UUID,name TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_role TEXT := fullchinavzla.get_current_user_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner','manager','cashier') THEN RAISE EXCEPTION 'Usuario no autorizado'; END IF;
  RETURN QUERY SELECT a.id,a.name FROM personal_accounts a WHERE a.is_active ORDER BY a.created_at,a.name;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_personal_account(p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_id UUID; v_name TEXT := btrim(COALESCE(p_name,''));
BEGIN
  IF fullchinavzla.get_current_user_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Solo owner puede administrar cuentas personales'; END IF;
  IF length(v_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'El nombre debe tener entre 1 y 80 caracteres'; END IF;
  INSERT INTO personal_accounts(name,created_by) VALUES(v_name,auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_deactivate_personal_account(p_account_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_used BOOLEAN;
BEGIN
  IF fullchinavzla.get_current_user_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Solo owner puede administrar cuentas personales'; END IF;
  SELECT EXISTS(SELECT 1 FROM payments WHERE personal_account_id=p_account_id) INTO v_used;
  IF NOT EXISTS(SELECT 1 FROM personal_accounts WHERE id=p_account_id AND is_active) THEN RAISE EXCEPTION 'La cuenta no existe o ya está inactiva'; END IF;
  IF v_used THEN
    UPDATE personal_accounts SET is_active=false,deactivated_at=now() WHERE id=p_account_id;
  ELSE
    DELETE FROM personal_accounts WHERE id=p_account_id;
  END IF;
  RETURN jsonb_build_object('deactivated',v_used);
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_personal_accounts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_personal_accounts() TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_personal_account_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_personal_account_options() TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_create_personal_account(TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_personal_account(TEXT) TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_deactivate_personal_account(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_deactivate_personal_account(UUID) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_validate_payment_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_order_status TEXT; v_order_total NUMERIC(12,2); v_current_paid NUMERIC(12,2);
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RAISE EXCEPTION 'El monto del pago debe ser mayor a cero'; END IF;
  IF NEW.method='personal_account' THEN
    IF NEW.personal_account_id IS NULL OR NEW.account_id IS NOT NULL THEN RAISE EXCEPTION 'Selecciona una cuenta personal'; END IF;
    IF NOT EXISTS(SELECT 1 FROM personal_accounts WHERE id=NEW.personal_account_id AND is_active) THEN RAISE EXCEPTION 'La cuenta personal no está activa'; END IF;
  ELSIF NEW.personal_account_id IS NOT NULL THEN RAISE EXCEPTION 'La cuenta personal solo aplica al método Cuenta personal';
  END IF;
  IF NEW.method IN ('mobile','card','transfer','binance','zelle') AND NULLIF(BTRIM(NEW.reference_number),'') IS NULL THEN
    RAISE EXCEPTION 'La referencia es obligatoria para %',NEW.method;
  END IF;
  IF NEW.method='cash' AND NEW.received_amount IS NOT NULL AND NEW.received_amount<NEW.amount THEN
    RAISE EXCEPTION 'El monto recibido no puede ser menor al monto aplicado';
  END IF;
  SELECT o.status,COALESCE((SELECT sum(oi.quantity*oi.unit_price) FROM order_items oi WHERE oi.order_id=o.id),0),
    COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.order_id=o.id),0)
    INTO v_order_status,v_order_total,v_current_paid FROM orders o WHERE o.id=NEW.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden % no existe',NEW.order_id; END IF;
  IF v_order_status IN ('cancelled','paid') THEN RAISE EXCEPTION 'No se pueden registrar pagos para una orden en estado %',v_order_status; END IF;
  IF v_order_total<=0 OR v_current_paid+NEW.amount>v_order_total THEN RAISE EXCEPTION 'El pago supera el saldo de la orden'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_order_payments(p_order_id UUID,p_payments JSONB,p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_role TEXT; v_user_id UUID; v_order_status TEXT; v_order_total NUMERIC(12,2); v_existing_paid NUMERIC(12,2);
  v_batch_total NUMERIC(12,2):=0; v_payment JSONB; v_method TEXT; v_amount NUMERIC(12,2); v_received NUMERIC(12,2);
  v_reference TEXT; v_account UUID; v_personal UUID; v_final_status TEXT; v_count INTEGER:=0; v_personal_seen UUID;
BEGIN
  v_user_id:=auth.uid(); v_role:=fullchinavzla.get_current_user_role();
  IF v_user_id IS NULL OR v_role NOT IN ('owner','manager','cashier') THEN RAISE EXCEPTION 'Usuario no autorizado para registrar pagos'; END IF;
  IF jsonb_typeof(p_payments)<>'array' OR jsonb_array_length(p_payments)=0 THEN RAISE EXCEPTION 'Debe enviar al menos un componente de pago'; END IF;
  SELECT o.status,COALESCE((SELECT sum(oi.quantity*oi.unit_price) FROM order_items oi WHERE oi.order_id=o.id),0),
    COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.order_id=o.id),0)
    INTO v_order_status,v_order_total,v_existing_paid FROM orders o WHERE o.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden % no existe',p_order_id; END IF;
  IF v_order_status IN ('cancelled','paid') THEN RAISE EXCEPTION 'La orden ya está %',v_order_status; END IF;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    BEGIN
      v_method:=v_payment->>'method'; v_amount:=(v_payment->>'amount')::NUMERIC(12,2);
      v_received:=NULLIF(v_payment->>'receivedAmount','')::NUMERIC(12,2);
      v_reference:=NULLIF(btrim(v_payment->>'referenceNumber'),'');
      v_account:=NULLIF(v_payment->>'accountId','')::UUID;
      v_personal:=NULLIF(v_payment->>'personalAccountId','')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Monto o cuenta inválida'; END;
    IF v_method NOT IN ('cash','mobile','card','transfer','binance','zelle','other','personal_account') THEN RAISE EXCEPTION 'Método de pago inválido: %',v_method; END IF;
    IF v_amount IS NULL OR v_amount<=0 THEN RAISE EXCEPTION 'Cada componente de pago debe ser mayor a cero'; END IF;
    IF v_method='personal_account' THEN
      IF v_personal IS NULL OR v_account IS NOT NULL THEN RAISE EXCEPTION 'Selecciona una cuenta personal'; END IF;
      IF NOT EXISTS(SELECT 1 FROM personal_accounts WHERE id=v_personal AND is_active) THEN RAISE EXCEPTION 'La cuenta personal no está activa'; END IF;
      IF v_personal_seen IS NOT NULL AND v_personal_seen<>v_personal THEN RAISE EXCEPTION 'Una comanda solo puede acumularse en una cuenta personal'; END IF;
      v_personal_seen:=v_personal;
    ELSIF v_personal IS NOT NULL THEN RAISE EXCEPTION 'La cuenta personal solo aplica al método Cuenta personal'; END IF;
    IF v_method IN ('mobile','card','transfer','binance','zelle') AND v_reference IS NULL THEN RAISE EXCEPTION 'La referencia es obligatoria para %',v_method; END IF;
    IF v_account IS NOT NULL AND NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=v_account AND is_active) THEN RAISE EXCEPTION 'La cuenta de destino no está activa'; END IF;
    IF v_method='cash' AND v_received IS NOT NULL AND v_received<v_amount THEN RAISE EXCEPTION 'El efectivo recibido no cubre su parte del pago'; END IF;
    v_batch_total:=v_batch_total+v_amount; v_count:=v_count+1;
  END LOOP;
  IF v_personal_seen IS NOT NULL AND (v_count<>1 OR v_existing_paid<>0 OR v_batch_total<>v_order_total) THEN
    RAISE EXCEPTION 'La cuenta personal debe cubrir la comanda completa en un solo pago';
  END IF;
  IF v_existing_paid+v_batch_total<>v_order_total THEN RAISE EXCEPTION 'El pago debe completar exactamente el saldo %. Recibido: %',v_order_total-v_existing_paid,v_batch_total; END IF;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    INSERT INTO payments(order_id,method,amount,account_id,personal_account_id,reference_number,received_amount,notes,created_by)
    VALUES(p_order_id,v_payment->>'method',(v_payment->>'amount')::NUMERIC(12,2),
      COALESCE(NULLIF(v_payment->>'accountId','')::UUID,
        (SELECT id FROM financial_accounts WHERE is_active AND name = CASE v_payment->>'method'
          WHEN 'mobile' THEN 'Banco Exterior' WHEN 'transfer' THEN 'Banco Exterior' WHEN 'card' THEN 'Banesco'
          WHEN 'cash' THEN 'Efectivo dolares' WHEN 'binance' THEN 'Binance' ELSE NULL END LIMIT 1)),
      NULLIF(v_payment->>'personalAccountId','')::UUID,
      NULLIF(btrim(v_payment->>'referenceNumber'),''),NULLIF(v_payment->>'receivedAmount','')::NUMERIC(12,2),
      COALESCE(NULLIF(btrim(v_payment->>'notes'),''),NULLIF(btrim(p_notes),'')),v_user_id);
  END LOOP;
  SELECT status INTO v_final_status FROM orders WHERE id=p_order_id;
  IF v_final_status<>'paid' THEN RAISE EXCEPTION 'La orden no pudo cerrarse como pagada'; END IF;
  RETURN jsonb_build_object('orderId',p_order_id,'status',v_final_status,'totalPaid',v_existing_paid+v_batch_total,'components',v_count);
END; $$;

CREATE OR REPLACE VIEW fullchinavzla.v_orders_with_items WITH (security_invoker=true) AS
SELECT o.id,o.order_number,o.status,o.notes,o.order_type,COALESCE(cu.full_name,o.customer_name) AS customer_name,
  o.bcv_rate,o.created_by,o.created_at,o.updated_at,
  COALESCE((SELECT json_agg(json_build_object('id',oi.id,'sellable_product_id',oi.sellable_product_id,'product_name',sp.name,'emoji',sp.emoji,'category',sp.category,'quantity',oi.quantity,'unit_price',oi.unit_price,
    'modifiers',COALESCE((SELECT json_agg(json_build_object('option_id',oim.modifier_option_id,'option_name',mo.name,'modifier_name',COALESCE(m.name,'Modificador'),'price',oim.unit_price,'quantity',oim.quantity) ORDER BY mo.display_order,mo.name)
      FROM order_item_modifiers oim JOIN modifier_options mo ON mo.id=oim.modifier_option_id LEFT JOIN modifiers m ON m.id=mo.modifier_id WHERE oim.order_item_id=oi.id),'[]'::json)) ORDER BY oi.created_at)
    FROM order_items oi LEFT JOIN sellable_products sp ON sp.id=oi.sellable_product_id WHERE oi.order_id=o.id),'[]'::json) AS items,
  COALESCE((SELECT sum(oi.quantity*oi.unit_price) FROM order_items oi WHERE oi.order_id=o.id),0) AS total_amount,
  (SELECT count(*) FROM order_items oi WHERE oi.order_id=o.id) AS item_count,
  COALESCE((SELECT json_agg(json_build_object('id',p.id,'method',p.method,'amount',p.amount,'account_id',p.account_id,'personal_account_id',p.personal_account_id,
    'reference_number',p.reference_number,'received_amount',p.received_amount,'notes',p.notes,'created_at',p.created_at) ORDER BY p.created_at)
    FROM payments p WHERE p.order_id=o.id),'[]'::json) AS payments,
  o.fulfillment_status,o.customer_id,o.table_number,cu.phone AS customer_phone,cu.address AS customer_address,cu.identification AS customer_identification
FROM orders o LEFT JOIN customers cu ON cu.id=o.customer_id;

REVOKE ALL ON FUNCTION fullchinavzla.fn_record_order_payments(UUID,JSONB,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_record_order_payments(UUID,JSONB,TEXT) TO authenticated,service_role;

-- Las comandas personales se cierran para activar su consumo de inventario,
-- pero no forman parte de ventas, cobros ni cierres financieros.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_today_stats()
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Caracas')::date;
  v_total_sales NUMERIC(12,2); v_orders_count BIGINT; v_pending_count BIGINT; v_ready_count BIGINT; v_avg_ticket NUMERIC(12,2);
BEGIN
  SELECT COALESCE(sum(p.amount),0),count(DISTINCT o.id) INTO v_total_sales,v_orders_count
  FROM orders o JOIN payments p ON p.order_id=o.id
  WHERE o.status='paid' AND p.method<>'personal_account' AND (o.created_at AT TIME ZONE 'America/Caracas')::date=v_today;
  SELECT count(*) INTO v_pending_count FROM orders WHERE status IN ('open','confirmed','preparing') AND (created_at AT TIME ZONE 'America/Caracas')::date=v_today;
  SELECT count(*) INTO v_ready_count FROM orders WHERE status='ready' AND (created_at AT TIME ZONE 'America/Caracas')::date=v_today;
  v_avg_ticket:=CASE WHEN v_orders_count>0 THEN v_total_sales/v_orders_count ELSE 0 END;
  RETURN json_build_object('totalSales',v_total_sales,'ordersCount',v_orders_count,'pendingOrders',v_pending_count,'readyOrders',v_ready_count,'avgTicket',v_avg_ticket);
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_daily_sales(p_days INTEGER DEFAULT 30)
RETURNS TABLE(sale_date DATE,total NUMERIC(12,2),order_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Caracas')::date;
BEGIN
  RETURN QUERY SELECT d::date,COALESCE(sum(p.amount),0)::NUMERIC(12,2),count(DISTINCT o.id)::BIGINT
  FROM generate_series((v_today-(GREATEST(p_days,1)-1))::date,v_today,'1 day') d
  LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'America/Caracas')::date=d AND o.status='paid'
    AND NOT EXISTS(SELECT 1 FROM payments px WHERE px.order_id=o.id AND px.method='personal_account')
  LEFT JOIN payments p ON p.order_id=o.id GROUP BY d ORDER BY d;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_product_ranking()
RETURNS TABLE(product_name TEXT,emoji TEXT,total_quantity NUMERIC(12,3),total_revenue NUMERIC(12,2))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
  SELECT sp.name,sp.emoji,sum(oi.quantity)::NUMERIC(12,3),sum(oi.quantity*oi.unit_price)::NUMERIC(12,2)
  FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN sellable_products sp ON sp.id=oi.sellable_product_id
  WHERE o.status='paid' AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.method='personal_account')
  GROUP BY sp.id,sp.name,sp.emoji ORDER BY sum(oi.quantity*oi.unit_price) DESC;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_category_sales()
RETURNS TABLE(category TEXT,total NUMERIC(12,2))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
  SELECT sp.category,sum(oi.quantity*oi.unit_price)::NUMERIC(12,2)
  FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN sellable_products sp ON sp.id=oi.sellable_product_id
  WHERE o.status='paid' AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.method='personal_account')
  GROUP BY sp.category ORDER BY sum(oi.quantity*oi.unit_price) DESC;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_payment_method_sales()
RETURNS TABLE(method TEXT,total NUMERIC(12,2),count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_start TIMESTAMPTZ:=date_trunc('day',now() AT TIME ZONE 'America/Caracas') AT TIME ZONE 'America/Caracas';
  v_end TIMESTAMPTZ:=(date_trunc('day',now() AT TIME ZONE 'America/Caracas')+interval '1 day') AT TIME ZONE 'America/Caracas';
BEGIN
  RETURN QUERY SELECT p.method,sum(p.amount)::NUMERIC(12,2),count(*)::BIGINT FROM payments p JOIN orders o ON o.id=p.order_id
  WHERE o.status='paid' AND p.method<>'personal_account' AND o.created_at>=v_start AND o.created_at<v_end
  GROUP BY p.method ORDER BY sum(p.amount) DESC;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_daily_close(p_close_date DATE,p_notes TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_role TEXT; v_total_sales NUMERIC(12,2); v_total_payments NUMERIC(12,2); v_close_id UUID;
BEGIN
  v_role:=fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner','manager') THEN RAISE EXCEPTION 'Solo owner/manager pueden crear cierres de caja'; END IF;
  IF EXISTS(SELECT 1 FROM daily_closes WHERE close_date=p_close_date) THEN RAISE EXCEPTION 'Ya existe un cierre para la fecha %',p_close_date; END IF;
  SELECT COALESCE(sum(oi.quantity*oi.unit_price),0) INTO v_total_sales FROM orders o JOIN order_items oi ON oi.order_id=o.id
  WHERE o.status='paid' AND (o.created_at AT TIME ZONE 'America/Caracas')::date=p_close_date
    AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.method='personal_account');
  SELECT COALESCE(sum(p.amount),0) INTO v_total_payments FROM payments p JOIN orders o ON o.id=p.order_id
  WHERE o.status='paid' AND (o.created_at AT TIME ZONE 'America/Caracas')::date=p_close_date AND p.method<>'personal_account';
  INSERT INTO daily_closes(close_date,total_sales,total_payments,notes,closed_by) VALUES(p_close_date,v_total_sales,v_total_payments,p_notes,auth.uid()) RETURNING id INTO v_close_id;
  RETURN v_close_id;
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_today_stats() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_today_stats() TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_daily_sales(INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_daily_sales(INTEGER) TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_product_ranking() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_product_ranking() TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_category_sales() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_category_sales() TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_payment_method_sales() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_payment_method_sales() TO authenticated,service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_create_daily_close(DATE,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_daily_close(DATE,TEXT) TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
