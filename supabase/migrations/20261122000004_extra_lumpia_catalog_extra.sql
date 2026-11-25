-- Extra de Lumpia como extra del catálogo público (sección "Agrega extras").
-- Copia precio, imagen y receta de "Lumpias — Extra" (que sigue en Raciones).
BEGIN;

DO $$
DECLARE
  v_src UUID;
  v_new UUID;
BEGIN
  SELECT id INTO v_src FROM fullchinavzla.sellable_products WHERE name = 'Lumpias — Extra';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No se encontró Lumpias — Extra'; END IF;
  IF EXISTS (SELECT 1 FROM fullchinavzla.sellable_products WHERE name = 'Extras — Extra de Lumpia') THEN
    RETURN;
  END IF;

  INSERT INTO fullchinavzla.sellable_products
    (name, description, price, cost, category, emoji, image_url, is_active, public_visible, allow_protein_extras)
  SELECT 'Extras — Extra de Lumpia', description, price, cost, 'extras', emoji, image_url, true, true, true
    FROM fullchinavzla.sellable_products WHERE id = v_src
  RETURNING id INTO v_new;

  INSERT INTO fullchinavzla.recipe_components
    (sellable_product_id, ingredient_id, preparation_batch_id, quantity, unit_id, portion_recipe_id)
  SELECT v_new, ingredient_id, preparation_batch_id, quantity, unit_id, portion_recipe_id
    FROM fullchinavzla.recipe_components WHERE sellable_product_id = v_src;
END $$;

COMMIT;
