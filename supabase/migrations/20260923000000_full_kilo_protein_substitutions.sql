-- Full Kilo: composición incluida y sustituciones sin recargo.
-- El grupo limita el total de proteínas a cuatro unidades; retirar una
-- proteína libera exactamente una sustitución para otra proteína.
DO $$
DECLARE
  v_modifier_id UUID;
  v_product_id UUID;
  v_option_id UUID;
  v_ingredient_id UUID;
  v_unit_id UUID;
  v_name TEXT;
  v_order INTEGER;
BEGIN
  INSERT INTO fullchinavzla.modifiers (source_system, source_key, name, display_order, min_selections, max_selections, allow_repeat, is_active)
  VALUES ('fullchina', 'full-kilo-proteins', 'Proteínas incluidas · Full Kilo', 10, 4, 4, true, true)
  ON CONFLICT (source_system, source_key) DO UPDATE SET
    name = EXCLUDED.name, min_selections = EXCLUDED.min_selections,
    max_selections = EXCLUDED.max_selections, allow_repeat = EXCLUDED.allow_repeat,
    is_active = true, updated_at = now()
  RETURNING id INTO v_modifier_id;

  IF v_modifier_id IS NULL THEN
    SELECT id INTO v_modifier_id FROM fullchinavzla.modifiers
    WHERE source_system = 'fullchina' AND source_key = 'full-kilo-proteins';
  END IF;

  FOR v_name, v_order IN SELECT * FROM (VALUES ('Pollo', 1), ('Camarón', 2), ('Jamón', 3), ('Cerdo', 4)) AS options(name, display_order)
  LOOP
    INSERT INTO fullchinavzla.modifier_options (modifier_id, source_system, source_key, name, sale_price, display_order, is_active)
    VALUES (v_modifier_id, 'fullchina', 'full-kilo-protein-' || lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')), v_name, 0, v_order, true)
    ON CONFLICT (source_system, source_key) DO UPDATE SET name = EXCLUDED.name, sale_price = 0, display_order = EXCLUDED.display_order, is_active = true, updated_at = now()
    RETURNING id INTO v_option_id;

    IF v_option_id IS NULL THEN
      SELECT id INTO v_option_id FROM fullchinavzla.modifier_options
      WHERE source_system = 'fullchina' AND source_key = 'full-kilo-protein-' || lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
    END IF;

    FOR v_product_id IN SELECT id FROM fullchinavzla.sellable_products WHERE name ILIKE '%Full Kilo%'
    LOOP
      INSERT INTO fullchinavzla.sellable_product_modifiers (sellable_product_id, modifier_id)
      VALUES (v_product_id, v_modifier_id) ON CONFLICT DO NOTHING;
    END LOOP;

    SELECT i.id, u.id INTO v_ingredient_id, v_unit_id
    FROM fullchinavzla.ingredients i CROSS JOIN LATERAL (SELECT id FROM fullchinavzla.units WHERE symbol IN ('kg', 'Kg', 'KG') OR name ILIKE '%kilogram%' LIMIT 1) u
    WHERE i.name ILIKE v_name LIMIT 1;
    IF v_ingredient_id IS NOT NULL AND v_unit_id IS NOT NULL THEN
      INSERT INTO fullchinavzla.modifier_option_ingredients (modifier_option_id, ingredient_id, quantity, unit_id)
      VALUES (v_option_id, v_ingredient_id, 0.25, v_unit_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
