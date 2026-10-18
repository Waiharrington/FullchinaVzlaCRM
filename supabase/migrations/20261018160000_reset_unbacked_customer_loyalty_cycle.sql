BEGIN;
SET LOCAL search_path = fullchinavzla, pg_temp;

-- A customer may already exist in the CRM before creating a loyalty account.
-- Reset the cycle counter at account creation as well as the lifetime counters
-- reset by fn_register_customer_loyalty_account().
CREATE OR REPLACE FUNCTION fullchinavzla.fn_reset_customer_loyalty_cycle_on_account_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  UPDATE fullchinavzla.customers customer
  SET loyalty_cycle_visits = 0
  WHERE customer.id = NEW.customer_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_reset_customer_loyalty_cycle_on_account_create()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_reset_customer_loyalty_cycle_on_account_create
  ON fullchinavzla.customer_accounts;
CREATE TRIGGER trg_reset_customer_loyalty_cycle_on_account_create
AFTER INSERT ON fullchinavzla.customer_accounts
FOR EACH ROW
EXECUTE FUNCTION fullchinavzla.fn_reset_customer_loyalty_cycle_on_account_create();

-- Repair active accounts whose visible cycle count has no paid visit or reward
-- from after enrollment. Their cycle must start at zero until a qualifying
-- paid order is linked to the account.
UPDATE fullchinavzla.customers customer
SET loyalty_cycle_visits = 0
FROM fullchinavzla.customer_accounts account
WHERE account.customer_id = customer.id
  AND account.status = 'active'
  AND customer.loyalty_cycle_visits > 0
  AND NOT EXISTS (
    SELECT 1
    FROM fullchinavzla.customer_loyalty_visits visit
    WHERE visit.customer_id = customer.id
      AND visit.visited_at >= account.created_at
  )
  AND NOT EXISTS (
    SELECT 1
    FROM fullchinavzla.customer_loyalty_rewards reward
    WHERE reward.customer_id = customer.id
      AND reward.unlocked_at >= account.created_at
  );

COMMIT;
