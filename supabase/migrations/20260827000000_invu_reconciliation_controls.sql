-- Controls for the INVU reconciliation approved on 2026-08-27.
-- Additive and idempotent: it preserves historical purchases and stock moves.

BEGIN;

ALTER TABLE fullchinavzla.ingredients
  ADD COLUMN IF NOT EXISTS inventory_class TEXT NOT NULL DEFAULT 'raw_material';

ALTER TABLE fullchinavzla.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_inventory_class_check;

ALTER TABLE fullchinavzla.ingredients
  ADD CONSTRAINT ingredients_inventory_class_check
  CHECK (inventory_class IN ('raw_material', 'packaging', 'beverage', 'non_inventory'));

-- These are operational charges, not stock-managed ingredients. Existing rows
-- remain traceable; only future inventory views exclude them.
UPDATE fullchinavzla.ingredients
SET inventory_class = 'non_inventory'
WHERE lower(regexp_replace(name, '[^a-z0-9]+', '', 'gi')) IN ('delivery', 'propinas');

CREATE TABLE IF NOT EXISTS fullchinavzla.supplier_aliases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES fullchinavzla.suppliers(id) ON DELETE CASCADE,
  alias         TEXT NOT NULL,
  normalized_alias TEXT GENERATED ALWAYS AS
    (lower(regexp_replace(alias, '[^a-z0-9]+', '', 'gi'))) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, normalized_alias),
  UNIQUE (normalized_alias)
);

COMMENT ON TABLE fullchinavzla.supplier_aliases IS
  'Aliases de proveedores para evitar duplicados durante importaciones y asistente IA';

-- Euromercado Bolivares is an alias of the supplier with historical purchases.
INSERT INTO fullchinavzla.supplier_aliases (supplier_id, alias)
SELECT canonical.id, 'Euromercado Bolivares'
FROM fullchinavzla.suppliers canonical
WHERE lower(regexp_replace(canonical.name, '[^a-z0-9]+', '', 'gi')) = 'euromercado'
  AND EXISTS (
    SELECT 1 FROM fullchinavzla.suppliers duplicate
    WHERE lower(regexp_replace(duplicate.name, '[^a-z0-9]+', '', 'gi')) = 'euromercadobolivares'
  )
ON CONFLICT (normalized_alias) DO NOTHING;

CREATE OR REPLACE VIEW fullchinavzla.v_current_stock
WITH (security_invoker = true) AS
SELECT
  i.id AS ingredient_id,
  i.name AS ingredient_name,
  u.id AS unit_id,
  u.name AS unit_name,
  u.symbol AS unit_symbol,
  COALESCE(SUM(sm.quantity), 0) AS current_stock,
  ic.price_per_unit,
  COALESCE(SUM(sm.quantity), 0) * ic.price_per_unit AS stock_value
FROM fullchinavzla.ingredients i
JOIN fullchinavzla.units u ON i.unit_id = u.id
LEFT JOIN fullchinavzla.stock_movements sm ON sm.ingredient_id = i.id
LEFT JOIN fullchinavzla.ingredient_costs ic ON ic.ingredient_id = i.id
WHERE i.is_active = true AND i.inventory_class <> 'non_inventory'
GROUP BY i.id, i.name, u.id, u.name, u.symbol, ic.price_per_unit;

CREATE OR REPLACE VIEW fullchinavzla.v_ingredients_safe
WITH (security_invoker = true) AS
SELECT i.id, i.name, i.unit_id, u.name AS unit_name, u.symbol AS unit_symbol,
       i.is_active, i.created_at
FROM fullchinavzla.ingredients i
JOIN fullchinavzla.units u ON i.unit_id = u.id
WHERE i.inventory_class <> 'non_inventory';

COMMIT;
