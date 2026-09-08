-- Eliminación explícita de datos demo de cuentas por cobrar.
-- Solo owner/manager pueden ejecutarla y la comanda original nunca se borra.
BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_demo_credit(p_credit_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.credits WHERE id = p_credit_id) THEN
    RAISE EXCEPTION 'credit_not_found';
  END IF;

  -- Los abonos pertenecen al registro demo y se eliminan dentro de la misma
  -- transacción. La orden vinculada, si existe, permanece intacta.
  DELETE FROM fullchinavzla.credit_payments WHERE credit_id = p_credit_id;
  DELETE FROM fullchinavzla.credits WHERE id = p_credit_id;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_delete_demo_credit(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_delete_demo_credit(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
