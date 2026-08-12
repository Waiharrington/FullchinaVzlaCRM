-- Permite registrar clientes desde Caja sin otorgar UPDATE/DELETE al rol cashier.

BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_customer(
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL
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
    RAISE EXCEPTION 'Usuario no autorizado para registrar clientes';
  END IF;

  IF NULLIF(BTRIM(p_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio';
  END IF;

  RETURN QUERY
  INSERT INTO fullchinavzla.customers (
    full_name, phone, birth_date, source_system, source_key, is_active
  ) VALUES (
    BTRIM(p_full_name),
    NULLIF(BTRIM(p_phone), ''),
    p_birth_date,
    'fullchina',
    'app:' || gen_random_uuid()::TEXT,
    TRUE
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_create_customer(TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_customer(TEXT, TEXT, DATE) TO authenticated;

COMMENT ON FUNCTION fullchinavzla.fn_create_customer(TEXT, TEXT, DATE) IS
  'Registro seguro de clientes para owner, manager y cashier sin ampliar permisos directos de escritura';

COMMIT;
