-- Fase 2: descuenta automáticamente la receta seleccionada por porciones.

BEGIN;
SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_register_staff_meal_recipe_consumption(
  p_meal_type text,
  p_servings integer,
  p_product_id uuid,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_role text := fullchinavzla.get_current_user_role();
  v_group_id uuid := gen_random_uuid();
  v_base_unit uuid;
  v_normalized numeric;
  v_notes text;
  v_has_component boolean := false;
  component record;
BEGIN
  IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Solo owner/manager pueden registrar consumos del personal'; END IF;
  IF p_meal_type NOT IN ('lunch', 'dinner') OR p_servings IS NULL OR p_servings <= 0 THEN RAISE EXCEPTION 'Tipo o cantidad de comida inválida'; END IF;
  IF p_product_id IS NULL THEN RAISE EXCEPTION 'Debe seleccionar una receta'; END IF;

  v_notes := format('Consumo interno - %s - %s persona(s)%s', CASE p_meal_type WHEN 'lunch' THEN 'almuerzo' ELSE 'cena' END, p_servings, CASE WHEN nullif(trim(coalesce(p_notes, '')), '') IS NULL THEN '' ELSE ': ' || trim(p_notes) END);

  FOR component IN
    SELECT rc.ingredient_id, rc.quantity, rc.unit_id
    FROM fullchinavzla.recipe_components rc
    JOIN fullchinavzla.ingredients i ON i.id = rc.ingredient_id AND i.is_active
    WHERE rc.sellable_product_id = p_product_id AND rc.ingredient_id IS NOT NULL
  LOOP
    v_has_component := true;
    v_normalized := fullchinavzla.normalize_to_base_unit(component.ingredient_id, component.quantity * p_servings, component.unit_id);
    IF v_normalized IS NULL OR v_normalized = 0 THEN CONTINUE; END IF;
    SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients WHERE id = component.ingredient_id;
    INSERT INTO fullchinavzla.stock_movements (ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id, notes, created_by)
    VALUES (component.ingredient_id, -v_normalized, v_base_unit, 'consumption', 'staff_meal', v_group_id, v_notes, auth.uid());
  END LOOP;
  IF NOT v_has_component THEN RAISE EXCEPTION 'La receta no tiene ingredientes activos configurados'; END IF;
  RETURN v_group_id;
END;
$function$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_register_staff_meal_recipe_consumption(text, integer, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_register_staff_meal_recipe_consumption(text, integer, uuid, text) TO authenticated, service_role;
COMMIT;
