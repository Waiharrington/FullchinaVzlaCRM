-- Allow fn_delete_order to delete items from paid/cancelled orders by
-- setting a session flag that the guard trigger respects.

BEGIN;

SET LOCAL ROLE supabase_admin;

-- 1. Guard trigger: skip when the bypass flag is set
CREATE OR REPLACE FUNCTION fullchinavzla.fn_protect_order_items_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_status TEXT;
BEGIN
  -- fn_delete_order sets this flag to bypass the guard
  IF current_setting('app.bypass_order_items_guard', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT o.status INTO v_status
  FROM fullchinavzla.orders o WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  IF v_status IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'No se puede modificar items de orden % en estado %. '
      'Los items son inmutables una vez cobrada o cancelada.', COALESCE(NEW.order_id, OLD.order_id), v_status;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. fn_delete_order: set the bypass flag before touching items
CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_role     TEXT;
  v_status   TEXT;
  v_order_no INTEGER;
  v_actor_id UUID := auth.uid();
  v_actor_name TEXT;
  v_item     RECORD;
  v_rev      RECORD;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado para eliminar comandas. Rol: %', v_role;
  END IF;

  SELECT status, order_number INTO v_status, v_order_no
  FROM fullchinavzla.orders
  WHERE id = p_order_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'La comanda no existe.';
  END IF;

  SELECT full_name INTO v_actor_name
  FROM fullchinavzla.profiles
  WHERE id = v_actor_id;

  PERFORM fullchinavzla.fn_log_audit(
    v_actor_id,
    COALESCE(v_actor_name, 'Sistema'),
    'Comandas',
    'Comanda eliminada',
    'Comanda #FC-' || LPAD(v_order_no::TEXT, 6, '0') || ' eliminada',
    'danger'
  );

  -- Bypass the order_items guard trigger for this transaction
  PERFORM set_config('app.bypass_order_items_guard', 'on', true);

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
        v_actor_id
      );
    END LOOP;
  END LOOP;

  UPDATE fullchinavzla.web_order_requests
  SET converted_order_id = NULL
  WHERE converted_order_id = p_order_id;

  DELETE FROM fullchinavzla.payments WHERE order_id = p_order_id;

  DELETE FROM fullchinavzla.order_item_modifiers
  WHERE order_item_id IN (SELECT id FROM fullchinavzla.order_items WHERE order_id = p_order_id);

  DELETE FROM fullchinavzla.order_items WHERE order_id = p_order_id;

  DELETE FROM fullchinavzla.orders WHERE id = p_order_id;
END;
$function$;

COMMIT;
