-- =============================================================================
-- FIX: el producto oculto "Delivery" (is_delivery) tenía componentes de receta
-- heredados de cuando era un producto normal. Al insertar el renglón de delivery,
-- el trigger fn_consume_recipe_stock_on_sale intentaba descontar ese ingrediente
-- y fallaba (conversión de unidad inválida) -> POST /order_items 400.
-- El delivery es un cargo, no consume inventario: se le quita toda la receta.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

DELETE FROM fullchinavzla.recipe_components
WHERE sellable_product_id IN (
  SELECT id FROM fullchinavzla.sellable_products WHERE is_delivery = true
);

COMMIT;
