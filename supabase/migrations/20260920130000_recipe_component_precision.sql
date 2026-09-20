-- Permite cantidades pequeñas en ingredientes de recetas, por ejemplo 0.005 L.
-- La pantalla acepta hasta seis decimales y conserva la precisión ingresada.
BEGIN;

-- La vista de costos y su RPC dependen del tipo de esta columna. Se recrean
-- dentro de la misma transacción para mantener el cálculo intacto.
DROP FUNCTION IF EXISTS fullchinavzla.fn_get_product_recipe_cost();
DROP VIEW IF EXISTS fullchinavzla.v_product_recipe_cost;

ALTER TABLE fullchinavzla.recipe_components
  ALTER COLUMN quantity TYPE NUMERIC(14,6);

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

COMMIT;
