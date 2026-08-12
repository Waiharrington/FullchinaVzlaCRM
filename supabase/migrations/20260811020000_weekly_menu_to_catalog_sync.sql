-- =============================================================================
-- Integración Menú Semanal → Catálogo de Ventas (sellable_products)
-- =============================================================================
-- Agrega FK de enlace y función RPC para sincronizar platos semanales al catálogo.

SET search_path TO fullchinavzla, public;

-- 1. Columna de enlace en weekly_menu_items
ALTER TABLE fullchinavzla.weekly_menu_items
  ADD COLUMN IF NOT EXISTS sellable_product_id UUID
    REFERENCES fullchinavzla.sellable_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_menu_sellable
  ON fullchinavzla.weekly_menu_items (sellable_product_id);

-- 2. Función RPC: sincroniza un plato semanal al catálogo de ventas
--    Si ya tiene sellable_product_id, actualiza el producto existente.
--    Si no, crea uno nuevo y retorna el ID.
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
    -- Ya está vinculado: actualizar
    UPDATE fullchinavzla.sellable_products
    SET name = v_dish.name,
        description = v_dish.description,
        price = v_dish.price,
        cost = v_dish.cost,
        emoji = v_dish.emoji,
        active = v_dish.is_active,
        updated_at = now()
    WHERE id = v_dish.sellable_product_id;
    v_product_id := v_dish.sellable_product_id;
  ELSE
    -- Verificar si ya existe por source_key (idempotente)
    SELECT id INTO v_product_id
    FROM fullchinavzla.sellable_products
    WHERE source_system = 'weekly_menu' AND source_key = v_source_key;

    IF v_product_id IS NULL THEN
      -- Crear nuevo
      INSERT INTO fullchinavzla.sellable_products (
        name, description, price, cost, emoji, category, active,
        source_system, source_key
      ) VALUES (
        v_dish.name, v_dish.description, v_dish.price, v_dish.cost,
        v_dish.emoji, 'especial_semanal', v_dish.is_active,
        'weekly_menu', v_source_key
      ) RETURNING id INTO v_product_id;
    ELSE
      -- Ya existía: actualizar
      UPDATE fullchinavzla.sellable_products
      SET name = v_dish.name,
          description = v_dish.description,
          price = v_dish.price,
          cost = v_dish.cost,
          emoji = v_dish.emoji,
          active = v_dish.is_active,
          updated_at = now()
      WHERE id = v_product_id;
    END IF;

    -- Vincular de vuelta al plato semanal
    UPDATE fullchinavzla.weekly_menu_items
    SET sellable_product_id = v_product_id,
        updated_at = now()
    WHERE id = p_weekly_dish_id;
  END IF;

  RETURN v_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_sync_weekly_dish_to_catalog(UUID) TO authenticated, service_role;
