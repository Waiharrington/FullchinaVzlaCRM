ALTER TABLE fullchinavzla.expenses
  ADD COLUMN IF NOT EXISTS original_currency TEXT,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS payment_account TEXT,
  ADD COLUMN IF NOT EXISTS ai_operation_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_expenses_ai_operation_fingerprint
  ON fullchinavzla.expenses (ai_operation_fingerprint, created_at DESC)
  WHERE ai_operation_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS fullchinavzla.incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  income_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  original_currency TEXT,
  original_amount NUMERIC(14,2),
  exchange_rate NUMERIC(14,6),
  payment_account TEXT,
  ai_operation_fingerprint TEXT,
  created_by UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incomes_date ON fullchinavzla.incomes(income_date DESC);
CREATE INDEX IF NOT EXISTS idx_incomes_ai_operation_fingerprint
  ON fullchinavzla.incomes (ai_operation_fingerprint, created_at DESC)
  WHERE ai_operation_fingerprint IS NOT NULL;

ALTER TABLE fullchinavzla.incomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incomes_select ON fullchinavzla.incomes;
CREATE POLICY incomes_select ON fullchinavzla.incomes
  FOR SELECT USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS incomes_insert ON fullchinavzla.incomes;
CREATE POLICY incomes_insert ON fullchinavzla.incomes
  FOR INSERT WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS incomes_update ON fullchinavzla.incomes;
CREATE POLICY incomes_update ON fullchinavzla.incomes
  FOR UPDATE USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS incomes_delete ON fullchinavzla.incomes;
CREATE POLICY incomes_delete ON fullchinavzla.incomes
  FOR DELETE USING (fullchinavzla.get_current_user_role() = 'owner');

GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.incomes TO authenticated;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_ai_finalize_financial_operation(
  p_draft_id UUID,
  p_profile_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_draft fullchinavzla.ai_intake_messages%ROWTYPE;
  v_data JSONB;
  v_role TEXT;
  v_type TEXT;
  v_category TEXT;
  v_amount_usd NUMERIC;
  v_fingerprint TEXT;
  v_result_id UUID;
BEGIN
  SELECT role INTO v_role FROM fullchinavzla.profiles
  WHERE id = p_profile_id AND is_active = true;
  IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'AI actor is not authorized'; END IF;

  SELECT * INTO v_draft FROM fullchinavzla.ai_intake_messages
  WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.result_reference_id IS NOT NULL THEN
    RETURN json_build_object('ok', true, 'result_id', v_draft.result_reference_id, 'already_registered', true);
  END IF;
  IF v_draft.status NOT IN ('awaiting_confirmation', 'approved') THEN RAISE EXCEPTION 'Draft is not confirmable'; END IF;

  v_data := v_draft.extracted_data;
  v_type := v_data->>'type';
  IF v_type NOT IN ('expense', 'income') THEN RAISE EXCEPTION 'Unsupported financial operation'; END IF;
  IF NULLIF(trim(v_data->>'concept'), '') IS NULL THEN RAISE EXCEPTION 'Concept is required'; END IF;
  IF NULLIF(v_data->>'total', '') IS NULL THEN RAISE EXCEPTION 'Amount is required'; END IF;

  v_amount_usd := CASE
    WHEN upper(COALESCE(v_data->>'currency', 'USD')) IN ('VES', 'BS', 'BOLIVARES')
      THEN (v_data->>'total')::numeric / NULLIF((v_data->>'exchange_rate')::numeric, 0)
    ELSE (v_data->>'total')::numeric
  END;
  IF v_amount_usd IS NULL OR v_amount_usd <= 0 THEN RAISE EXCEPTION 'Valid amount and exchange rate are required'; END IF;

  v_category := COALESCE(NULLIF(v_data->>'expense_category', ''), 'other');
  IF v_type = 'expense' AND v_category NOT IN ('fixed', 'variable', 'other') THEN
    RAISE EXCEPTION 'Invalid expense category';
  END IF;

  v_fingerprint := md5(jsonb_build_object(
    'actor', p_profile_id, 'type', v_type,
    'concept', lower(trim(v_data->>'concept')),
    'date', COALESCE(v_data->>'date', CURRENT_DATE::text),
    'currency', upper(COALESCE(v_data->>'currency', 'USD')),
    'total', round((v_data->>'total')::numeric, 2),
    'category', CASE WHEN v_type = 'expense' THEN v_category ELSE NULL END
  )::text);
  PERFORM pg_advisory_xact_lock(hashtext(v_fingerprint));

  IF v_type = 'expense' THEN
    SELECT id INTO v_result_id FROM fullchinavzla.expenses
    WHERE ai_operation_fingerprint = v_fingerprint AND created_at >= now() - interval '30 minutes'
    ORDER BY created_at DESC LIMIT 1;
    IF v_result_id IS NULL THEN
      INSERT INTO fullchinavzla.expenses (
        concept, amount, category, expense_date, notes, created_by,
        original_currency, original_amount, exchange_rate, payment_account, ai_operation_fingerprint
      ) VALUES (
        trim(v_data->>'concept'), round(v_amount_usd, 2), v_category,
        COALESCE((v_data->>'date')::date, CURRENT_DATE), NULLIF(v_data->>'notes', ''), p_profile_id,
        upper(COALESCE(v_data->>'currency', 'USD')), (v_data->>'total')::numeric,
        NULLIF(v_data->>'exchange_rate', '')::numeric, NULLIF(v_data->>'payment_account', ''), v_fingerprint
      ) RETURNING id INTO v_result_id;
    END IF;
  ELSE
    SELECT id INTO v_result_id FROM fullchinavzla.incomes
    WHERE ai_operation_fingerprint = v_fingerprint AND created_at >= now() - interval '30 minutes'
    ORDER BY created_at DESC LIMIT 1;
    IF v_result_id IS NULL THEN
      INSERT INTO fullchinavzla.incomes (
        concept, amount, income_date, notes, created_by,
        original_currency, original_amount, exchange_rate, payment_account, ai_operation_fingerprint
      ) VALUES (
        trim(v_data->>'concept'), round(v_amount_usd, 2),
        COALESCE((v_data->>'date')::date, CURRENT_DATE), NULLIF(v_data->>'notes', ''), p_profile_id,
        upper(COALESCE(v_data->>'currency', 'USD')), (v_data->>'total')::numeric,
        NULLIF(v_data->>'exchange_rate', '')::numeric, NULLIF(v_data->>'payment_account', ''), v_fingerprint
      ) RETURNING id INTO v_result_id;
    END IF;
  END IF;

  UPDATE fullchinavzla.ai_intake_messages
  SET status = 'approved', approved_by = p_profile_id, approved_at = now(), result_reference_id = v_result_id
  WHERE id = p_draft_id;

  RETURN json_build_object('ok', true, 'result_id', v_result_id, 'operation_type', v_type);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_ai_finalize_financial_operation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_ai_finalize_financial_operation(UUID, UUID) TO service_role;
