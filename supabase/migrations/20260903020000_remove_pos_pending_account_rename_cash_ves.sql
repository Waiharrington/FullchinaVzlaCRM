-- El dueño confirmó que "Pendiente punto de venta" ya no hace falta: el dinero
-- del punto de venta cae directo a Banesco cada ~2 días y él mismo registra
-- una transferencia manual cuando eso pasa, sin necesitar una cuenta de
-- "clearing" intermedia.
--
-- También renombra "Efectivo bolivares" a "Caja Full China" (VES), igual que
-- ya se hizo antes con el efectivo en dólares (ver
-- 20260902120000_separate_operational_and_general_usd_cash.sql): es la misma
-- caja física del tráiler, que recibe efectivo en las dos monedas. Queda como
-- dos cuentas con el mismo nombre, una por moneda.

BEGIN;
SET LOCAL ROLE supabase_admin;
SET LOCAL search_path = fullchinavzla, pg_temp;

DO $$
DECLARE
  v_account_id UUID;
  v_refs INTEGER;
BEGIN
  SELECT id INTO v_account_id FROM fullchinavzla.financial_accounts
  WHERE name = 'Pendiente punto de venta' AND currency = 'VES';

  IF v_account_id IS NULL THEN
    RAISE NOTICE 'La cuenta "Pendiente punto de venta" ya no existe, no hay nada que borrar.';
  ELSE
    SELECT
      (SELECT count(*) FROM fullchinavzla.payments WHERE account_id = v_account_id)
      + (SELECT count(*) FROM fullchinavzla.expenses WHERE account_id = v_account_id)
      + (SELECT count(*) FROM fullchinavzla.purchases WHERE account_id = v_account_id)
      + (SELECT count(*) FROM fullchinavzla.financial_operations WHERE from_account_id = v_account_id OR to_account_id = v_account_id)
    INTO v_refs;

    IF v_refs > 0 THEN
      RAISE EXCEPTION 'No se borra "Pendiente punto de venta": tiene % movimiento(s) asociado(s). Desactívala en vez de borrarla: UPDATE fullchinavzla.financial_accounts SET is_active = false WHERE id = ''%''.', v_refs, v_account_id;
    END IF;

    DELETE FROM fullchinavzla.financial_accounts WHERE id = v_account_id;
    RAISE NOTICE 'Cuenta "Pendiente punto de venta" eliminada.';
  END IF;
END $$;

UPDATE fullchinavzla.financial_accounts
SET name = 'Caja Full China',
    aliases = ARRAY['caja full china', 'efectivo bolivares', 'bolivares caja', 'caja bs'],
    updated_at = now()
WHERE name = 'Efectivo bolivares' AND currency = 'VES';

NOTIFY pgrst, 'reload schema';
COMMIT;
