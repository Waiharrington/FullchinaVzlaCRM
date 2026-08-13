-- Edición segura de clientes (owner/manager/cashier), espejo de fn_create_customer.
-- SCHEMA: fullchinavzla. Aditiva. Correr del lado servidor.

BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_update_customer(
  p_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_identification TEXT,
  p_address TEXT,
  p_birth_date DATE
)
RETURNS SETOF fullchinavzla.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := fullchinavzla.get_current_user_role();

  IF auth.uid() IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Usuario no autorizado para editar clientes';
  END IF;

  IF NULLIF(BTRIM(p_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio';
  END IF;

  RETURN QUERY
  UPDATE fullchinavzla.customers SET
    full_name      = BTRIM(p_full_name),
    phone          = NULLIF(BTRIM(p_phone), ''),
    identification = NULLIF(BTRIM(p_identification), ''),
    address        = NULLIF(BTRIM(p_address), ''),
    birth_date     = p_birth_date,
    updated_at     = now()
  WHERE id = p_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_update_customer(UUID, TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_update_customer(UUID, TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;

COMMENT ON FUNCTION fullchinavzla.fn_update_customer(UUID, TEXT, TEXT, TEXT, TEXT, DATE) IS
  'Edición segura de clientes para owner, manager y cashier.';

COMMIT;
