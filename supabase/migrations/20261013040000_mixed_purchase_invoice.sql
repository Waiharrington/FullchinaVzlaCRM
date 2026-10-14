BEGIN;

-- A single supplier invoice can contain inventory and operating expenses.
-- Only purchase_payments debits the account; derived expenses have no payments.
CREATE TABLE fullchinavzla.purchase_expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES fullchinavzla.purchases(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (length(trim(description)) > 0),
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_id uuid NOT NULL REFERENCES fullchinavzla.units(id),
  unit_cost numeric(16,4) NOT NULL CHECK (unit_cost > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_expense_items_purchase_idx ON fullchinavzla.purchase_expense_items(purchase_id);
ALTER TABLE fullchinavzla.purchase_expense_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_expense_items_read ON fullchinavzla.purchase_expense_items FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
GRANT SELECT ON fullchinavzla.purchase_expense_items TO authenticated;

ALTER TABLE fullchinavzla.expenses
  ADD COLUMN purchase_expense_item_id uuid UNIQUE REFERENCES fullchinavzla.purchase_expense_items(id);

CREATE FUNCTION fullchinavzla.fn_sync_purchase_expense_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_purchase record; v_supplier text;
BEGIN
  SELECT p.purchase_date, p.invoice_number, p.created_by, p.exchange_rate, s.name
    INTO v_purchase FROM fullchinavzla.purchases p
    JOIN fullchinavzla.suppliers s ON s.id = p.supplier_id WHERE p.id = NEW.purchase_id;
  v_supplier := v_purchase.name;
  PERFORM set_config('fullchinavzla.sync_purchase_expense', 'on', true);
  INSERT INTO fullchinavzla.expenses
    (concept, amount, category, expense_date, notes, created_by, exchange_rate, purchase_expense_item_id)
  VALUES (NEW.description, round(NEW.quantity * NEW.unit_cost, 2), 'variable', v_purchase.purchase_date,
    jsonb_build_object('category', 'other', 'vendor', v_supplier,
      'extra', concat('Factura ', COALESCE(v_purchase.invoice_number, 'sin número'), ' · registrado en Compras'))::text,
    v_purchase.created_by, v_purchase.exchange_rate, NEW.id)
  ON CONFLICT (purchase_expense_item_id) DO UPDATE SET
    concept = EXCLUDED.concept, amount = EXCLUDED.amount, expense_date = EXCLUDED.expense_date,
    notes = EXCLUDED.notes, exchange_rate = EXCLUDED.exchange_rate;
  RETURN NEW;
END $$;
ALTER FUNCTION fullchinavzla.fn_sync_purchase_expense_item() OWNER TO postgres;
CREATE TRIGGER sync_purchase_expense_item AFTER INSERT OR UPDATE ON fullchinavzla.purchase_expense_items
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_sync_purchase_expense_item();

CREATE FUNCTION fullchinavzla.fn_purchase_expense_item_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  PERFORM set_config('fullchinavzla.sync_purchase_expense', 'on', true);
  DELETE FROM fullchinavzla.expenses WHERE purchase_expense_item_id = OLD.id;
  RETURN OLD;
END $$;
ALTER FUNCTION fullchinavzla.fn_purchase_expense_item_delete() OWNER TO postgres;
CREATE TRIGGER delete_purchase_expense_item BEFORE DELETE ON fullchinavzla.purchase_expense_items
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_purchase_expense_item_delete();

CREATE FUNCTION fullchinavzla.fn_protect_purchase_expense() RETURNS trigger
LANGUAGE plpgsql SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF OLD.purchase_expense_item_id IS NOT NULL
    AND current_setting('fullchinavzla.sync_purchase_expense', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Edita este gasto desde la factura en Compras';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_purchase_expense BEFORE UPDATE OR DELETE ON fullchinavzla.expenses
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_protect_purchase_expense();

CREATE FUNCTION fullchinavzla.fn_sync_purchase_expense_header() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF NEW.is_voided AND NOT OLD.is_voided THEN
    PERFORM set_config('fullchinavzla.sync_purchase_expense', 'on', true);
    DELETE FROM fullchinavzla.expenses WHERE purchase_expense_item_id IN
      (SELECT id FROM fullchinavzla.purchase_expense_items WHERE purchase_id = NEW.id);
  ELSIF NEW.purchase_date IS DISTINCT FROM OLD.purchase_date
     OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.exchange_rate IS DISTINCT FROM OLD.exchange_rate THEN
    UPDATE fullchinavzla.purchase_expense_items SET description = description WHERE purchase_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION fullchinavzla.fn_sync_purchase_expense_header() OWNER TO postgres;
CREATE TRIGGER sync_purchase_expense_header AFTER UPDATE ON fullchinavzla.purchases
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_sync_purchase_expense_header();

CREATE FUNCTION fullchinavzla.fn_save_mixed_purchase(
  p_purchase_id uuid, p_supplier_id uuid, p_purchase_date date, p_invoice_number text,
  p_notes text, p_is_paid boolean, p_exchange_rate numeric,
  p_inventory_items jsonb, p_expense_items jsonb, p_payments jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_id uuid; v_item jsonb; v_payment jsonb; v_primary jsonb;
  v_total numeric := 0; v_paid numeric := 0; v_amount numeric; v_rate numeric;
  v_currency text; v_fee numeric;
BEGIN
  IF auth.uid() IS NULL OR fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager pueden registrar compras';
  END IF;
  IF p_supplier_id IS NULL OR p_purchase_date IS NULL OR
     jsonb_typeof(p_inventory_items) IS DISTINCT FROM 'array' OR
     jsonb_typeof(p_expense_items) IS DISTINCT FROM 'array' OR
     jsonb_typeof(p_payments) IS DISTINCT FROM 'array' OR
     jsonb_array_length(p_inventory_items) + jsonb_array_length(p_expense_items) = 0 THEN
    RAISE EXCEPTION 'Factura incompleta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.suppliers WHERE id = p_supplier_id) THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_inventory_items) LOOP
    IF COALESCE((v_item->>'quantity')::numeric, 0) <= 0 OR
       COALESCE((v_item->>'unit_cost')::numeric, -1) < 0 OR
       NOT EXISTS (SELECT 1 FROM fullchinavzla.ingredients WHERE id = (v_item->>'ingredient_id')::uuid) OR
       NOT EXISTS (SELECT 1 FROM fullchinavzla.units WHERE id = (v_item->>'unit_id')::uuid) OR
       v_item->>'stock_location' NOT IN ('warehouse', 'operational') THEN
      RAISE EXCEPTION 'Revisa los ítems del inventario';
    END IF;
    v_total := v_total + (v_item->>'quantity')::numeric * (v_item->>'unit_cost')::numeric;
  END LOOP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_expense_items) LOOP
    IF length(trim(COALESCE(v_item->>'description', ''))) = 0 OR
       COALESCE((v_item->>'quantity')::numeric, 0) <= 0 OR
       COALESCE((v_item->>'unit_cost')::numeric, 0) <= 0 OR
       NOT EXISTS (SELECT 1 FROM fullchinavzla.units WHERE id = (v_item->>'unit_id')::uuid) THEN
      RAISE EXCEPTION 'Revisa los renglones de gasto';
    END IF;
    v_total := v_total + round((v_item->>'quantity')::numeric * (v_item->>'unit_cost')::numeric, 2);
  END LOOP;
  v_total := round(v_total, 2);
  IF p_is_paid AND jsonb_array_length(p_payments) = 0 THEN RAISE EXCEPTION 'Indica la cuenta de pago'; END IF;
  IF NOT p_is_paid AND jsonb_array_length(p_payments) > 0 THEN RAISE EXCEPTION 'Quita los pagos de la factura pendiente'; END IF;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    v_amount := COALESCE((v_payment->>'amount')::numeric, 0);
    v_fee := COALESCE((v_payment->>'bank_fee_amount')::numeric, 0);
    v_rate := NULLIF((v_payment->>'exchange_rate')::numeric, 0);
    SELECT currency INTO v_currency FROM fullchinavzla.financial_accounts
      WHERE id = (v_payment->>'account_id')::uuid AND is_active;
    IF NOT FOUND OR v_currency IS DISTINCT FROM v_payment->>'currency' OR v_amount <= 0 OR v_fee < 0
       OR (v_currency = 'VES' AND v_rate IS NULL)
       OR (v_fee > 0 AND (v_currency <> 'VES' OR v_payment->>'method' <> 'pago_movil')) THEN
      RAISE EXCEPTION 'Revisa la cuenta, monto, tasa y comisión del pago';
    END IF;
    v_paid := v_paid + CASE WHEN v_currency = 'VES' THEN v_amount / v_rate ELSE v_amount END;
  END LOOP;
  IF p_is_paid AND v_paid + 0.02 < v_total THEN RAISE EXCEPTION 'El pago no cubre la factura completa'; END IF;

  IF p_purchase_id IS NULL THEN
    INSERT INTO fullchinavzla.purchases
      (supplier_id, purchase_date, invoice_number, notes, created_by, is_paid)
    VALUES (p_supplier_id, p_purchase_date, NULLIF(trim(p_invoice_number), ''),
      NULLIF(trim(p_notes), ''), auth.uid(), false) RETURNING id INTO v_id;
    INSERT INTO fullchinavzla.purchase_items
      (purchase_id, ingredient_id, quantity, unit_id, unit_cost, stock_location)
    SELECT v_id, (i->>'ingredient_id')::uuid, (i->>'quantity')::numeric,
      (i->>'unit_id')::uuid, (i->>'unit_cost')::numeric, i->>'stock_location'
    FROM jsonb_array_elements(p_inventory_items) i;
  ELSE
    v_id := p_purchase_id;
    IF NOT EXISTS (SELECT 1 FROM fullchinavzla.purchases WHERE id = v_id AND NOT is_voided FOR UPDATE) THEN
      RAISE EXCEPTION 'Factura no encontrada o anulada';
    END IF;
    PERFORM fullchinavzla.fn_update_purchase(v_id, p_supplier_id, p_purchase_date,
      p_invoice_number, p_notes, false, p_exchange_rate, p_inventory_items, '[]'::jsonb);
    DELETE FROM fullchinavzla.purchase_expense_items WHERE purchase_id = v_id;
  END IF;

  INSERT INTO fullchinavzla.purchase_expense_items
    (purchase_id, description, quantity, unit_id, unit_cost)
  SELECT v_id, trim(i->>'description'), (i->>'quantity')::numeric,
    (i->>'unit_id')::uuid, (i->>'unit_cost')::numeric
  FROM jsonb_array_elements(p_expense_items) i;

  v_primary := p_payments->0;
  UPDATE fullchinavzla.purchases SET is_paid = p_is_paid,
    account_id = CASE WHEN p_is_paid THEN (v_primary->>'account_id')::uuid ELSE NULL END,
    payment_currency = CASE WHEN p_is_paid THEN v_primary->>'currency' ELSE NULL END,
    payment_method = CASE WHEN NOT p_is_paid THEN NULL WHEN jsonb_array_length(p_payments) > 1 THEN 'mixed' ELSE v_primary->>'method' END,
    payment_reference = CASE WHEN p_is_paid THEN NULLIF(v_primary->>'reference', '') ELSE NULL END,
    exchange_rate = NULLIF(p_exchange_rate, 0)
  WHERE id = v_id;
  DELETE FROM fullchinavzla.purchase_payments WHERE purchase_id = v_id;
  INSERT INTO fullchinavzla.purchase_payments
    (purchase_id, account_id, amount, amount_usd, currency, exchange_rate, method, reference, bank_fee_amount)
  SELECT v_id, (i->>'account_id')::uuid, round((i->>'amount')::numeric, 2),
    round(CASE WHEN i->>'currency' = 'VES' THEN (i->>'amount')::numeric / NULLIF((i->>'exchange_rate')::numeric, 0)
      ELSE (i->>'amount')::numeric END, 2),
    i->>'currency', NULLIF((i->>'exchange_rate')::numeric, 0), NULLIF(i->>'method', ''),
    NULLIF(i->>'reference', ''), round(COALESCE((i->>'bank_fee_amount')::numeric, 0), 2)
  FROM jsonb_array_elements(p_payments) i;
  RETURN v_id;
END $$;
ALTER FUNCTION fullchinavzla.fn_save_mixed_purchase(uuid,uuid,date,text,text,boolean,numeric,jsonb,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION fullchinavzla.fn_save_mixed_purchase(uuid,uuid,date,text,text,boolean,numeric,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_save_mixed_purchase(uuid,uuid,date,text,text,boolean,numeric,jsonb,jsonb,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
