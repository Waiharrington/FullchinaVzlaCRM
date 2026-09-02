-- Fase 1: consumo manual de almuerzo/cena del personal.
-- Agrupa todos los ingredientes de una comida con un mismo reference_id.

BEGIN;
SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_register_staff_meal_consumption(
  p_meal_type text,
  p_servings integer,
  p_items jsonb,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_role text := fullchinavzla.get_current_user_role();
  v_group_id uuid := gen_random_uuid();
  v_item jsonb;
  v_ingredient_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_base_unit uuid;
  v_notes text;
BEGIN
  IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Solo owner/manager pueden registrar consumos del personal'; END IF;
  IF p_meal_type NOT IN ('lunch', 'dinner') OR p_servings IS NULL OR p_servings <= 0 THEN RAISE EXCEPTION 'Tipo o cantidad de comida inválida'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Debe incluir al menos un ingrediente'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_ingredient_id := (v_item->>'ingredientId')::uuid;
    v_unit_id := (v_item->>'unitId')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero'; END IF;
    SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients WHERE id = v_ingredient_id AND is_active;
    IF v_base_unit IS NULL THEN RAISE EXCEPTION 'Ingrediente inválido o inactivo'; END IF;
    v_notes := format('Consumo interno - %s - %s persona(s)%s', CASE p_meal_type WHEN 'lunch' THEN 'almuerzo' ELSE 'cena' END, p_servings, CASE WHEN nullif(trim(coalesce(p_notes, '')), '') IS NULL THEN '' ELSE ': ' || trim(p_notes) END);
    INSERT INTO fullchinavzla.stock_movements (ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id, notes, created_by)
    VALUES (v_ingredient_id, -fullchinavzla.normalize_to_base_unit(v_ingredient_id, v_quantity, v_unit_id), v_base_unit, 'consumption', 'staff_meal', v_group_id, v_notes, auth.uid());
  END LOOP;
  RETURN v_group_id;
END;
$function$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_register_staff_meal_consumption(text, integer, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_register_staff_meal_consumption(text, integer, jsonb, text) TO authenticated, service_role;
COMMIT;
