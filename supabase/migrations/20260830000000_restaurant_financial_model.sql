-- Modelo financiero operativo basado en el flujo diario real de FullChinaVzla.
-- No reemplaza compras, ventas, gastos o nomina existentes: agrega las piezas
-- que antes se resolvian en la hoja de calculo (cuentas, traspasos, propinas,
-- cuentas por cobrar y movimientos administrativos sin efecto en utilidad).

CREATE TABLE IF NOT EXISTS fullchinavzla.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('bank', 'cash', 'pos', 'digital', 'clearing', 'other')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VES')),
  aliases TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, currency)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.financial_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'transfer', 'receivable', 'receivable_collection', 'tip', 'tip_distribution',
    'employee_advance', 'loan', 'loan_payment', 'bank_fee', 'adjustment'
  )),
  concept TEXT NOT NULL,
  operation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  original_currency TEXT NOT NULL DEFAULT 'USD' CHECK (original_currency IN ('USD', 'VES')),
  original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
  exchange_rate NUMERIC(14,6),
  from_account_id UUID REFERENCES fullchinavzla.financial_accounts(id),
  to_account_id UUID REFERENCES fullchinavzla.financial_accounts(id),
  counterparty TEXT,
  reference_number TEXT,
  affects_profit BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  ai_operation_fingerprint TEXT,
  created_by UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_account_id IS NULL OR to_account_id IS NULL OR from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_operations_date ON fullchinavzla.financial_operations(operation_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_operations_type ON fullchinavzla.financial_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_financial_operations_fingerprint
  ON fullchinavzla.financial_operations(ai_operation_fingerprint, created_at DESC)
  WHERE ai_operation_fingerprint IS NOT NULL;

INSERT INTO fullchinavzla.financial_accounts (name, account_type, currency, aliases)
VALUES
  ('Banco Exterior', 'bank', 'VES', ARRAY['exterior', 'pago movil exterior']),
  ('Banesco', 'bank', 'VES', ARRAY['banesco', 'pago movil banesco']),
  ('Efectivo bolivares', 'cash', 'VES', ARRAY['bs efectivo', 'efectivo bs', 'caja bs']),
  ('Efectivo dolares', 'cash', 'USD', ARRAY['dolares efectivo', 'efectivo usd', 'caja usd']),
  ('Punto de venta', 'pos', 'VES', ARRAY['punto', 'pos', 'tarjeta']),
  ('Pendiente punto de venta', 'clearing', 'VES', ARRAY['punto por liquidar', 'pos pendiente'])
ON CONFLICT (name, currency) DO UPDATE SET aliases = EXCLUDED.aliases, is_active = true;

ALTER TABLE fullchinavzla.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.financial_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_accounts_select ON fullchinavzla.financial_accounts;
CREATE POLICY financial_accounts_select ON fullchinavzla.financial_accounts FOR SELECT
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS financial_accounts_manage ON fullchinavzla.financial_accounts;
CREATE POLICY financial_accounts_manage ON fullchinavzla.financial_accounts FOR ALL
  USING (fullchinavzla.get_current_user_role() = 'owner')
  WITH CHECK (fullchinavzla.get_current_user_role() = 'owner');

DROP POLICY IF EXISTS financial_operations_select ON fullchinavzla.financial_operations;
CREATE POLICY financial_operations_select ON fullchinavzla.financial_operations FOR SELECT
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS financial_operations_insert ON fullchinavzla.financial_operations;
CREATE POLICY financial_operations_insert ON fullchinavzla.financial_operations FOR INSERT
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS financial_operations_update ON fullchinavzla.financial_operations;
CREATE POLICY financial_operations_update ON fullchinavzla.financial_operations FOR UPDATE
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS financial_operations_delete ON fullchinavzla.financial_operations;
CREATE POLICY financial_operations_delete ON fullchinavzla.financial_operations FOR DELETE
  USING (fullchinavzla.get_current_user_role() = 'owner');

GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.financial_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.financial_operations TO authenticated;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_ai_finalize_restaurant_operation(p_draft_id UUID, p_profile_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_draft fullchinavzla.ai_intake_messages%ROWTYPE;
  v_data JSONB; v_role TEXT; v_type TEXT; v_amount_usd NUMERIC; v_fingerprint TEXT; v_result_id UUID;
  v_from UUID; v_to UUID; v_affects BOOLEAN;
BEGIN
  SELECT role INTO v_role FROM fullchinavzla.profiles WHERE id=p_profile_id AND is_active=true;
  IF v_role NOT IN ('owner','manager') THEN RAISE EXCEPTION 'AI actor is not authorized'; END IF;
  SELECT * INTO v_draft FROM fullchinavzla.ai_intake_messages WHERE id=p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.result_reference_id IS NOT NULL THEN
    RETURN json_build_object('ok',true,'result_id',v_draft.result_reference_id,'already_registered',true);
  END IF;
  v_data:=v_draft.extracted_data; v_type:=v_data->>'type';
  IF v_type NOT IN ('transfer','receivable','receivable_collection','tip','tip_distribution','employee_advance','loan','loan_payment','bank_fee','adjustment') THEN
    RAISE EXCEPTION 'Unsupported restaurant operation';
  END IF;
  IF NULLIF(trim(v_data->>'concept'),'') IS NULL OR NULLIF(v_data->>'total','') IS NULL THEN
    RAISE EXCEPTION 'Concept and amount are required';
  END IF;
  v_amount_usd:=CASE WHEN upper(COALESCE(v_data->>'currency','USD')) IN ('VES','BS','BOLIVARES')
    THEN (v_data->>'total')::numeric/NULLIF((v_data->>'exchange_rate')::numeric,0) ELSE (v_data->>'total')::numeric END;
  IF v_amount_usd IS NULL OR v_amount_usd<=0 THEN RAISE EXCEPTION 'Valid amount and exchange rate are required'; END IF;
  IF NULLIF(v_data->>'from_account_id','') IS NOT NULL THEN v_from:=(v_data->>'from_account_id')::uuid; END IF;
  IF NULLIF(v_data->>'to_account_id','') IS NOT NULL THEN v_to:=(v_data->>'to_account_id')::uuid; END IF;
  IF v_type='transfer' AND (v_from IS NULL OR v_to IS NULL) THEN RAISE EXCEPTION 'Transfer requires source and destination accounts'; END IF;
  v_affects := v_type IN ('bank_fee','adjustment') AND COALESCE((v_data->>'affects_profit')::boolean, v_type='bank_fee');
  v_fingerprint:=md5(jsonb_build_object('actor',p_profile_id,'type',v_type,'concept',lower(trim(v_data->>'concept')),
    'date',COALESCE(v_data->>'date',CURRENT_DATE::text),'total',round((v_data->>'total')::numeric,2),
    'currency',upper(COALESCE(v_data->>'currency','USD')),'from',v_from,'to',v_to)::text);
  PERFORM pg_advisory_xact_lock(hashtext(v_fingerprint));
  SELECT id INTO v_result_id FROM fullchinavzla.financial_operations
   WHERE ai_operation_fingerprint=v_fingerprint AND created_at>=now()-interval '30 minutes' ORDER BY created_at DESC LIMIT 1;
  IF v_result_id IS NULL THEN
    INSERT INTO fullchinavzla.financial_operations(operation_type,concept,operation_date,amount_usd,original_currency,
      original_amount,exchange_rate,from_account_id,to_account_id,counterparty,reference_number,affects_profit,notes,
      ai_operation_fingerprint,created_by)
    VALUES(v_type,trim(v_data->>'concept'),COALESCE((v_data->>'date')::date,CURRENT_DATE),round(v_amount_usd,2),
      CASE WHEN upper(COALESCE(v_data->>'currency','USD')) IN ('VES','BS','BOLIVARES') THEN 'VES' ELSE 'USD' END,
      (v_data->>'total')::numeric,NULLIF(v_data->>'exchange_rate','')::numeric,v_from,v_to,NULLIF(v_data->>'counterparty',''),
      NULLIF(v_data->>'reference_number',''),v_affects,NULLIF(v_data->>'notes',''),v_fingerprint,p_profile_id) RETURNING id INTO v_result_id;
  END IF;
  UPDATE fullchinavzla.ai_intake_messages SET status='approved',approved_by=p_profile_id,approved_at=now(),result_reference_id=v_result_id WHERE id=p_draft_id;
  RETURN json_build_object('ok',true,'result_id',v_result_id,'operation_type',v_type);
END $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_ai_finalize_restaurant_operation(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_ai_finalize_restaurant_operation(UUID,UUID) TO service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_restaurant_financial_summary(p_start DATE, p_end DATE)
RETURNS JSON LANGUAGE sql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
  SELECT json_build_object(
    'start_date',p_start,'end_date',p_end,
    'sales',COALESCE((SELECT sum(oi.quantity*oi.unit_price) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='paid' AND o.created_at::date BETWEEN p_start AND p_end),0),
    'purchases',COALESCE((SELECT sum(pi.quantity*pi.unit_cost) FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id WHERE p.purchase_date BETWEEN p_start AND p_end),0),
    'fixed_expenses',COALESCE((SELECT sum(amount) FROM expenses WHERE category='fixed' AND expense_date BETWEEN p_start AND p_end),0),
    'variable_expenses',COALESCE((SELECT sum(amount) FROM expenses WHERE category='variable' AND expense_date BETWEEN p_start AND p_end),0),
    'other_expenses',COALESCE((SELECT sum(amount) FROM expenses WHERE category='other' AND expense_date BETWEEN p_start AND p_end),0),
    'manual_incomes',COALESCE((SELECT sum(amount) FROM incomes WHERE income_date BETWEEN p_start AND p_end),0),
    'non_profit_movements',COALESCE((SELECT sum(amount_usd) FROM financial_operations WHERE NOT affects_profit AND status='confirmed' AND operation_date BETWEEN p_start AND p_end),0),
    'profit_adjustments',COALESCE((SELECT sum(amount_usd) FROM financial_operations WHERE affects_profit AND status='confirmed' AND operation_date BETWEEN p_start AND p_end),0)
  );
$$;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_restaurant_financial_summary(DATE,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_restaurant_financial_summary(DATE,DATE) TO authenticated,service_role;
