BEGIN;

-- Permite eliminar una compra solo mediante una operación controlada. La entrada
-- original de stock nunca se borra: se registra un ajuste inverso para conservar
-- el historial append-only de inventario.

CREATE OR REPLACE FUNCTION fullchinavzla.fn_protect_purchase_delete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF current_setting('fullchinavzla.purchase_delete_in_progress', true) = 'on' THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM fullchinavzla.stock_movements
    WHERE reference_type = 'purchase_item'
      AND reference_id IN (
        SELECT id FROM fullchinavzla.purchase_items WHERE purchase_id = OLD.id
      )
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar compra %: tiene stock asociado. Use ajustes.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_protect_purchase_item_edit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF current_setting('fullchinavzla.purchase_delete_in_progress', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF EXISTS (
    SELECT 1 FROM fullchinavzla.stock_movements
    WHERE reference_type = 'purchase_item' AND reference_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'El item de compra % ya generó stock. Para corregir, use un movimiento de ajuste documentado.', OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_purchase(p_purchase_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_item RECORD;
  v_base_unit UUID;
  v_quantity NUMERIC;
  v_available NUMERIC;
  v_creator UUID;
  v_ingredients UUID[];
  v_ingredient_id UUID;
  v_latest RECORD;
  v_price NUMERIC(12,2);
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager pueden eliminar compras';
  END IF;

  SELECT created_by INTO v_creator
  FROM fullchinavzla.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra no encontrada';
  END IF;

  SELECT ARRAY_AGG(DISTINCT ingredient_id) INTO v_ingredients
  FROM fullchinavzla.purchase_items
  WHERE purchase_id = p_purchase_id;

  FOR v_item IN
    SELECT pi.ingredient_id, pi.quantity, pi.unit_id
    FROM fullchinavzla.purchase_items pi
    WHERE pi.purchase_id = p_purchase_id
  LOOP
    SELECT unit_id INTO v_base_unit
    FROM fullchinavzla.ingredients
    WHERE id = v_item.ingredient_id;

    v_quantity := CASE
      WHEN v_item.unit_id = v_base_unit THEN v_item.quantity
      ELSE fullchinavzla.normalize_to_base_unit(v_item.ingredient_id, v_item.quantity, v_item.unit_id)
    END;

    SELECT COALESCE(SUM(quantity), 0) INTO v_available
    FROM fullchinavzla.stock_movements
    WHERE ingredient_id = v_item.ingredient_id
      AND stock_location = 'warehouse';

    IF v_available < v_quantity THEN
      RAISE EXCEPTION 'No se puede eliminar: el insumo ya fue usado o transferido del almacén';
    END IF;

    INSERT INTO fullchinavzla.stock_movements (
      ingredient_id, quantity, unit_id, movement_type, reference_type,
      reference_id, stock_location, notes, created_by
    ) VALUES (
      v_item.ingredient_id, -v_quantity, v_base_unit, 'adjustment', 'manual',
      p_purchase_id, 'warehouse', 'Reversa por eliminación de compra', auth.uid()
    );
  END LOOP;

  PERFORM set_config('fullchinavzla.purchase_delete_in_progress', 'on', true);
  DELETE FROM fullchinavzla.purchase_items WHERE purchase_id = p_purchase_id;
  DELETE FROM fullchinavzla.purchases WHERE id = p_purchase_id;

  IF v_ingredients IS NOT NULL THEN
    FOREACH v_ingredient_id IN ARRAY v_ingredients
    LOOP
      SELECT pi.unit_cost, pi.unit_id, pi.ingredient_id
        INTO v_latest
      FROM fullchinavzla.purchase_items pi
      JOIN fullchinavzla.purchases p ON p.id = pi.purchase_id
      WHERE pi.ingredient_id = v_ingredient_id
      ORDER BY p.purchase_date DESC, p.created_at DESC, pi.created_at DESC
      LIMIT 1;

      IF FOUND THEN
        SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients WHERE id = v_ingredient_id;
        v_price := CASE
          WHEN v_latest.unit_id = v_base_unit THEN v_latest.unit_cost
          ELSE v_latest.unit_cost / fullchinavzla.normalize_to_base_unit(v_ingredient_id, 1, v_latest.unit_id)
        END;
        INSERT INTO fullchinavzla.ingredient_costs (ingredient_id, price_per_unit, updated_by)
        VALUES (v_ingredient_id, v_price, COALESCE(v_creator, auth.uid()))
        ON CONFLICT (ingredient_id) DO UPDATE SET
          price_per_unit = EXCLUDED.price_per_unit,
          last_updated = now(),
          updated_by = EXCLUDED.updated_by;
      ELSE
        UPDATE fullchinavzla.ingredient_costs
        SET price_per_unit = 0, last_updated = now(), updated_by = COALESCE(v_creator, auth.uid())
        WHERE ingredient_id = v_ingredient_id;
      END IF;
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_delete_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_delete_purchase(UUID) TO authenticated;

-- PostgREST necesita refrescar su caché para exponer el nuevo RPC.
NOTIFY pgrst, 'reload schema';

COMMIT;
