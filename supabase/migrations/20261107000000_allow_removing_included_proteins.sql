-- El cliente puede quitar proteínas incluidas sin sustituirlas.
-- Solo las opciones enviadas se registran; al confirmar se reconcilia el
-- consumo de la receta fija con las proteínas que quedaron seleccionadas.
BEGIN;

UPDATE fullchinavzla.modifiers AS m
SET min_selections = 0, updated_at = now()
WHERE lower(translate(m.name, 'íÍ', 'iI')) LIKE 'proteinas incluidas%'
  AND m.allow_repeat = true
  AND m.max_selections > 0
  AND m.min_selections = m.max_selections
  AND (SELECT count(*) FROM fullchinavzla.modifier_options AS o
       WHERE o.modifier_id = m.id AND o.is_active = true) = m.max_selections;

-- Los grupos de la receta siguen visibles aunque el plato no permita
-- proteínas adicionales. La opción de extras conserva su bloqueo.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_product_modifiers(p_product_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(g ORDER BY g->>'name'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'modifierId', m.id, 'name', m.name,
      'minSelections', COALESCE(m.min_selections, 0),
      'maxSelections', m.max_selections,
      'allowRepeat', COALESCE(m.allow_repeat, false),
      'options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price', o.sale_price)
          ORDER BY o.display_order, o.name)
        FROM fullchinavzla.modifier_options o
        WHERE o.modifier_id = m.id AND o.is_active = true
      ), '[]'::jsonb)
    ) AS g
    FROM fullchinavzla.sellable_product_modifiers spm
    JOIN fullchinavzla.modifiers m ON m.id = spm.modifier_id
    JOIN fullchinavzla.sellable_products p ON p.id = spm.sellable_product_id
    WHERE spm.sellable_product_id = p_product_id
      AND m.is_active = true
      AND (p.allow_protein_extras OR NOT (
        lower(translate(m.name, 'íÍ', 'iI')) LIKE '%proteina%'
        AND lower(translate(m.name, 'íÍ', 'iI')) NOT LIKE 'proteinas incluidas%'
        AND (lower(m.name) LIKE '%extra%' OR COALESCE(m.min_selections, 0) = 0)
      ))
  ) sub;
