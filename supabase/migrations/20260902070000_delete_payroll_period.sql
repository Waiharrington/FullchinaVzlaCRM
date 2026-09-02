-- Borrado seguro de periodos: solo periodos abiertos sin pagos ni ajustes.

BEGIN;
SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_payroll_period(p_period_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_role text := fullchinavzla.get_current_user_role();
  v_status text;
BEGIN
  IF v_role <> 'owner' THEN RAISE EXCEPTION 'Solo el owner puede eliminar periodos de nómina'; END IF;
  SELECT status INTO v_status FROM fullchinavzla.payroll_periods WHERE id = p_period_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'El periodo de nómina no existe'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'Solo se pueden eliminar periodos abiertos'; END IF;
  IF EXISTS (SELECT 1 FROM fullchinavzla.payroll_payments WHERE payroll_period_id = p_period_id)
     OR EXISTS (SELECT 1 FROM fullchinavzla.payroll_adjustments WHERE payroll_period_id = p_period_id) THEN
    RAISE EXCEPTION 'No se puede eliminar: el periodo tiene pagos o ajustes asociados';
  END IF;
  DELETE FROM fullchinavzla.payroll_periods WHERE id = p_period_id;
END;
$function$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_delete_payroll_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_delete_payroll_period(uuid) TO authenticated, service_role;
COMMIT;
