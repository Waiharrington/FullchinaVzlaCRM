-- Evita agregar todas las ubicaciones y todos los movimientos cada vez que
-- el inventario o el dashboard consultan el saldo actual.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_ingredient_qty
  ON fullchinavzla.stock_movements (ingredient_id) INCLUDE (quantity)
  WHERE stock_location = 'warehouse';

CREATE OR REPLACE VIEW fullchinavzla.v_current_stock
WITH (security_invoker = true) AS
WITH operational_balances AS MATERIALIZED (
  SELECT ingredient_id, SUM(quantity) AS current_stock
  FROM fullchinavzla.stock_movements
  WHERE stock_location = 'operational'
  GROUP BY ingredient_id
), visible_costs AS MATERIALIZED (
  SELECT ingredient_id, price_per_unit
  FROM fullchinavzla.ingredient_costs
)
SELECT i.id AS ingredient_id, i.name AS ingredient_name,
  u.id AS unit_id, u.name AS unit_name, u.symbol AS unit_symbol,
  COALESCE(ob.current_stock, 0) AS current_stock,
  ic.price_per_unit,
  COALESCE(ob.current_stock, 0) * ic.price_per_unit AS stock_value
FROM fullchinavzla.ingredients i
JOIN fullchinavzla.units u ON i.unit_id = u.id
LEFT JOIN operational_balances ob ON ob.ingredient_id = i.id
LEFT JOIN visible_costs ic ON ic.ingredient_id = i.id
WHERE i.is_active = true;

CREATE OR REPLACE VIEW fullchinavzla.v_warehouse_stock
WITH (security_invoker = true) AS
WITH warehouse_balances AS MATERIALIZED (
  SELECT ingredient_id, SUM(quantity) AS current_stock
  FROM fullchinavzla.stock_movements
  WHERE stock_location = 'warehouse'
  GROUP BY ingredient_id
), visible_costs AS MATERIALIZED (
  SELECT ingredient_id, price_per_unit
  FROM fullchinavzla.ingredient_costs
)
SELECT i.id AS ingredient_id, i.name AS ingredient_name,
  u.id AS unit_id, u.name AS unit_name, u.symbol AS unit_symbol,
  COALESCE(wb.current_stock, 0) AS current_stock,
  ic.price_per_unit,
  COALESCE(wb.current_stock, 0) * ic.price_per_unit AS stock_value
FROM fullchinavzla.ingredients i
JOIN fullchinavzla.units u ON i.unit_id = u.id
LEFT JOIN warehouse_balances wb ON wb.ingredient_id = i.id
LEFT JOIN visible_costs ic ON ic.ingredient_id = i.id
WHERE i.is_active = true;

GRANT SELECT ON fullchinavzla.v_current_stock TO authenticated;
GRANT SELECT ON fullchinavzla.v_warehouse_stock TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
