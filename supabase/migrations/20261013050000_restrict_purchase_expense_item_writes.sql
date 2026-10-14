BEGIN;

-- Default privileges grant CRUD to authenticated/service_role. These rows are
-- created only through fn_save_mixed_purchase, whose SECURITY DEFINER owner
-- maintains the expense and inventory ledgers atomically.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON fullchinavzla.purchase_expense_items FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON fullchinavzla.purchase_expense_items TO authenticated, service_role;

COMMIT;
