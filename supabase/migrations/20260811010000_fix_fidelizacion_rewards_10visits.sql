-- Fix: Recompensas de fidelización cada 10 visitas (antes era cada 5)
-- La función original usaba floor((total_visits + 1) / 5.0), ahora usa /10

CREATE OR REPLACE FUNCTION fullchinavzla.fn_register_customer_visit(p_customer_id UUID)
RETURNS fullchinavzla.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_customer fullchinavzla.customers;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'No autorizado para registrar visitas';
  END IF;

  UPDATE fullchinavzla.customers
  SET total_visits = total_visits + 1,
      rewards_unlocked = floor((total_visits + 1) / 10.0)::INTEGER,
      last_visit = CURRENT_DATE,
      updated_at = now()
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  IF v_customer.id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;
  RETURN v_customer;
END;
$$;
