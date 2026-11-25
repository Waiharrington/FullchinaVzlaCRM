-- Los Cantonés Full Kilo llevan Carne en la receta (además de Pollo, Camarón,
-- Jamón y Cerdo), pero el grupo compartido "Proteínas incluidas · Full Kilo"
-- solo ofrecía 4. Se les crea un grupo propio de 5 proteínas y se desvinculan
-- del compartido. El trigger de stock aplica por nombre "Proteínas incluidas".
BEGIN;

DO $$
DECLARE
  v_modifier_id UUID;
  v_shared_id UUID;
  v_product_id UUID;
  v_option_id UUID;
  v_ingredient_id UUID;
  v_name TEXT;
  v_order INTEGER;
BEGIN
  SELECT id INTO v_shared_id FROM fullchinavzla.modifiers
   WHERE source_system = 'fullchina' AND source_key = 'full-kilo-proteins';

  INSERT INTO fullchinavzla.modifiers
    (source_system, source_key, name, display_order, min_selections, max_selections, allow_repeat, is_active)
  VALUES ('fullchina', 'cantones-full-kilo-proteins', 'Proteínas incluidas · Cantonés', 10, 0, 5, true, true)
  ON CONFLICT (source_system, source_key) DO UPDATE SET
    name = EXCLUDED.name, min_selections = 0, max_selections = 5,
    allow_repeat = true, is_active = true, updated_at = now()
  RETURNING id INTO v_modifier_id;

  FOR v_name, v_order IN SELECT * FROM (VALUES ('Pollo', 1), ('Camarón', 2), ('Jamón', 3), ('Cerdo', 4), ('Carne', 5)) AS o(name, display_order)
  LOOP
    INSERT INTO fullchinavzla.modifier_options
      (modifier_id, source_system, source_key, name, sale_price, display_order, is_active)
    VALUES (v_modifier_id, 'fullchina',
            'cantones-full-kilo-protein-' || lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')),
            v_name, 0, v_order, true)
    ON CONFLICT (source_system, source_key) DO UPDATE SET
      name = EXCLUDED.name, sale_price = 0, display_order = EXCLUDED.display_order,
      is_active = true, updated_at = now()
    RETURNING id INTO v_option_id;

    IF v_name = 'Carne' THEN
      SELECT id INTO v_ingredient_id FROM fullchinavzla.ingredients WHERE name = 'Carne';
      INSERT INTO fullchinavzla.modifier_option_ingredients
        (modifier_option_id, ingredient_id, quantity, unit_id, order_type_code)
      SELECT v_option_id, v_ingredient_id, moi.quantity, moi.unit_id, moi.order_type_code
        FROM fullchinavzla.modifier_options src
        JOIN fullchinavzla.modifier_option_ingredients moi ON moi.modifier_option_id = src.id
       WHERE src.modifier_id = v_shared_id AND src.name = 'Pollo' AND v_ingredient_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO fullchinavzla.modifier_option_ingredients
        (modifier_option_id, ingredient_id, quantity, unit_id, order_type_code)
      SELECT v_option_id, moi.ingredient_id, moi.quantity, moi.unit_id, moi.order_type_code
        FROM fullchinavzla.modifier_options src
        JOIN fullchinavzla.modifier_option_ingredients moi ON moi.modifier_option_id = src.id
       WHERE src.modifier_id = v_shared_id AND src.name = v_name
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR v_product_id IN SELECT id FROM fullchinavzla.sellable_products
                       WHERE name IN ('Arroz Cantonés — Full Kilo', 'Full Kilo Cantonés')
  LOOP
    INSERT INTO fullchinavzla.sellable_product_modifiers (sellable_product_id, modifier_id)
    VALUES (v_product_id, v_modifier_id) ON CONFLICT DO NOTHING;
    DELETE FROM fullchinavzla.sellable_product_modifiers
     WHERE sellable_product_id = v_product_id AND modifier_id = v_shared_id;
  END LOOP;
END $$;

COMMIT;
