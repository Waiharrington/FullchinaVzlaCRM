CREATE TABLE IF NOT EXISTS fullchinavzla.ai_agent_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'telegram',
  source_user_id TEXT NOT NULL,
  profile_id UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_user_id)
);

ALTER TABLE fullchinavzla.ai_agent_identities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_agent_identities_owner ON fullchinavzla.ai_agent_identities;
CREATE POLICY ai_agent_identities_owner ON fullchinavzla.ai_agent_identities
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() = 'owner');
GRANT SELECT ON fullchinavzla.ai_agent_identities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON fullchinavzla.ai_agent_identities TO service_role;

ALTER TABLE fullchinavzla.purchases
  ADD COLUMN IF NOT EXISTS original_currency TEXT,
  ADD COLUMN IF NOT EXISTS original_total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS payment_account TEXT;

ALTER TABLE fullchinavzla.ai_intake_messages
  ADD COLUMN IF NOT EXISTS result_reference_id UUID;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_ai_finalize_purchase(
  p_draft_id UUID,
  p_profile_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_draft fullchinavzla.ai_intake_messages%ROWTYPE;
  v_data JSONB;
  v_item JSONB;
  v_purchase_id UUID;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM fullchinavzla.profiles WHERE id = p_profile_id AND is_active = true;
  IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'AI actor is not authorized'; END IF;

  SELECT * INTO v_draft FROM fullchinavzla.ai_intake_messages WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.result_reference_id IS NOT NULL THEN
    RETURN json_build_object('ok', true, 'purchase_id', v_draft.result_reference_id, 'already_registered', true);
  END IF;
  IF v_draft.status NOT IN ('awaiting_confirmation', 'approved') THEN RAISE EXCEPTION 'Draft is not confirmable'; END IF;

  v_data := v_draft.extracted_data;
  IF v_data->>'type' <> 'purchase' THEN RAISE EXCEPTION 'Draft is not a purchase'; END IF;
  IF NULLIF(v_data->>'supplier_id', '') IS NULL THEN RAISE EXCEPTION 'Supplier is unresolved'; END IF;
  IF jsonb_array_length(COALESCE(v_data->'items', '[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Purchase has no items'; END IF;

  INSERT INTO fullchinavzla.purchases (
    supplier_id, purchase_date, notes, created_by, is_paid,
    original_currency, original_total, exchange_rate, payment_account
  ) VALUES (
    (v_data->>'supplier_id')::uuid,
    COALESCE((v_data->>'date')::date, CURRENT_DATE),
    NULLIF(v_data->>'concept', ''),
    p_profile_id,
    true,
    NULLIF(v_data->>'currency', ''),
    NULLIF(v_data->>'total', '')::numeric,
    NULLIF(v_data->>'exchange_rate', '')::numeric,
    NULLIF(v_data->>'payment_account', '')
  ) RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_data->'items') LOOP
    IF NULLIF(v_item->>'ingredient_id', '') IS NULL OR NULLIF(v_item->>'unit_id', '') IS NULL THEN
      RAISE EXCEPTION 'Purchase item is unresolved';
    END IF;
    INSERT INTO fullchinavzla.purchase_items (
      purchase_id, ingredient_id, quantity, unit_id, unit_cost
    ) VALUES (
      v_purchase_id,
      (v_item->>'ingredient_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_id')::uuid,
      (v_item->>'unit_cost_usd')::numeric
    );
  END LOOP;

  UPDATE fullchinavzla.ai_intake_messages
  SET status = 'approved', approved_by = p_profile_id, approved_at = now(), result_reference_id = v_purchase_id
  WHERE id = p_draft_id;

  RETURN json_build_object('ok', true, 'purchase_id', v_purchase_id, 'already_registered', false);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_ai_finalize_purchase(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_ai_finalize_purchase(UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
