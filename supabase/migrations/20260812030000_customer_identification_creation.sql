-- Permite guardar cedula/RIF al registrar clientes desde Caja.

BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_customer(
  p_full_name TEXT,
  p_phone TEXT,
  p_birth_date DATE,
  p_identification TEXT
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
    full_name, identification, phone, birth_date, source_system, source_key, is_active
  ) VALUES (
    BTRIM(p_full_name),
    NULLIF(BTRIM(p_identification), ''),
    NULLIF(BTRIM(p_phone), ''),
    p_birth_date,
    'fullchina',
    'app:' || gen_random_uuid()::TEXT,
    TRUE
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_create_customer(TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_customer(TEXT, TEXT, DATE, TEXT) TO authenticated;

COMMENT ON FUNCTION fullchinavzla.fn_create_customer(TEXT, TEXT, DATE, TEXT) IS
  'Registro seguro de clientes con identificacion opcional para owner, manager y cashier';

COMMIT;
