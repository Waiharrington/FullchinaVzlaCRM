-- Permite eliminar solo créditos manuales que aún no tienen abonos.
-- Los créditos creados desde comandas y los que tienen pagos conservan su historial.
BEGIN;

DROP POLICY IF EXISTS credits_delete_manual_unpaid ON fullchinavzla.credits;
CREATE POLICY credits_delete_manual_unpaid ON fullchinavzla.credits
  FOR DELETE
  USING (
    fullchinavzla.get_current_user_role() IN ('owner', 'manager')
    AND order_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM fullchinavzla.credit_payments cp
      WHERE cp.credit_id = credits.id
    )
  );

GRANT DELETE ON fullchinavzla.credits TO authenticated;

COMMIT;
