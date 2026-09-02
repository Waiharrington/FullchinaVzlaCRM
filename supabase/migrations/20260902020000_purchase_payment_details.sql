BEGIN;

ALTER TABLE fullchinavzla.purchases
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_currency text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

ALTER TABLE fullchinavzla.purchases
  DROP CONSTRAINT IF EXISTS purchases_payment_currency_check;
ALTER TABLE fullchinavzla.purchases
  ADD CONSTRAINT purchases_payment_currency_check
  CHECK (payment_currency IS NULL OR payment_currency IN ('USD', 'VES'));

UPDATE fullchinavzla.purchases p
SET payment_currency = a.currency
FROM fullchinavzla.financial_accounts a
WHERE p.account_id = a.id
  AND p.payment_currency IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
