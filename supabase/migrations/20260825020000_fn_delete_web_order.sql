-- Elimina un pedido web pendiente (web_order_requests) y sus items.
-- Solo permite eliminar pedidos con status 'pending_confirmation'.

CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_web_order(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_role   TEXT;
  v_status TEXT;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado para eliminar pedidos web. Rol: %', v_role;
  END IF;

  SELECT status INTO v_status
  FROM fullchinavzla.web_order_requests
  WHERE id = p_request_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'El pedido web no existe.';
  END IF;

  IF v_status != 'pending_confirmation' THEN
    RAISE EXCEPTION 'Solo se pueden eliminar pedidos web pendientes de confirmación.';
  END IF;

  DELETE FROM fullchinavzla.web_order_items WHERE web_order_request_id = p_request_id;
  DELETE FROM fullchinavzla.web_order_requests WHERE id = p_request_id;
END;
$function$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_delete_web_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_delete_web_order(uuid) TO authenticated;
