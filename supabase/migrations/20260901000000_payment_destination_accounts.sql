BEGIN;

ALTER TABLE fullchinavzla.payments
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES fullchinavzla.financial_accounts(id);

DROP POLICY IF EXISTS financial_accounts_select ON fullchinavzla.financial_accounts;
CREATE POLICY financial_accounts_select ON fullchinavzla.financial_accounts FOR SELECT
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

CREATE INDEX IF NOT EXISTS idx_payments_account ON fullchinavzla.payments(account_id);

CREATE OR REPLACE VIEW fullchinavzla.v_orders_with_items
WITH (security_invoker = true) AS
SELECT o.id,o.order_number,o.status,o.notes,o.order_type,
  COALESCE(cu.full_name,o.customer_name) AS customer_name,o.bcv_rate,o.created_by,o.created_at,o.updated_at,
  COALESCE((SELECT json_agg(json_build_object('id',oi.id,'sellable_product_id',oi.sellable_product_id,'product_name',sp.name,'emoji',sp.emoji,'category',sp.category,'quantity',oi.quantity,'unit_price',oi.unit_price) ORDER BY oi.created_at) FROM order_items oi LEFT JOIN sellable_products sp ON sp.id=oi.sellable_product_id WHERE oi.order_id=o.id),'[]'::json) AS items,
  COALESCE((SELECT SUM(oi.quantity*oi.unit_price) FROM order_items oi WHERE oi.order_id=o.id),0) AS total_amount,
  (SELECT count(*) FROM order_items oi WHERE oi.order_id=o.id) AS item_count,
  (SELECT json_agg(json_build_object('id',p.id,'method',p.method,'amount',p.amount,'account_id',p.account_id,'reference_number',p.reference_number,'received_amount',p.received_amount,'notes',p.notes,'created_at',p.created_at) ORDER BY p.created_at) FROM payments p WHERE p.order_id=o.id) AS payments,
  o.fulfillment_status,o.customer_id,o.table_number
FROM orders o LEFT JOIN customers cu ON cu.id=o.customer_id;
GRANT SELECT ON fullchinavzla.v_orders_with_items TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_order_payments(
  p_order_id UUID,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_role TEXT; v_user_id UUID; v_order_status TEXT; v_order_total NUMERIC(12,2);
  v_existing_paid NUMERIC(12,2); v_batch_total NUMERIC(12,2) := 0;
  v_payment JSONB; v_method TEXT; v_amount NUMERIC(12,2); v_received NUMERIC(12,2);
  v_reference TEXT; v_account UUID; v_final_status TEXT;
BEGIN
  v_user_id := auth.uid(); v_role := fullchinavzla.get_current_user_role();
  IF v_user_id IS NULL OR v_role NOT IN ('owner','manager','cashier') THEN RAISE EXCEPTION 'Usuario no autorizado para registrar pagos'; END IF;
  IF jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN RAISE EXCEPTION 'Debe enviar al menos un componente de pago'; END IF;
  SELECT o.status, COALESCE((SELECT SUM(oi.quantity * oi.unit_price) FROM order_items oi WHERE oi.order_id=o.id),0),
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id),0)
    INTO v_order_status,v_order_total,v_existing_paid FROM orders o WHERE o.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden % no existe', p_order_id; END IF;
  IF v_order_status IN ('cancelled','paid') THEN RAISE EXCEPTION 'La orden ya esta %', v_order_status; END IF;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    BEGIN
      v_method := v_payment->>'method'; v_amount := (v_payment->>'amount')::NUMERIC(12,2);
      v_received := NULLIF(v_payment->>'receivedAmount','')::NUMERIC(12,2);
      v_reference := NULLIF(BTRIM(v_payment->>'referenceNumber'),'');
      v_account := NULLIF(v_payment->>'accountId','')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Monto, cuenta o referencia inválida'; END;
    IF v_method NOT IN ('cash','mobile','card','transfer','other') THEN RAISE EXCEPTION 'Metodo de pago invalido: %', COALESCE(v_method,'null'); END IF;
    IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Cada componente de pago debe ser mayor a cero'; END IF;
    IF v_method IN ('mobile','transfer') AND v_reference IS NULL THEN RAISE EXCEPTION 'La referencia es obligatoria para %', v_method; END IF;
    IF v_account IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id=v_account AND is_active) THEN RAISE EXCEPTION 'La cuenta de destino no está activa'; END IF;
    IF v_method='cash' AND v_received IS NOT NULL AND v_received < v_amount THEN RAISE EXCEPTION 'El efectivo recibido no cubre su parte del pago'; END IF;
    v_batch_total := v_batch_total + v_amount;
  END LOOP;
  IF v_existing_paid + v_batch_total <> v_order_total THEN RAISE EXCEPTION 'El pago debe completar exactamente el saldo %. Recibido: %', v_order_total-v_existing_paid,v_batch_total; END IF;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    INSERT INTO payments(order_id,method,amount,account_id,reference_number,received_amount,notes,created_by)
    VALUES(p_order_id,v_payment->>'method',(v_payment->>'amount')::NUMERIC(12,2),
      COALESCE(NULLIF(v_payment->>'accountId','')::UUID,
        (SELECT id FROM financial_accounts WHERE is_active AND name = CASE v_payment->>'method'
          WHEN 'mobile' THEN 'Banco Exterior' WHEN 'transfer' THEN 'Banco Exterior' WHEN 'card' THEN 'Punto de venta'
          WHEN 'cash' THEN 'Efectivo dolares' ELSE NULL END LIMIT 1)),
      NULLIF(BTRIM(v_payment->>'referenceNumber'),''),NULLIF(v_payment->>'receivedAmount','')::NUMERIC(12,2),
      COALESCE(NULLIF(BTRIM(v_payment->>'notes'),''),NULLIF(BTRIM(p_notes),'')),v_user_id);
  END LOOP;
  SELECT status INTO v_final_status FROM orders WHERE id=p_order_id;
  IF v_final_status <> 'paid' THEN RAISE EXCEPTION 'La orden no pudo cerrarse como pagada'; END IF;
  RETURN jsonb_build_object('orderId',p_order_id,'status',v_final_status,'totalPaid',v_existing_paid+v_batch_total,'components',jsonb_array_length(p_payments));
END; $$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_record_order_payments(UUID,JSONB,TEXT) TO authenticated, service_role;
COMMIT;
