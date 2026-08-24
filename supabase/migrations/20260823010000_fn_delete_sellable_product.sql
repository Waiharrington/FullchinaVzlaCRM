-- Elimina un plato (sellable_product) de forma segura desde el Menú.
-- Bloquea el borrado si el plato tiene historial de ventas (order_items o
-- web_order_items) para no romper reportes/comandas: en ese caso el usuario
-- debe usar "Ocultar" (is_active=false). Si no hay ventas, limpia sus recetas
-- y enlaces de modificador y borra el producto.

CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_sellable_product(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_role  TEXT;
  v_name  TEXT;
  v_sales INT;
  v_web   INT;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager pueden eliminar platos. Rol: %', v_role;
  END IF;

  SELECT name INTO v_name FROM fullchinavzla.sellable_products WHERE id = p_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'El plato no existe.';
  END IF;

  SELECT count(*) INTO v_sales FROM fullchinavzla.order_items WHERE sellable_product_id = p_id;
  SELECT count(*) INTO v_web FROM fullchinavzla.web_order_items WHERE sellable_product_id = p_id;
  IF v_sales > 0 OR v_web > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar "%": tiene % venta(s) registrada(s). Usa "Ocultar" para quitarlo del menú sin perder el historial.', v_name, v_sales + v_web;
  END IF;

  DELETE FROM fullchinavzla.recipe_components WHERE sellable_product_id = p_id;
  DELETE FROM fullchinavzla.sellable_product_modifiers WHERE sellable_product_id = p_id;
  DELETE FROM fullchinavzla.sellable_products WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_delete_sellable_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_delete_sellable_product(uuid) TO authenticated;