$$;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_product_modifiers(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_guard_disabled_protein_extras()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF NOT COALESCE((SELECT allow_protein_extras FROM fullchinavzla.sellable_products WHERE id = NEW.sellable_product_id), TRUE)
     AND EXISTS (
       SELECT 1
       FROM jsonb_array_elements(COALESCE(NEW.modifiers, '[]'::jsonb)) selected(value)
       JOIN fullchinavzla.modifiers modifier ON modifier.id = (selected.value->>'modifierId')::UUID
       WHERE lower(translate(modifier.name, 'íÍ', 'iI')) LIKE '%proteina%'
         AND lower(translate(modifier.name, 'íÍ', 'iI')) NOT LIKE 'proteinas incluidas%'
         AND (lower(modifier.name) LIKE '%extra%' OR COALESCE(modifier.min_selections, 0) = 0)
     ) THEN
    RAISE EXCEPTION 'Este plato no permite extras de proteína';
  END IF;
  RETURN NEW;
END;
$$;

-- La receta base se consume al insertar order_items, antes de guardar los
-- modificadores. Al confirmar un pedido web, compensar la proteína fija que
-- el cliente quitó (o descontar una incluida que esa receta no tenía).
-- El ajuste es append-only y ocurre en la misma transacción de confirmación.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_reconcile_web_order_protein_stock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_component RECORD;
  v_baseline NUMERIC;
  v_desired NUMERIC;
  v_delta NUMERIC;
  v_base_unit UUID;
BEGIN
  IF NEW.status <> 'confirmed' OR NEW.converted_order_id IS NULL
     OR OLD.status = 'confirmed' THEN
    RETURN NEW;
  END IF;

  FOR v_component IN
    SELECT wi.confirmed_order_item_id AS order_item_id,
           wi.quantity AS item_quantity,
           wi.modifiers,
           mo.id AS option_id,
           moi.ingredient_id,
           rc.quantity AS recipe_quantity,
           rc.unit_id AS recipe_unit_id,
           moi.unit_id AS option_unit_id,
           moi.quantity AS option_quantity,
           (SELECT rc2.quantity
              FROM fullchinavzla.recipe_components rc2
              JOIN fullchinavzla.sellable_product_modifiers spm2
                ON spm2.sellable_product_id = rc2.sellable_product_id
             WHERE spm2.modifier_id = m.id
               AND rc2.ingredient_id = moi.ingredient_id
             ORDER BY rc2.quantity DESC LIMIT 1) AS standard_quantity,
           (SELECT rc2.unit_id
              FROM fullchinavzla.recipe_components rc2
              JOIN fullchinavzla.sellable_product_modifiers spm2
                ON spm2.sellable_product_id = rc2.sellable_product_id
             WHERE spm2.modifier_id = m.id
               AND rc2.ingredient_id = moi.ingredient_id
             ORDER BY rc2.quantity DESC LIMIT 1) AS standard_unit_id
      FROM fullchinavzla.web_order_items wi
      JOIN fullchinavzla.sellable_product_modifiers spm
        ON spm.sellable_product_id = wi.sellable_product_id
      JOIN fullchinavzla.modifiers m ON m.id = spm.modifier_id
      JOIN fullchinavzla.modifier_options mo ON mo.modifier_id = m.id
      JOIN fullchinavzla.modifier_option_ingredients moi
        ON moi.modifier_option_id = mo.id
      LEFT JOIN fullchinavzla.recipe_components rc
        ON rc.sellable_product_id = wi.sellable_product_id
       AND rc.ingredient_id = moi.ingredient_id
     WHERE wi.request_id = NEW.id
       AND wi.confirmed_order_item_id IS NOT NULL
       AND lower(translate(m.name, 'íÍ', 'iI')) LIKE 'proteinas incluidas%'
       AND mo.is_active = true
  LOOP
    v_baseline := CASE WHEN v_component.recipe_quantity IS NULL THEN 0
      ELSE fullchinavzla.normalize_to_base_unit(
        v_component.ingredient_id, v_component.recipe_quantity,
        v_component.recipe_unit_id) END;
    SELECT COALESCE(sum((selected.value->>'quantity')::NUMERIC), 0)
      INTO v_desired
      FROM jsonb_array_elements(COALESCE(v_component.modifiers, '[]'::jsonb)) selected(value)
     WHERE selected.value->>'optionId' = v_component.option_id::TEXT;
    IF v_desired > 0 THEN
      IF v_component.standard_quantity IS NOT NULL THEN
        v_desired := fullchinavzla.normalize_to_base_unit(
          v_component.ingredient_id,
          v_component.standard_quantity * v_desired,
          v_component.standard_unit_id);
      ELSE
        v_desired := fullchinavzla.normalize_to_base_unit(
          v_component.ingredient_id,
          v_component.option_quantity * v_desired,
          v_component.option_unit_id);
      END IF;
    END IF;
    v_delta := (v_baseline - v_desired) * v_component.item_quantity;
    IF v_delta = 0 THEN CONTINUE; END IF;
    SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients
     WHERE id = v_component.ingredient_id;
    INSERT INTO fullchinavzla.stock_movements
      (ingredient_id, quantity, unit_id, movement_type,
       reference_type, reference_id, notes, created_by)
    VALUES
      (v_component.ingredient_id, v_delta, v_base_unit, 'adjustment',
       'order_item', v_component.order_item_id,
       'Ajuste de proteínas del pedido web', NEW.confirmed_by);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_web_order_protein_stock
  ON fullchinavzla.web_order_requests;
CREATE TRIGGER trg_reconcile_web_order_protein_stock
AFTER UPDATE OF status, converted_order_id ON fullchinavzla.web_order_requests
FOR EACH ROW
WHEN (NEW.status = 'confirmed' AND NEW.converted_order_id IS NOT NULL)
EXECUTE FUNCTION fullchinavzla.fn_reconcile_web_order_protein_stock();

COMMIT;
