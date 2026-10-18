BEGIN;
SET LOCAL search_path = fullchinavzla, auth, pg_temp;

-- Keep the authenticated customer's CRM identity on a public web request so
-- confirmation does not have to guess which duplicate customer row to use.
ALTER TABLE fullchinavzla.web_order_requests
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES fullchinavzla.customers(id);

CREATE OR REPLACE FUNCTION fullchinavzla.fn_attach_customer_account_to_web_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, auth, pg_temp
AS $$
DECLARE
  v_customer_id UUID;
  v_identification_digits TEXT;
  v_phone_digits TEXT;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT account.customer_id INTO v_customer_id
  FROM fullchinavzla.customer_accounts account
  WHERE account.auth_user_id = auth.uid()
    AND account.status = 'active';

  IF v_customer_id IS NULL THEN
    v_identification_digits := regexp_replace(COALESCE(NEW.customer_identification, ''), '[^0-9]', '', 'g');
    v_phone_digits := regexp_replace(COALESCE(NEW.customer_phone, ''), '[^0-9]', '', 'g');
    IF v_identification_digits <> '' AND length(v_phone_digits) >= 10 THEN
      SELECT account.customer_id INTO v_customer_id
      FROM fullchinavzla.customer_accounts account
      JOIN fullchinavzla.customers customer ON customer.id = account.customer_id
      WHERE account.status = 'active'
        AND regexp_replace(COALESCE(customer.identification, ''), '[^0-9]', '', 'g') = v_identification_digits
        AND length(regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g')) >= 10
        AND right(regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g'), 10) = right(v_phone_digits, 10)
        AND NEW.created_at >= account.created_at
      ORDER BY account.created_at DESC, account.customer_id
      LIMIT 1;
    END IF;
  END IF;

  NEW.customer_id := v_customer_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_attach_customer_account_to_web_order() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_attach_customer_account_to_web_order_insert ON fullchinavzla.web_order_requests;
CREATE TRIGGER trg_attach_customer_account_to_web_order_insert
BEFORE INSERT ON fullchinavzla.web_order_requests
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_attach_customer_account_to_web_order();

DROP TRIGGER IF EXISTS trg_attach_customer_account_to_web_order_identity ON fullchinavzla.web_order_requests;
CREATE TRIGGER trg_attach_customer_account_to_web_order_identity
BEFORE UPDATE OF customer_identification ON fullchinavzla.web_order_requests
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_attach_customer_account_to_web_order();

-- The confirmation RPC creates the POS order first, then stores its id on the
-- request. Copy the account link at that point, before payment can be recorded.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_link_confirmed_web_order_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF NEW.converted_order_id IS NOT NULL AND NEW.customer_id IS NOT NULL THEN
    UPDATE fullchinavzla.orders
    SET customer_id = NEW.customer_id
    WHERE id = NEW.converted_order_id
      AND status <> 'paid'
      AND customer_id IS DISTINCT FROM NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_link_confirmed_web_order_customer() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_link_confirmed_web_order_customer ON fullchinavzla.web_order_requests;
CREATE TRIGGER trg_link_confirmed_web_order_customer
AFTER UPDATE OF converted_order_id, customer_id ON fullchinavzla.web_order_requests
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_link_confirmed_web_order_customer();

-- Relink requests created before this migration by normalized cédula, limited
-- to orders placed after the customer enrolled in the loyalty account.
WITH ranked_links AS (
  SELECT request.id AS request_id,
         account.customer_id,
         row_number() OVER (
           PARTITION BY request.id
           ORDER BY account.created_at DESC, account.customer_id
         ) AS rank
  FROM fullchinavzla.web_order_requests request
  JOIN fullchinavzla.customers customer
    ON regexp_replace(COALESCE(customer.identification, ''), '[^0-9]', '', 'g') =
       regexp_replace(COALESCE(request.customer_identification, ''), '[^0-9]', '', 'g')
  JOIN fullchinavzla.customer_accounts account
    ON account.customer_id = customer.id
   AND account.status = 'active'
   AND request.created_at >= account.created_at
   AND length(regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g')) >= 10
   AND length(regexp_replace(COALESCE(request.customer_phone, ''), '[^0-9]', '', 'g')) >= 10
   AND right(regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g'), 10) =
       right(regexp_replace(COALESCE(request.customer_phone, ''), '[^0-9]', '', 'g'), 10)
  WHERE request.customer_id IS NULL
    AND regexp_replace(COALESCE(request.customer_identification, ''), '[^0-9]', '', 'g') <> ''
)
UPDATE fullchinavzla.web_order_requests request
SET customer_id = ranked_links.customer_id
FROM ranked_links
WHERE request.id = ranked_links.request_id
  AND ranked_links.rank = 1;

-- Some earlier requests already became POS orders before they were linked to
-- the account. Require matching identification and phone, and rank duplicate
-- CRM rows so each order is attached deterministically.
-- The paid-order guard normally protects every field on a settled order. For
-- this transaction-scoped identity-only backfill, disable only that trigger;
-- amounts, payments, and order status are not modified.
ALTER TABLE fullchinavzla.orders DISABLE TRIGGER trg_orders_amount_guard;
WITH ranked_links AS (
  SELECT order_row.id AS order_id,
         account.customer_id,
         row_number() OVER (
           PARTITION BY order_row.id
           ORDER BY account.created_at DESC, account.customer_id
         ) AS rank
  FROM fullchinavzla.orders order_row
  JOIN fullchinavzla.customers order_customer ON order_customer.id = order_row.customer_id
  JOIN fullchinavzla.customer_accounts account ON account.status = 'active'
  JOIN fullchinavzla.customers account_customer ON account_customer.id = account.customer_id
  WHERE order_row.created_at >= account.created_at
    AND regexp_replace(COALESCE(order_customer.identification, ''), '[^0-9]', '', 'g') <> ''
    AND regexp_replace(COALESCE(order_customer.identification, ''), '[^0-9]', '', 'g') =
        regexp_replace(COALESCE(account_customer.identification, ''), '[^0-9]', '', 'g')
    AND length(regexp_replace(COALESCE(order_customer.phone, ''), '[^0-9]', '', 'g')) >= 10
    AND length(regexp_replace(COALESCE(account_customer.phone, ''), '[^0-9]', '', 'g')) >= 10
    AND right(regexp_replace(COALESCE(order_customer.phone, ''), '[^0-9]', '', 'g'), 10) =
        right(regexp_replace(COALESCE(account_customer.phone, ''), '[^0-9]', '', 'g'), 10)
    AND order_row.customer_id IS DISTINCT FROM account.customer_id
)
UPDATE fullchinavzla.orders order_row
SET customer_id = ranked_links.customer_id
FROM ranked_links
WHERE order_row.id = ranked_links.order_id
  AND ranked_links.rank = 1;
ALTER TABLE fullchinavzla.orders ENABLE TRIGGER trg_orders_amount_guard;

-- A visit is earned by a paid food order even if the restaurant has not yet
-- selected the menu item used as the tenth-visit reward.
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
    WHERE account.customer_id = NEW.customer_id AND account.status = 'active'
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
      INSERT INTO fullchinavzla.customer_loyalty_rewards(
        customer_id, cycle_number, reward_description, sellable_product_id
      ) VALUES (
        v_customer_id, v_cycle_number, v_reward_description, v_reward_product_id
      ) ON CONFLICT (customer_id, cycle_number) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recover paid, qualifying orders that were skipped by the old early return.
WITH inserted_visits AS (
  INSERT INTO fullchinavzla.customer_loyalty_visits(customer_id, order_id, visited_at)
  SELECT account.customer_id, order_row.id, order_row.created_at
  FROM fullchinavzla.orders order_row
  JOIN fullchinavzla.customer_accounts account
    ON account.customer_id = order_row.customer_id
   AND account.status = 'active'
   AND order_row.created_at >= account.created_at
  WHERE order_row.status = 'paid'
    AND EXISTS (
      SELECT 1
      FROM fullchinavzla.order_items item
      JOIN fullchinavzla.sellable_products product ON product.id = item.sellable_product_id
      WHERE item.order_id = order_row.id
        AND lower(COALESCE(product.category, '')) NOT IN ('bebida', 'bebidas', 'drink', 'drinks', 'agua', 'aguas')
        AND lower(COALESCE(product.name, '')) NOT LIKE '%agua%'
        AND lower(COALESCE(product.name, '')) NOT LIKE '%refresco%'
    )
  ON CONFLICT (order_id) DO NOTHING
  RETURNING customer_id, visited_at
), visit_counts AS (
  SELECT customer_id, count(*)::INTEGER AS added_visits, max(visited_at) AS last_added_visit
  FROM inserted_visits
  GROUP BY customer_id
), settings AS (
  SELECT greatest(1, COALESCE(visits_per_reward, 10)) AS threshold
  FROM fullchinavzla.loyalty_settings
  WHERE id = TRUE
)
UPDATE fullchinavzla.customers customer
SET total_visits = customer.total_visits + visit_counts.added_visits,
    rewards_unlocked = floor((customer.total_visits + visit_counts.added_visits)::numeric / settings.threshold)::INTEGER,
    loyalty_cycle_visits = CASE WHEN EXISTS (
      SELECT 1 FROM fullchinavzla.customer_loyalty_rewards pending
      WHERE pending.customer_id = customer.id AND pending.redeemed_at IS NULL
    ) THEN settings.threshold ELSE least(customer.loyalty_cycle_visits + visit_counts.added_visits, settings.threshold) END,
    last_visit = greatest(COALESCE(customer.last_visit, '-infinity'::DATE), (visit_counts.last_added_visit AT TIME ZONE 'America/Caracas')::DATE),
    updated_at = now()
FROM visit_counts
CROSS JOIN settings
WHERE customer.id = visit_counts.customer_id;

COMMIT;
