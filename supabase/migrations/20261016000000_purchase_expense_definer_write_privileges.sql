BEGIN;

-- SECURITY DEFINER routines are owned by postgres. The expense-item table is
-- owned by supabase_admin, so postgres needs explicit write privileges for the
-- purchase editor's sync trigger and mixed-invoice save routine.
GRANT INSERT, UPDATE, DELETE
  ON TABLE fullchinavzla.purchase_expense_items
  TO postgres;

COMMIT;
