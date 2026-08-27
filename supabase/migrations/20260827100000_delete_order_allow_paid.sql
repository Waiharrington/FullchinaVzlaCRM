-- =============================================================================
-- Permite eliminar comandas pagadas (borra pagos, revierte inventario).
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_role     TEXT;
  v_status   TEXT;
  v_item     RECORD;
  v_rev      RECORD;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado para eliminar comandas. Rol: %', v_role;
  END IF;

  SELECT status INTO v_status
  FROM fullchinavzla.orders
  WHERE id = p_order_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'La comanda no existe.';
  END IF;

  -- Revertir consumo de inventario para cada item
  FOR v_item IN
    SELECT oi.id AS item_id
    FROM fullchinavzla.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    FOR v_rev IN
      SELECT sm.ingredient_id, sm.unit_id, SUM(sm.quantity) AS total_qty
      FROM fullchinavzla.stock_movements sm
      WHERE sm.movement_type = 'consumption'
        AND sm.reference_type = 'order_item'
        AND sm.reference_id = v_item.item_id
      GROUP BY sm.ingredient_id, sm.unit_id
    LOOP
      IF v_rev.total_qty = 0 THEN
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM fullchinavzla.stock_movements rev
        WHERE rev.movement_type = 'adjustment'
          AND rev.reference_type = 'order_item'
          AND rev.reference_id = v_item.item_id
          AND rev.ingredient_id = v_rev.ingredient_id
          AND rev.notes = 'Reversa por eliminacion de comanda'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO fullchinavzla.stock_movements (
        ingredient_id, quantity, unit_id, movement_type,
        reference_type, reference_id, notes, created_by
      ) VALUES (
        v_rev.ingredient_id,
        -v_rev.total_qty,
        v_rev.unit_id,
        'adjustment',
        'order_item',
        v_item.item_id,
        'Reversa por eliminacion de comanda',
        auth.uid()
      );
    END LOOP;
  END LOOP;

  -- Limpiar referencias de pedidos web
  UPDATE fullchinavzla.web_order_requests
  SET converted_order_id = NULL
  WHERE converted_order_id = p_order_id;

  -- Eliminar pagos, modificadores, items y la comanda
  DELETE FROM fullchinavzla.payments WHERE order_id = p_order_id;

  DELETE FROM fullchinavzla.order_item_modifiers
  WHERE order_item_id IN (SELECT id FROM fullchinavzla.order_items WHERE order_id = p_order_id);

  DELETE FROM fullchinavzla.order_items WHERE order_id = p_order_id;

  DELETE FROM fullchinavzla.orders WHERE id = p_order_id;
END;
$function$;

COMMIT;
