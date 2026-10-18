BEGIN;
SET LOCAL search_path = fullchinavzla, auth, pg_temp;

-- A customer who earned one or more rewards while away sees a single final
-- celebration on their next profile visit. All pending celebrations are
-- acknowledged together so older stamps never replay one by one.
ALTER TABLE fullchinavzla.customer_loyalty_rewards
  ADD COLUMN IF NOT EXISTS celebration_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_claim_customer_loyalty_celebration()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, auth, pg_temp
AS $$
DECLARE
  v_customer_id UUID;
  v_visits_per_reward INTEGER;
  v_reward fullchinavzla.customer_loyalty_rewards%ROWTYPE;
BEGIN
  SELECT account.customer_id
    INTO v_customer_id
  FROM fullchinavzla.customer_accounts account
  WHERE account.auth_user_id = auth.uid()
    AND account.status = 'active'
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'La sesión no corresponde a una cuenta activa de cliente';
  END IF;

  -- Serialize reward creation and celebration claims for this customer.
  PERFORM 1
  FROM fullchinavzla.customers customer
  WHERE customer.id = v_customer_id
  FOR UPDATE;

  SELECT settings.visits_per_reward
    INTO v_visits_per_reward
  FROM fullchinavzla.loyalty_settings settings
  WHERE settings.id = TRUE;
  v_visits_per_reward := greatest(1, COALESCE(v_visits_per_reward, 10));

  SELECT reward.*
    INTO v_reward
  FROM fullchinavzla.customer_loyalty_rewards reward
  WHERE reward.customer_id = v_customer_id
    AND reward.redeemed_at IS NULL
    AND reward.celebration_seen_at IS NULL
  ORDER BY reward.cycle_number DESC, reward.unlocked_at DESC, reward.id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('pending', FALSE);
  END IF;

  UPDATE fullchinavzla.customer_loyalty_rewards reward
  SET celebration_seen_at = now()
  WHERE reward.customer_id = v_customer_id
    AND reward.redeemed_at IS NULL
    AND reward.celebration_seen_at IS NULL;

  RETURN jsonb_build_object(
    'pending', TRUE,
    'stamp', v_visits_per_reward,
    'cycle_number', v_reward.cycle_number,
    'reward_description', v_reward.reward_description
  );
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_claim_customer_loyalty_celebration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_claim_customer_loyalty_celebration() TO authenticated;

COMMIT;
