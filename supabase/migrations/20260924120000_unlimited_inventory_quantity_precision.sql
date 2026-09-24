-- Quita escalas fijas que redondeaban cantidades fisicas al guardar.
-- NUMERIC sin precision/escala conserva los decimales ingresados por PostgreSQL.
BEGIN;

-- La vista de costo y su RPC reflejan el tipo de recipe_components.quantity.
DROP FUNCTION IF EXISTS fullchinavzla.fn_get_product_recipe_cost();
DROP VIEW IF EXISTS fullchinavzla.v_current_stock;
DROP VIEW IF EXISTS fullchinavzla.v_warehouse_stock;
DROP VIEW IF EXISTS fullchinavzla.v_product_recipe_cost;

ALTER TABLE fullchinavzla.stock_movements
  ALTER COLUMN quantity TYPE NUMERIC;

ALTER TABLE fullchinavzla.purchase_items
  ALTER COLUMN quantity TYPE NUMERIC;

ALTER TABLE fullchinavzla.preparation_batches
  DROP COLUMN waste_percentage,
  ALTER COLUMN quantity_produced TYPE NUMERIC,
  ALTER COLUMN waste_quantity TYPE NUMERIC;

ALTER TABLE fullchinavzla.preparation_batches
  ADD COLUMN waste_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN quantity_produced + waste_quantity > 0
      THEN round(waste_quantity / (quantity_produced + waste_quantity) * 100, 2)
      ELSE 0
    END
  ) STORED;

ALTER TABLE fullchinavzla.preparation_batch_items
  ALTER COLUMN quantity_used TYPE NUMERIC;

ALTER TABLE fullchinavzla.recipe_components
  ALTER COLUMN quantity TYPE NUMERIC;

ALTER TABLE fullchinavzla.portion_recipes
  ALTER COLUMN portion_quantity TYPE NUMERIC;

ALTER TABLE fullchinavzla.modifier_option_ingredients
  ALTER COLUMN quantity TYPE NUMERIC;

ALTER TABLE fullchinavzla.inventory_requisitions
  ALTER COLUMN quantity TYPE NUMERIC;

CREATE VIEW fullchinavzla.v_current_stock
WITH (security_invoker = true) AS
SELECT i.id AS ingredient_id, i.name AS ingredient_name,
  u.id AS unit_id, u.name AS unit_name, u.symbol AS unit_symbol,
  COALESCE(SUM(sm.quantity) FILTER (WHERE sm.stock_location = 'operational'), 0) AS current_stock,
  ic.price_per_unit,
  COALESCE(SUM(sm.quantity) FILTER (WHERE sm.stock_location = 'operational'), 0) * ic.price_per_unit AS stock_value
FROM fullchinavzla.ingredients i
JOIN fullchinavzla.units u ON i.unit_id = u.id
LEFT JOIN fullchinavzla.stock_movements sm ON sm.ingredient_id = i.id
LEFT JOIN fullchinavzla.ingredient_costs ic ON ic.ingredient_id = i.id
WHERE i.is_active = true
GROUP BY i.id, i.name, u.id, u.name, u.symbol, ic.price_per_unit;

CREATE VIEW fullchinavzla.v_warehouse_stock
WITH (security_invoker = true) AS
SELECT i.id AS ingredient_id, i.name AS ingredient_name,
  u.id AS unit_id, u.name AS unit_name, u.symbol AS unit_symbol,
  COALESCE(SUM(sm.quantity) FILTER (WHERE sm.stock_location = 'warehouse'), 0) AS current_stock,
  ic.price_per_unit,
  COALESCE(SUM(sm.quantity) FILTER (WHERE sm.stock_location = 'warehouse'), 0) * ic.price_per_unit AS stock_value
FROM fullchinavzla.ingredients i
JOIN fullchinavzla.units u ON i.unit_id = u.id
LEFT JOIN fullchinavzla.stock_movements sm ON sm.ingredient_id = i.id
LEFT JOIN fullchinavzla.ingredient_costs ic ON ic.ingredient_id = i.id
WHERE i.is_active = true
GROUP BY i.id, i.name, u.id, u.name, u.symbol, ic.price_per_unit;

GRANT SELECT ON fullchinavzla.v_current_stock TO authenticated;
GRANT SELECT ON fullchinavzla.v_warehouse_stock TO authenticated;

CREATE VIEW fullchinavzla.v_product_recipe_cost
WITH (security_invoker = true) AS
SELECT
  sp.id AS sellable_product_id,
  sp.name AS product_name,
  sp.price AS sale_price,
  COALESCE(SUM(
    CASE
      WHEN rc.ingredient_id IS NOT NULL THEN rc.quantity * COALESCE(ic.price_per_unit, 0)
      WHEN rc.preparation_batch_id IS NOT NULL THEN rc.quantity * COALESCE(pbc.total_input_cost / NULLIF(pb.quantity_produced, 0), 0)
      ELSE 0
    END
  ), 0) AS recipe_cost,
  sp.price - COALESCE(SUM(
    CASE
      WHEN rc.ingredient_id IS NOT NULL THEN rc.quantity * COALESCE(ic.price_per_unit, 0)
      WHEN rc.preparation_batch_id IS NOT NULL THEN rc.quantity * COALESCE(pbc.total_input_cost / NULLIF(pb.quantity_produced, 0), 0)
      ELSE 0
    END
  ), 0) AS margin_estimated
FROM fullchinavzla.sellable_products sp
LEFT JOIN fullchinavzla.recipe_components rc ON rc.sellable_product_id = sp.id
LEFT JOIN fullchinavzla.ingredient_costs ic ON rc.ingredient_id = ic.ingredient_id
LEFT JOIN fullchinavzla.preparation_batch_costs pbc ON rc.preparation_batch_id = pbc.preparation_batch_id
LEFT JOIN fullchinavzla.preparation_batches pb ON rc.preparation_batch_id = pb.id
WHERE sp.is_active = true
GROUP BY sp.id, sp.name, sp.price;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_product_recipe_cost()
RETURNS SETOF fullchinavzla.v_product_recipe_cost
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF fullchinavzla.get_current_user_role() IS NULL OR fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Acceso denegado: solo owner/manager pueden consultar costos de receta';
  END IF;
  RETURN QUERY SELECT * FROM fullchinavzla.v_product_recipe_cost;
END;
$$;

GRANT SELECT ON fullchinavzla.v_product_recipe_cost TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_product_recipe_cost() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
