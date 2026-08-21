-- Elimina un producto de una comanda AÚN NO cobrada y revierte su consumo de
-- inventario mediante un movimiento de ajuste compensatorio (el modelo de
-- stock es append-only). Espeja fn_reverse_recipe_stock_on_cancel pero acotado
-- a un solo order_item. El trigger trg_order_items_status_guard ya bloquea el
-- DELETE en órdenes cerradas; aquí además validamos el estado explícitamente.

CREATE OR REPLACE FUNCTION fullchinavzla.fn_remove_order_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_role     TEXT;
  v_order_id UUID;
  v_status   TEXT;
  v_rev      RECORD;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado para modificar la comanda. Rol: %', v_role;
  END IF;

  SELECT oi.order_id, o.status
    INTO v_order_id, v_status
  FROM fullchinavzla.order_items oi
  JOIN fullchinavzla.orders o ON o.id = oi.order_id
  WHERE oi.id = p_item_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'El producto no existe en ninguna comanda.';
  END IF;

  IF v_status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'No se puede modificar una comanda ya cobrada o cancelada.';
  END IF;

  -- Revertir el consumo (receta + modificadores) de este item. Se agrega por
  -- ingrediente para no depender del número de movimientos, y se protege con
  -- una guarda anti doble-reversa.
  FOR v_rev IN
    SELECT sm.ingredient_id, sm.unit_id, SUM(sm.quantity) AS total_qty
    FROM fullchinavzla.stock_movements sm
    WHERE sm.movement_type = 'consumption'
      AND sm.reference_type = 'order_item'
      AND sm.reference_id = p_item_id
    GROUP BY sm.ingredient_id, sm.unit_id
  LOOP
    IF v_rev.total_qty = 0 THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM fullchinavzla.stock_movements rev
      WHERE rev.movement_type = 'adjustment'
        AND rev.reference_type = 'order_item'
        AND rev.reference_id = p_item_id
        AND rev.ingredient_id = v_rev.ingredient_id
        AND rev.notes = 'Reversa por eliminacion de item'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO fullchinavzla.stock_movements (
      ingredient_id, quantity, unit_id, movement_type,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_rev.ingredient_id,
      -v_rev.total_qty,               -- consumo es negativo => reversa positiva
      v_rev.unit_id,
      'adjustment',
      'order_item',
      p_item_id,
      'Reversa por eliminacion de item',
      auth.uid()
    );
  END LOOP;

  -- Eliminar modificadores y el item (permitido en órdenes abiertas).
  DELETE FROM fullchinavzla.order_item_modifiers WHERE order_item_id = p_item_id;
  DELETE FROM fullchinavzla.order_items WHERE id = p_item_id;
END;
$function$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_remove_order_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_remove_order_item(uuid) TO authenticated;
