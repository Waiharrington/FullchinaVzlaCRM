BEGIN;
SET LOCAL search_path = fullchinavzla, auth, pg_temp;

-- Loyalty participation starts at the account creation timestamp. Do not
-- grant stamps retroactively to already-paid orders when account links change.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_loyalty_visit_for_paid_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_threshold INTEGER;
  v_customer_id UUID;
  v_new_total_visits INTEGER;
  v_new_cycle_visits INTEGER;
  v_cycle_number INTEGER;
  v_reward_product_id UUID;
  v_reward_description TEXT;
  v_sequence_count INTEGER;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status <> 'paid' OR OLD.status = 'paid' OR NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.customer_accounts account
    WHERE account.customer_id = NEW.customer_id
      AND account.status = 'active'
      AND NEW.created_at >= account.created_at
  ) THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM fullchinavzla.order_items item
    JOIN fullchinavzla.sellable_products product ON product.id = item.sellable_product_id
    WHERE item.order_id = NEW.id
      AND lower(COALESCE(product.category, '')) NOT IN ('bebida', 'bebidas', 'drink', 'drinks', 'agua', 'aguas')
      AND lower(COALESCE(product.name, '')) NOT LIKE '%agua%'
      AND lower(COALESCE(product.name, '')) NOT LIKE '%refresco%'
  ) THEN RETURN NEW; END IF;

  v_customer_id := NEW.customer_id;
  INSERT INTO fullchinavzla.customer_loyalty_visits(customer_id, order_id)
  VALUES (v_customer_id, NEW.id)
  ON CONFLICT (order_id) DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT greatest(1, COALESCE(settings.visits_per_reward, 10)),
         (SELECT count(*) FROM fullchinavzla.loyalty_reward_sequence)
  INTO v_threshold, v_sequence_count
  FROM fullchinavzla.loyalty_settings settings
  WHERE settings.id = TRUE;
  v_threshold := greatest(1, COALESCE(v_threshold, 10));
  v_sequence_count := COALESCE(v_sequence_count, 0);

  UPDATE fullchinavzla.customers customer
  SET total_visits = customer.total_visits + 1,
      rewards_unlocked = floor((customer.total_visits + 1)::numeric / v_threshold)::integer,
      loyalty_cycle_visits = CASE WHEN EXISTS (
        SELECT 1 FROM fullchinavzla.customer_loyalty_rewards pending
        WHERE pending.customer_id = customer.id AND pending.redeemed_at IS NULL
      ) THEN v_threshold ELSE least(customer.loyalty_cycle_visits + 1, v_threshold) END,
      last_visit = (now() AT TIME ZONE 'America/Caracas')::date,
      updated_at = now()
  WHERE customer.id = v_customer_id
  RETURNING customer.total_visits, customer.loyalty_cycle_visits
  INTO v_new_total_visits, v_new_cycle_visits;

  IF v_sequence_count > 0
     AND v_new_cycle_visits >= v_threshold
     AND NOT EXISTS (
       SELECT 1 FROM fullchinavzla.customer_loyalty_rewards pending
       WHERE pending.customer_id = v_customer_id AND pending.redeemed_at IS NULL
     ) THEN
    SELECT COALESCE(max(reward.cycle_number), 0) + 1
    INTO v_cycle_number
    FROM fullchinavzla.customer_loyalty_rewards reward
    WHERE reward.customer_id = v_customer_id;
    SELECT product.id, product.name
    INTO v_reward_product_id, v_reward_description
    FROM fullchinavzla.loyalty_reward_sequence sequence
    JOIN fullchinavzla.sellable_products product ON product.id = sequence.sellable_product_id
    WHERE sequence.position = ((v_cycle_number - 1) % v_sequence_count) + 1;
    IF v_reward_product_id IS NOT NULL THEN
      INSERT INTO fullchinavzla.customer_loyalty_rewards(customer_id, cycle_number, sellable_product_id, reward_description)
      VALUES (v_customer_id, v_cycle_number, v_reward_product_id, v_reward_description)
      ON CONFLICT (customer_id, cycle_number) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Remove only visits that came from the just-applied historical web-order
-- recovery. Recalculate counters from the remaining visit ledger; orders and
-- payments remain intact.
WITH removed_visits AS (
  DELETE FROM fullchinavzla.customer_loyalty_visits visit
  USING fullchinavzla.web_order_requests request, fullchinavzla.orders order_row
  WHERE request.converted_order_id = visit.order_id
    AND order_row.id = visit.order_id
    AND order_row.status = 'paid'
    AND order_row.created_at < transaction_timestamp()
  RETURNING visit.customer_id
), affected_customers AS (
  SELECT DISTINCT customer_id FROM removed_visits
), visit_totals AS (
  SELECT customer.id,
         count(visit.order_id)::INTEGER AS total_visits,
         max(visit.visited_at) AS last_visit
  FROM affected_customers affected
  JOIN fullchinavzla.customers customer ON customer.id = affected.customer_id
  LEFT JOIN fullchinavzla.customer_loyalty_visits visit ON visit.customer_id = customer.id
  GROUP BY customer.id
), settings AS (
  SELECT greatest(1, COALESCE(visits_per_reward, 10)) AS threshold
  FROM fullchinavzla.loyalty_settings
  WHERE id = TRUE
)
UPDATE fullchinavzla.customers customer
SET total_visits = visit_totals.total_visits,
    rewards_unlocked = floor(visit_totals.total_visits::numeric / settings.threshold)::INTEGER,
    loyalty_cycle_visits = CASE
      WHEN EXISTS (
        SELECT 1 FROM fullchinavzla.customer_loyalty_rewards reward
        WHERE reward.customer_id = customer.id AND reward.redeemed_at IS NULL
      ) THEN settings.threshold
      ELSE visit_totals.total_visits % settings.threshold
    END,
    last_visit = (visit_totals.last_visit AT TIME ZONE 'America/Caracas')::DATE,
    updated_at = now()
FROM visit_totals
CROSS JOIN settings
WHERE customer.id = visit_totals.id;

COMMIT;
