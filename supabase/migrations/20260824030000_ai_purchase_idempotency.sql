ALTER TABLE fullchinavzla.purchases
  ADD COLUMN IF NOT EXISTS ai_operation_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_purchases_ai_operation_fingerprint
  ON fullchinavzla.purchases (ai_operation_fingerprint, created_at DESC)
  WHERE ai_operation_fingerprint IS NOT NULL;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_ai_finalize_purchase(
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
  v_item JSONB;
  v_purchase_id UUID;
  v_existing_purchase_id UUID;
  v_role TEXT;
  v_fingerprint TEXT;
BEGIN
  SELECT role INTO v_role
  FROM fullchinavzla.profiles
  WHERE id = p_profile_id AND is_active = true;

  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'AI actor is not authorized';
  END IF;

  SELECT * INTO v_draft
  FROM fullchinavzla.ai_intake_messages
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.result_reference_id IS NOT NULL THEN
    RETURN json_build_object('ok', true, 'purchase_id', v_draft.result_reference_id, 'already_registered', true);
  END IF;
  IF v_draft.status NOT IN ('awaiting_confirmation', 'approved') THEN
    RAISE EXCEPTION 'Draft is not confirmable';
  END IF;

  v_data := v_draft.extracted_data;
  IF v_data->>'type' <> 'purchase' THEN RAISE EXCEPTION 'Draft is not a purchase'; END IF;
  IF NULLIF(v_data->>'supplier_id', '') IS NULL THEN RAISE EXCEPTION 'Supplier is unresolved'; END IF;
  IF jsonb_array_length(COALESCE(v_data->'items', '[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Purchase has no items'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_data->'items') LOOP
    IF NULLIF(v_item->>'ingredient_id', '') IS NULL OR NULLIF(v_item->>'unit_id', '') IS NULL THEN
      RAISE EXCEPTION 'Purchase item is unresolved';
    END IF;
  END LOOP;

  v_fingerprint := md5(jsonb_build_object(
    'actor', p_profile_id,
    'supplier_id', v_data->>'supplier_id',
    'date', COALESCE(v_data->>'date', CURRENT_DATE::text),
    'currency', upper(COALESCE(v_data->>'currency', '')),
    'total', COALESCE(NULLIF(v_data->>'total', '')::numeric, 0),
    'items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'ingredient_id', item->>'ingredient_id',
          'unit_id', item->>'unit_id',
          'quantity', round((item->>'quantity')::numeric, 3)
        )
        ORDER BY item->>'ingredient_id', item->>'unit_id', (item->>'quantity')::numeric
      )
      FROM jsonb_array_elements(v_data->'items') AS item
    )
  )::text);

  -- Serializa operaciones equivalentes aunque lleguen desde webhooks distintos.
  PERFORM pg_advisory_xact_lock(hashtext(v_fingerprint));

  SELECT id INTO v_existing_purchase_id
  FROM fullchinavzla.purchases
  WHERE ai_operation_fingerprint = v_fingerprint
    AND created_at >= now() - interval '30 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_purchase_id IS NOT NULL THEN
    UPDATE fullchinavzla.ai_intake_messages
    SET status = 'approved',
        approved_by = p_profile_id,
        approved_at = now(),
        result_reference_id = v_existing_purchase_id,
        error_message = 'Duplicate prevented: equivalent purchase already registered'
    WHERE id = p_draft_id;

    RETURN json_build_object(
      'ok', true,
      'purchase_id', v_existing_purchase_id,
      'already_registered', true,
      'duplicate_prevented', true
    );
  END IF;

  INSERT INTO fullchinavzla.purchases (
    supplier_id, purchase_date, notes, created_by, is_paid,
    original_currency, original_total, exchange_rate, payment_account,
    ai_operation_fingerprint
  ) VALUES (
    (v_data->>'supplier_id')::uuid,
    COALESCE((v_data->>'date')::date, CURRENT_DATE),
    NULLIF(v_data->>'concept', ''),
    p_profile_id,
    true,
    NULLIF(v_data->>'currency', ''),
    NULLIF(v_data->>'total', '')::numeric,
    NULLIF(v_data->>'exchange_rate', '')::numeric,
    NULLIF(v_data->>'payment_account', ''),
    v_fingerprint
  ) RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_data->'items') LOOP
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

-- Incorpora las compras creadas anteriormente por el agente a la protección.
UPDATE fullchinavzla.purchases AS purchase
SET ai_operation_fingerprint = md5(jsonb_build_object(
  'actor', draft.approved_by,
  'supplier_id', draft.extracted_data->>'supplier_id',
  'date', COALESCE(draft.extracted_data->>'date', purchase.purchase_date::text),
  'currency', upper(COALESCE(draft.extracted_data->>'currency', '')),
  'total', COALESCE(NULLIF(draft.extracted_data->>'total', '')::numeric, 0),
  'items', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'ingredient_id', item->>'ingredient_id',
        'unit_id', item->>'unit_id',
        'quantity', round((item->>'quantity')::numeric, 3)
      )
      ORDER BY item->>'ingredient_id', item->>'unit_id', (item->>'quantity')::numeric
    )
    FROM jsonb_array_elements(draft.extracted_data->'items') AS item
  )
)::text)
FROM fullchinavzla.ai_intake_messages AS draft
WHERE draft.result_reference_id = purchase.id
  AND draft.approved_by IS NOT NULL
  AND purchase.ai_operation_fingerprint IS NULL;

REVOKE ALL ON FUNCTION fullchinavzla.fn_ai_finalize_purchase(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_ai_finalize_purchase(UUID, UUID) TO service_role;
