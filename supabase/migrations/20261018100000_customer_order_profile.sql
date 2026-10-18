BEGIN;
SET LOCAL search_path = fullchinavzla, auth, pg_temp;

-- Devuelve únicamente los datos de pedido de la cuenta autenticada actual.
-- No acepta un customer_id del navegador para evitar consultar perfiles ajenos.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_customer_order_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = fullchinavzla, auth, pg_temp
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'first_name', c.first_name,
    'last_name', c.last_name,
    'full_name', c.full_name,
    'identification', c.identification,
    'phone', c.phone,
    'email', c.email
  ) INTO v_result
  FROM fullchinavzla.customer_accounts a
  JOIN fullchinavzla.customers c ON c.id = a.customer_id
  WHERE a.auth_user_id = auth.uid()
    AND a.status = 'active';

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'La sesión no corresponde a una cuenta activa de cliente';
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_customer_order_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_customer_order_profile() TO authenticated;

COMMIT;
