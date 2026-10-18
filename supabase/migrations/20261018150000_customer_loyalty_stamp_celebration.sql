BEGIN;
SET LOCAL search_path = fullchinavzla, auth, pg_temp;

ALTER TABLE fullchinavzla.customer_loyalty_visits
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
  v_current_cycle_visits INTEGER;
  v_unseen_order_id UUID;
  v_has_unseen_stamp BOOLEAN := FALSE;
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

  -- Serialize reward/stamp claims and read the current cycle consistently.
  SELECT customer.loyalty_cycle_visits
    INTO v_current_cycle_visits
  FROM fullchinavzla.customers customer
  WHERE customer.id = v_customer_id
  FOR UPDATE;
  v_current_cycle_visits := greatest(0, COALESCE(v_current_cycle_visits, 0));

  SELECT greatest(1, COALESCE(settings.visits_per_reward, 10))
    INTO v_visits_per_reward
  FROM fullchinavzla.loyalty_settings settings
  WHERE settings.id = TRUE;
  v_visits_per_reward := greatest(1, COALESCE(v_visits_per_reward, 10));

  -- A pending prize takes precedence over individual stamps. Acknowledge all
  -- of them together, so return visits never replay a chain of old animations.
  SELECT reward.*
    INTO v_reward
  FROM fullchinavzla.customer_loyalty_rewards reward
  WHERE reward.customer_id = v_customer_id
    AND reward.redeemed_at IS NULL
    AND reward.celebration_seen_at IS NULL
  ORDER BY reward.cycle_number DESC, reward.unlocked_at DESC, reward.id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    SELECT EXISTS (
      SELECT 1
      FROM fullchinavzla.customer_loyalty_visits visit
      WHERE visit.customer_id = v_customer_id
        AND visit.celebration_seen_at IS NULL
    ) INTO v_has_unseen_stamp;

    UPDATE fullchinavzla.customer_loyalty_rewards reward
    SET celebration_seen_at = now()
    WHERE reward.customer_id = v_customer_id
      AND reward.redeemed_at IS NULL
      AND reward.celebration_seen_at IS NULL;

    UPDATE fullchinavzla.customer_loyalty_visits visit
    SET celebration_seen_at = now()
    WHERE visit.customer_id = v_customer_id
      AND visit.celebration_seen_at IS NULL;

    RETURN jsonb_build_object(
      'pending', TRUE,
      'complete', TRUE,
      'stamp_pending', v_has_unseen_stamp,
      'stamp', v_visits_per_reward,
      'cycle_number', v_reward.cycle_number,
      'reward_description', v_reward.reward_description
    );
  END IF;

  SELECT visit.order_id
    INTO v_unseen_order_id
  FROM fullchinavzla.customer_loyalty_visits visit
  WHERE visit.customer_id = v_customer_id
    AND visit.celebration_seen_at IS NULL
  ORDER BY visit.visited_at DESC, visit.order_id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_unseen_order_id IS NULL OR v_current_cycle_visits = 0 THEN
    -- Old unseen visits from an already-completed cycle are acknowledged
    -- silently; they must not replay after a prize has been redeemed.
    UPDATE fullchinavzla.customer_loyalty_visits visit
    SET celebration_seen_at = now()
    WHERE visit.customer_id = v_customer_id
      AND visit.celebration_seen_at IS NULL;
    RETURN jsonb_build_object('pending', FALSE);
  END IF;

  -- Show only the newest stamp and acknowledge the backlog in one claim.
  UPDATE fullchinavzla.customer_loyalty_visits visit
  SET celebration_seen_at = now()
  WHERE visit.customer_id = v_customer_id
    AND visit.celebration_seen_at IS NULL;

  RETURN jsonb_build_object(
    'pending', TRUE,
    'complete', FALSE,
    'stamp', least(v_current_cycle_visits, v_visits_per_reward),
    'cycle_number', NULL,
    'reward_description', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_claim_customer_loyalty_celebration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_claim_customer_loyalty_celebration() TO authenticated;

COMMIT;
