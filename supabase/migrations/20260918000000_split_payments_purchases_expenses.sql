-- Pago dividido en compras y gastos: cada compra/gasto puede pagarse desde
-- varias cuentas. Se crean tablas de pagos, se backfillea lo existente con el
-- MISMO monto nativo que ya calculaba la funcion de saldos, y luego la funcion
-- de saldos pasa a sumar desde esas tablas (verificado: mismos saldos).
BEGIN;

CREATE TABLE IF NOT EXISTS fullchinavzla.purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES fullchinavzla.purchases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES fullchinavzla.financial_accounts(id),
  amount numeric(14,2) NOT NULL,        -- monto en la moneda de la cuenta
  amount_usd numeric(14,2) NOT NULL,
  currency text NOT NULL,
  exchange_rate numeric,
  method text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase ON fullchinavzla.purchase_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_account ON fullchinavzla.purchase_payments(account_id);

CREATE TABLE IF NOT EXISTS fullchinavzla.expense_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES fullchinavzla.expenses(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES fullchinavzla.financial_accounts(id),
  amount numeric(14,2) NOT NULL,
  amount_usd numeric(14,2) NOT NULL,
  currency text NOT NULL,
  exchange_rate numeric,
  method text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_payments_expense ON fullchinavzla.expense_payments(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_payments_account ON fullchinavzla.expense_payments(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.purchase_payments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.expense_payments TO authenticated, service_role;

INSERT INTO fullchinavzla.purchase_payments (purchase_id, account_id, amount, amount_usd, currency, exchange_rate, method, reference)
SELECT pu.id, pu.account_id,
  round(CASE WHEN acc.currency='VES' THEN pit.total*COALESCE(pu.exchange_rate,1) ELSE pit.total END, 2),
  round(pit.total, 2), acc.currency, pu.exchange_rate, pu.payment_method, pu.payment_reference
FROM fullchinavzla.purchases pu
JOIN fullchinavzla.financial_accounts acc ON acc.id = pu.account_id
JOIN LATERAL (SELECT COALESCE(sum(quantity*unit_cost),0) AS total FROM fullchinavzla.purchase_items WHERE purchase_id = pu.id) pit ON true
WHERE pu.account_id IS NOT NULL AND pu.is_paid
  AND NOT EXISTS (SELECT 1 FROM fullchinavzla.purchase_payments pp WHERE pp.purchase_id = pu.id);

INSERT INTO fullchinavzla.expense_payments (expense_id, account_id, amount, amount_usd, currency, exchange_rate, method, reference)
SELECT e.id, e.account_id,
  round(CASE WHEN acc.currency='VES' THEN e.amount*COALESCE(e.exchange_rate,1) ELSE e.amount END, 2),
  round(e.amount, 2), acc.currency, e.exchange_rate, NULL, NULL
FROM fullchinavzla.expenses e
JOIN fullchinavzla.financial_accounts acc ON acc.id = e.account_id
WHERE e.account_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM fullchinavzla.expense_payments ep WHERE ep.expense_id = e.id);

DROP FUNCTION IF EXISTS fullchinavzla.fn_get_financial_account_balances();
CREATE FUNCTION fullchinavzla.fn_get_financial_account_balances()
RETURNS TABLE(
  id UUID, name TEXT, account_type TEXT, currency TEXT,
  accepts_customer_payments BOOLEAN, opening_balance NUMERIC, current_balance NUMERIC
)
LANGUAGE sql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT a.id, a.name, a.account_type, a.currency, a.accepts_customer_payments, a.opening_balance,
    a.opening_balance
    + COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN p.amount*COALESCE(o.bcv_rate,1) ELSE p.amount END) FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.account_id=a.id),0)
    - COALESCE((SELECT sum(ep.amount) FROM expense_payments ep WHERE ep.account_id=a.id),0)
    - COALESCE((SELECT sum(pp.amount) FROM purchase_payments pp JOIN purchases pu ON pu.id=pp.purchase_id WHERE pp.account_id=a.id AND pu.is_paid AND NOT pu.is_voided),0)
    + COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.to_account_id=a.id AND fo.status='confirmed'),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.from_account_id=a.id AND fo.status='confirmed'),0)
    AS current_balance
  FROM financial_accounts a WHERE a.is_active ORDER BY a.name;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_financial_account_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_financial_account_balances() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;
