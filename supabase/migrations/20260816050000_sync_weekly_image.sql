-- =============================================================================
-- FULL CHINA VZLA - El sync de menú semanal también propaga la foto (image_url)
-- =============================================================================
-- fn_sync_weekly_dish_to_catalog ahora copia weekly_menu_items.image_url a
-- sellable_products.image_url, para que la foto del plato especial aparezca en
-- Caja igual que en el módulo de Menú Semanal.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_sync_weekly_dish_to_catalog(p_weekly_dish_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_dish fullchinavzla.weekly_menu_items%ROWTYPE;
  v_product_id UUID;
  v_source_key TEXT;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_dish FROM fullchinavzla.weekly_menu_items WHERE id = p_weekly_dish_id;
  IF v_dish.id IS NULL THEN
    RAISE EXCEPTION 'Plato semanal no encontrado';
  END IF;

  v_source_key := 'weekly:' || v_dish.id::TEXT;

  IF v_dish.sellable_product_id IS NOT NULL THEN
    UPDATE fullchinavzla.sellable_products
    SET name = v_dish.name, description = v_dish.description, price = v_dish.price,
        cost = v_dish.cost, emoji = v_dish.emoji, image_url = v_dish.image_url,
        active = v_dish.is_active, updated_at = now()
    WHERE id = v_dish.sellable_product_id;
    v_product_id := v_dish.sellable_product_id;
  ELSE
    SELECT id INTO v_product_id
    FROM fullchinavzla.sellable_products
    WHERE source_system = 'weekly_menu' AND source_key = v_source_key;

    IF v_product_id IS NULL THEN
      INSERT INTO fullchinavzla.sellable_products (
        name, description, price, cost, emoji, image_url, category, active,
        source_system, source_key
      ) VALUES (
        v_dish.name, v_dish.description, v_dish.price, v_dish.cost,
        v_dish.emoji, v_dish.image_url, 'especial_semanal', v_dish.is_active,
        'weekly_menu', v_source_key
      ) RETURNING id INTO v_product_id;
    ELSE
      UPDATE fullchinavzla.sellable_products
      SET name = v_dish.name, description = v_dish.description, price = v_dish.price,
          cost = v_dish.cost, emoji = v_dish.emoji, image_url = v_dish.image_url,
          active = v_dish.is_active, updated_at = now()
      WHERE id = v_product_id;
    END IF;

    UPDATE fullchinavzla.weekly_menu_items
    SET sellable_product_id = v_product_id, updated_at = now()
    WHERE id = p_weekly_dish_id;
  END IF;

  RETURN v_product_id;
END;
$$;

RESET ROLE;

COMMIT;
