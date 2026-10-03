-- Zelle is no longer accepted as a payment method.
-- NOT VALID preserves legacy rows while enforcing the rule for every new or
-- updated row. This migration must be reviewed and applied through the normal
-- authorized deployment process; it is not executed by local development.
BEGIN;

ALTER TABLE fullchinavzla.payments
  ADD CONSTRAINT payments_method_no_zelle
  CHECK (method IS DISTINCT FROM 'zelle') NOT VALID;

ALTER TABLE fullchinavzla.credit_payments
  ADD CONSTRAINT credit_payments_method_no_zelle
  CHECK (method IS DISTINCT FROM 'zelle') NOT VALID;

ALTER TABLE fullchinavzla.purchases
  ADD CONSTRAINT purchases_payment_method_no_zelle
  CHECK (payment_method IS DISTINCT FROM 'zelle') NOT VALID;

ALTER TABLE fullchinavzla.purchase_payments
  ADD CONSTRAINT purchase_payments_method_no_zelle
  CHECK (method IS DISTINCT FROM 'zelle') NOT VALID;

ALTER TABLE fullchinavzla.expense_payments
  ADD CONSTRAINT expense_payments_method_no_zelle
  CHECK (method IS DISTINCT FROM 'zelle') NOT VALID;

COMMIT;
