-- Fase 2: permite confirmar desde Telegram un borrador de almuerzo/cena.
-- El registro es idempotente mediante ai_intake_messages.result_reference_id.

BEGIN;

ALTER TABLE fullchinavzla.ai_intake_messages
  ADD COLUMN IF NOT EXISTS result_reference_id UUID;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_ai_finalize_staff_meal(
  p_draft_id UUID,
  p_profile_id UUID
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_draft fullchinavzla.ai_intake_messages%ROWTYPE;
  v_data JSONB;
  v_role TEXT;
  v_meal_type TEXT;
  v_servings INTEGER;
  v_product_id UUID;
  v_group_id UUID;
  v_product_name TEXT;
  v_notes TEXT;
  v_has_component BOOLEAN := false;
  v_normalized NUMERIC;
  v_base_unit UUID;
  component RECORD;
BEGIN
  SELECT role INTO v_role FROM fullchinavzla.profiles
  WHERE id = p_profile_id AND is_active;
  IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'AI actor is not authorized'; END IF;

  SELECT * INTO v_draft FROM fullchinavzla.ai_intake_messages
  WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.result_reference_id IS NOT NULL THEN
    RETURN json_build_object('ok', true, 'result_id', v_draft.result_reference_id, 'already_registered', true);
  END IF;
  IF v_draft.status NOT IN ('awaiting_confirmation', 'approved') THEN
    RAISE EXCEPTION 'Draft is not confirmable';
  END IF;

  v_data := v_draft.extracted_data;
  v_meal_type := CASE lower(COALESCE(v_data->>'meal_type', v_data->>'mealType'))
    WHEN 'almuerzo' THEN 'lunch' WHEN 'comida' THEN 'lunch' WHEN 'lunch' THEN 'lunch'
    WHEN 'cena' THEN 'dinner' WHEN 'dinner' THEN 'dinner' END;
  v_servings := COALESCE(NULLIF(v_data->>'servings','')::INTEGER, NULLIF(v_data->>'portions','')::INTEGER);
  v_product_name := NULLIF(trim(COALESCE(v_data->>'recipe_name', v_data->>'product_name', v_data->>'concept')), '');
  IF v_meal_type IS NULL OR v_servings IS NULL OR v_servings <= 0 OR v_product_name IS NULL THEN
    RAISE EXCEPTION 'Faltan tipo de comida, personas o receta';
  END IF;

  SELECT id INTO v_product_id FROM fullchinavzla.sellable_products
  WHERE is_active AND NOT is_delivery AND lower(name) = lower(v_product_name)
  ORDER BY id LIMIT 1;
  IF v_product_id IS NULL THEN
    SELECT id INTO v_product_id FROM fullchinavzla.sellable_products
    WHERE is_active AND NOT is_delivery AND lower(name) LIKE '%' || lower(v_product_name) || '%'
    ORDER BY length(name), id LIMIT 1;
  END IF;
  IF v_product_id IS NULL THEN RAISE EXCEPTION 'No encontré la receta: %', v_product_name; END IF;

  v_group_id := gen_random_uuid();
  v_notes := format('Consumo interno desde Telegram - %s - %s persona(s)', CASE v_meal_type WHEN 'lunch' THEN 'almuerzo' ELSE 'cena' END, v_servings);
  FOR component IN
    SELECT rc.ingredient_id, rc.quantity, rc.unit_id
    FROM fullchinavzla.recipe_components rc
    JOIN fullchinavzla.ingredients i ON i.id = rc.ingredient_id AND i.is_active
    WHERE rc.sellable_product_id = v_product_id AND rc.ingredient_id IS NOT NULL
  LOOP
    v_has_component := true;
    v_normalized := fullchinavzla.normalize_to_base_unit(component.ingredient_id, component.quantity * v_servings, component.unit_id);
    SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients WHERE id = component.ingredient_id;
    IF v_normalized IS NOT NULL AND v_normalized <> 0 THEN
      INSERT INTO fullchinavzla.stock_movements
        (ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id, notes, created_by)
      VALUES (component.ingredient_id, -v_normalized, v_base_unit, 'consumption', 'staff_meal', v_group_id, v_notes, p_profile_id);
    END IF;
  END LOOP;
  IF NOT v_has_component THEN RAISE EXCEPTION 'La receta no tiene ingredientes activos configurados'; END IF;

  UPDATE fullchinavzla.ai_intake_messages
  SET status = 'approved', approved_by = p_profile_id, approved_at = now(), result_reference_id = v_group_id
  WHERE id = p_draft_id;
  RETURN json_build_object('ok', true, 'result_id', v_group_id, 'already_registered', false);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_ai_finalize_staff_meal(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_ai_finalize_staff_meal(UUID, UUID) TO service_role;

COMMIT;
