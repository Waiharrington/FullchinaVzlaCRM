BEGIN;

INSERT INTO fullchinavzla.financial_accounts (
  name,
  account_type,
  currency,
  aliases
)
VALUES (
  'Binance',
  'digital',
  'USD',
  ARRAY['binance', 'usdt', 'binance usdt']
)
ON CONFLICT (name, currency) DO UPDATE
SET
  account_type = EXCLUDED.account_type,
  aliases = EXCLUDED.aliases,
  is_active = true,
  updated_at = now();

NOTIFY pgrst, 'reload schema';

COMMIT;
