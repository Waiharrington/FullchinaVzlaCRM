-- =============================================================================
-- FIX: fn_protect_order_items_closed sólo permitía editar items en estado 'open'.
-- Las comandas enviadas a cocina y sin cobrar están en 'confirmed'/'ready', por
-- lo que agregar/quitar productos y fijar el costo de delivery fallaba con 400.
-- Se relaja para permitir edición en cualquier estado EXCEPTO 'paid'/'cancelled'
-- (coherente con fn_remove_order_item). Sólo las órdenes cobradas o canceladas
-- quedan inmutables.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_protect_order_items_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_status TEXT;
BEGIN
  SELECT o.status INTO v_status
  FROM fullchinavzla.orders o WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  -- Si la orden no existe, permitir (la FK fallará después)
  IF v_status IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Órdenes cobradas o canceladas: inmutables para todos los roles.
  IF v_status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'No se puede modificar items de orden % en estado %. '
      'Los items son inmutables una vez cobrada o cancelada.', COALESCE(NEW.order_id, OLD.order_id), v_status;
  END IF;

  -- Cualquier otro estado (open, confirmed, ready, …): permitir editar el pedido.
  RETURN COALESCE(NEW, OLD);
END;
$function$;

COMMIT;
