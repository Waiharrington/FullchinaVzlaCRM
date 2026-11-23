-- Clásico Full Kilo solo lleva Pollo y Jamón (más huevo, que no es quitable).
-- Antes compartía el grupo "Proteínas incluidas · Full Kilo" (Pollo, Camarón,
-- Jamón, Cerdo), por lo que la página pública ofrecía quitar Camarón y Cerdo.
-- Se le crea un grupo propio y se desvincula del compartido. El trigger
-- trg_reconcile_web_order_protein_stock aplica a cualquier grupo cuyo nombre
-- empiece por "Proteínas incluidas", así que el ajuste de stock sigue igual.
BEGIN;

DO $$
DECLARE
  v_modifier_id UUID;
  v_shared_id UUID;
  v_product_id UUID;
  v_option_id UUID;
  v_name TEXT;
  v_order INTEGER;
BEGIN
  SELECT id INTO v_shared_id FROM fullchinavzla.modifiers
   WHERE source_system = 'fullchina' AND source_key = 'full-kilo-proteins';
  SELECT id INTO v_product_id FROM fullchinavzla.sellable_products
   WHERE name = 'Clásico — Full Kilo';
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el producto Clásico — Full Kilo';
  END IF;

  INSERT INTO fullchinavzla.modifiers
    (source_system, source_key, name, display_order, min_selections, max_selections, allow_repeat, is_active)
  VALUES ('fullchina', 'clasico-full-kilo-proteins', 'Proteínas incluidas · Clásico', 10, 0, 2, true, true)
  ON CONFLICT (source_system, source_key) DO UPDATE SET
    name = EXCLUDED.name, min_selections = 0, max_selections = 2,
    allow_repeat = true, is_active = true, updated_at = now()
  RETURNING id INTO v_modifier_id;

  FOR v_name, v_order IN SELECT * FROM (VALUES ('Pollo', 1), ('Jamón', 2)) AS o(name, display_order)
  LOOP
    INSERT INTO fullchinavzla.modifier_options
      (modifier_id, source_system, source_key, name, sale_price, display_order, is_active)
    VALUES (v_modifier_id, 'fullchina',
            'clasico-full-kilo-protein-' || lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')),
            v_name, 0, v_order, true)
    ON CONFLICT (source_system, source_key) DO UPDATE SET
      name = EXCLUDED.name, sale_price = 0, display_order = EXCLUDED.display_order,
      is_active = true, updated_at = now()
    RETURNING id INTO v_option_id;

    -- Mismo vínculo con inventario que la opción equivalente del grupo compartido.
    INSERT INTO fullchinavzla.modifier_option_ingredients
      (modifier_option_id, ingredient_id, quantity, unit_id, order_type_code)
    SELECT v_option_id, moi.ingredient_id, moi.quantity, moi.unit_id, moi.order_type_code
      FROM fullchinavzla.modifier_options src
      JOIN fullchinavzla.modifier_option_ingredients moi ON moi.modifier_option_id = src.id
     WHERE src.modifier_id = v_shared_id AND src.name = v_name
    ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO fullchinavzla.sellable_product_modifiers (sellable_product_id, modifier_id)
  VALUES (v_product_id, v_modifier_id) ON CONFLICT DO NOTHING;

  DELETE FROM fullchinavzla.sellable_product_modifiers
   WHERE sellable_product_id = v_product_id AND modifier_id = v_shared_id;
END $$;

COMMIT;
