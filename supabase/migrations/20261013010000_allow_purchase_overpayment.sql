BEGIN;

-- Permite registrar un pago superior al costo de los articulos; el saldo de la cuenta usa el importe real.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_update_purchase(
  p_purchase_id UUID,
  p_supplier_id UUID,
  p_purchase_date DATE,
  p_invoice_number TEXT,
  p_notes TEXT,
  p_is_paid BOOLEAN,
  p_exchange_rate NUMERIC,
  p_items JSONB,
  p_payments JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_creator UUID;
  v_existing_count INTEGER;
  v_input_count INTEGER;
  v_total_usd NUMERIC(14,2);
  v_paid_usd NUMERIC(14,2);
  v_primary JSONB;
  v_ingredient_id UUID;
  v_base_unit UUID;
  v_latest RECORD;
  v_price NUMERIC(12,2);
  v_payment JSONB;
  v_account_currency TEXT;
  v_exchange_rate NUMERIC;
  v_amount NUMERIC;
  v_fee NUMERIC;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager pueden editar compras';
  END IF;

  SELECT created_by INTO v_creator
  FROM fullchinavzla.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra no encontrada'; END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Faltan los artículos de la compra';
  END IF;
  SELECT count(*) INTO v_existing_count
  FROM fullchinavzla.purchase_items WHERE purchase_id = p_purchase_id;
  SELECT count(*) INTO v_input_count FROM jsonb_to_recordset(p_items) AS i(
    id UUID, ingredient_id UUID, quantity NUMERIC, unit_id UUID,
    unit_cost NUMERIC, stock_location TEXT
  );
  IF v_existing_count <> v_input_count THEN
    RAISE EXCEPTION 'Para editar una compra con inventario asociado, conserva los mismos artículos; solo se permite corregir costos y datos de la factura.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM fullchinavzla.purchase_items pi
    LEFT JOIN jsonb_to_recordset(p_items) AS i(
      id UUID, ingredient_id UUID, quantity NUMERIC, unit_id UUID,
      unit_cost NUMERIC, stock_location TEXT
    ) ON i.id = pi.id
    WHERE pi.purchase_id = p_purchase_id
      AND (i.id IS NULL
        OR i.ingredient_id IS DISTINCT FROM pi.ingredient_id
        OR i.quantity IS DISTINCT FROM pi.quantity
        OR i.unit_id IS DISTINCT FROM pi.unit_id
        OR i.stock_location IS DISTINCT FROM pi.stock_location
        OR i.unit_cost IS NULL OR i.unit_cost < 0)
  ) THEN
    RAISE EXCEPTION 'Conserva el ingrediente, cantidad, unidad y destino originales. Puedes cambiar el costo unitario.';
  END IF;

  SELECT round(COALESCE(sum(i.quantity * i.unit_cost), 0), 2) INTO v_total_usd
  FROM jsonb_to_recordset(p_items) AS i(
    id UUID, ingredient_id UUID, quantity NUMERIC, unit_id UUID,
    unit_cost NUMERIC, stock_location TEXT
  );

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' THEN
    RAISE EXCEPTION 'Los pagos de la compra no son válidos';
  END IF;
  IF p_is_paid AND jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Selecciona la cuenta y el monto del pago';
  END IF;
  IF NOT p_is_paid AND jsonb_array_length(p_payments) > 0 THEN
    RAISE EXCEPTION 'Quita los pagos o marca la compra como pagada';
  END IF;

  v_paid_usd := 0;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments)
  LOOP
    v_amount := COALESCE((v_payment->>'amount')::NUMERIC, 0);
    v_fee := COALESCE((v_payment->>'bank_fee_amount')::NUMERIC, 0);
    v_exchange_rate := NULLIF((v_payment->>'exchange_rate')::NUMERIC, 0);
    IF v_amount <= 0 OR v_fee < 0 THEN RAISE EXCEPTION 'Revisa el monto y la comisión del pago'; END IF;
    SELECT currency INTO v_account_currency
    FROM fullchinavzla.financial_accounts
    WHERE id = (v_payment->>'account_id')::UUID AND is_active;
    IF NOT FOUND OR v_account_currency IS NULL THEN RAISE EXCEPTION 'La cuenta seleccionada no existe o está inactiva'; END IF;
    IF v_account_currency <> (v_payment->>'currency') THEN
      RAISE EXCEPTION 'La moneda del pago no coincide con la cuenta seleccionada';
    END IF;
    IF v_account_currency = 'VES' AND COALESCE(v_exchange_rate, 0) <= 0 THEN
      RAISE EXCEPTION 'Falta una tasa BCV válida para registrar el pago en bolívares';
    END IF;
    IF v_fee > 0 AND (v_account_currency <> 'VES' OR v_payment->>'method' <> 'pago_movil') THEN
      RAISE EXCEPTION 'La comisión bancaria solo aplica a Pago Móvil en bolívares';
    END IF;
    v_paid_usd := v_paid_usd + CASE
      WHEN v_account_currency = 'VES' THEN v_amount / v_exchange_rate
      ELSE v_amount
    END;
  END LOOP;
  IF p_is_paid AND v_paid_usd + 0.02 < v_total_usd THEN
    RAISE EXCEPTION 'El pago no cubre el total de la compra';
  END IF;

  PERFORM set_config('fullchinavzla.purchase_cost_update_in_progress', 'on', true);
  UPDATE fullchinavzla.purchase_items pi
  SET unit_cost = i.unit_cost
  FROM jsonb_to_recordset(p_items) AS i(
    id UUID, ingredient_id UUID, quantity NUMERIC, unit_id UUID,
    unit_cost NUMERIC, stock_location TEXT
  )
  WHERE pi.id = i.id AND pi.purchase_id = p_purchase_id;

  v_primary := p_payments->0;
  UPDATE fullchinavzla.purchases
  SET supplier_id = p_supplier_id,
      purchase_date = p_purchase_date,
      invoice_number = NULLIF(trim(p_invoice_number), ''),
      notes = NULLIF(trim(p_notes), ''),
      is_paid = p_is_paid,
      account_id = CASE WHEN p_is_paid THEN (v_primary->>'account_id')::UUID ELSE NULL END,
      payment_currency = CASE WHEN p_is_paid THEN v_primary->>'currency' ELSE NULL END,
      payment_method = CASE WHEN p_is_paid THEN CASE WHEN jsonb_array_length(p_payments) > 1 THEN 'mixed' ELSE v_primary->>'method' END ELSE NULL END,
      payment_reference = CASE WHEN p_is_paid THEN NULLIF(v_primary->>'reference', '') ELSE NULL END,
      exchange_rate = CASE WHEN p_is_paid THEN COALESCE(NULLIF(p_exchange_rate, 0), NULLIF((v_primary->>'exchange_rate')::NUMERIC, 0)) ELSE NULL END
  WHERE id = p_purchase_id;

  DELETE FROM fullchinavzla.purchase_payments WHERE purchase_id = p_purchase_id;
  IF p_is_paid THEN
    INSERT INTO fullchinavzla.purchase_payments (
      purchase_id, account_id, amount, amount_usd, currency,
      exchange_rate, method, reference, bank_fee_amount
    )
    SELECT p_purchase_id, (i->>'account_id')::UUID,
      round((i->>'amount')::NUMERIC, 2),
      round(CASE WHEN i->>'currency' = 'VES'
        THEN (i->>'amount')::NUMERIC / NULLIF((i->>'exchange_rate')::NUMERIC, 0)
        ELSE (i->>'amount')::NUMERIC END, 2),
      i->>'currency', NULLIF((i->>'exchange_rate')::NUMERIC, 0),
      NULLIF(i->>'method', ''), NULLIF(i->>'reference', ''),
      round(COALESCE((i->>'bank_fee_amount')::NUMERIC, 0), 2)
    FROM jsonb_array_elements(p_payments) AS i;
  END IF;

  FOR v_ingredient_id IN
    SELECT DISTINCT pi.ingredient_id
    FROM fullchinavzla.purchase_items pi
    WHERE pi.purchase_id = p_purchase_id
  LOOP
    SELECT pi.unit_cost, pi.unit_id INTO v_latest
    FROM fullchinavzla.purchase_items pi
    JOIN fullchinavzla.purchases p ON p.id = pi.purchase_id
    WHERE pi.ingredient_id = v_ingredient_id
    ORDER BY p.purchase_date DESC, p.created_at DESC, pi.created_at DESC
    LIMIT 1;
    SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients WHERE id = v_ingredient_id;
    v_price := CASE WHEN v_latest.unit_id = v_base_unit THEN v_latest.unit_cost
      ELSE v_latest.unit_cost / fullchinavzla.normalize_to_base_unit(v_ingredient_id, 1, v_latest.unit_id) END;
    INSERT INTO fullchinavzla.ingredient_costs (ingredient_id, price_per_unit, updated_by)
    VALUES (v_ingredient_id, v_price, COALESCE(v_creator, auth.uid()))
    ON CONFLICT (ingredient_id) DO UPDATE SET
      price_per_unit = EXCLUDED.price_per_unit, last_updated = now(), updated_by = EXCLUDED.updated_by;
  END LOOP;
END;
$$;
ALTER FUNCTION fullchinavzla.fn_update_purchase(UUID, UUID, DATE, TEXT, TEXT, BOOLEAN, NUMERIC, JSONB, JSONB) OWNER TO postgres;

REVOKE ALL ON FUNCTION fullchinavzla.fn_update_purchase(UUID, UUID, DATE, TEXT, TEXT, BOOLEAN, NUMERIC, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_update_purchase(UUID, UUID, DATE, TEXT, TEXT, BOOLEAN, NUMERIC, JSONB, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
