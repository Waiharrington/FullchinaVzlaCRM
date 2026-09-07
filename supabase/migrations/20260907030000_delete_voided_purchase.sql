BEGIN;

-- Borrado excepcional de una compra ya anulada. Se usa para registros demo:
-- elimina también sus movimientos de stock asociados y no debe usarse para
-- compras reales, que deben conservarse como historial.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_voided_purchase(p_purchase_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager pueden borrar compras anuladas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.purchases
    WHERE id = p_purchase_id AND is_voided
  ) THEN
    RAISE EXCEPTION 'Solo se pueden borrar compras anuladas';
  END IF;

  PERFORM set_config('fullchinavzla.purchase_delete_in_progress', 'on', true);
  DELETE FROM fullchinavzla.stock_movements
  WHERE reference_type = 'purchase_item'
    AND reference_id IN (
      SELECT id FROM fullchinavzla.purchase_items WHERE purchase_id = p_purchase_id
    );
  DELETE FROM fullchinavzla.purchase_items WHERE purchase_id = p_purchase_id;
  DELETE FROM fullchinavzla.purchases WHERE id = p_purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_delete_voided_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_delete_voided_purchase(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
