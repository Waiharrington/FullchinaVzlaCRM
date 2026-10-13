BEGIN;

-- Purchase unit costs are stored in USD and may be entered with up to four decimals.
ALTER TABLE fullchinavzla.purchase_items
  ALTER COLUMN unit_cost TYPE NUMERIC(16,4)
  USING unit_cost::NUMERIC(16,4);

COMMENT ON COLUMN fullchinavzla.purchase_items.unit_cost IS
  'Unit cost in USD, with up to four decimal places';

NOTIFY pgrst, 'reload schema';
COMMIT;
