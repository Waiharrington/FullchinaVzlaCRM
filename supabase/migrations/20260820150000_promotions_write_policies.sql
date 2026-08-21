-- =============================================================================
-- FIX: la tabla promotions tenía RLS activo pero SÓLO una política de lectura
-- pública. Sin políticas de escritura, TODO insert/update/delete del admin era
-- rechazado silenciosamente (los botones "no hacían nada"). Se agregan políticas
-- de escritura para owner/manager.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

DROP POLICY IF EXISTS "Managers can insert promotions" ON fullchinavzla.promotions;
DROP POLICY IF EXISTS "Managers can update promotions" ON fullchinavzla.promotions;
DROP POLICY IF EXISTS "Managers can delete promotions" ON fullchinavzla.promotions;

CREATE POLICY "Managers can insert promotions"
  ON fullchinavzla.promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

CREATE POLICY "Managers can update promotions"
  ON fullchinavzla.promotions
  FOR UPDATE
  TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

CREATE POLICY "Managers can delete promotions"
  ON fullchinavzla.promotions
  FOR DELETE
  TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

-- La lectura del admin (que ve TODAS, activas e inactivas) también estaba
-- limitada por la política pública (sólo is_active = true). Añadimos lectura
-- completa para owner/manager para que puedan ver/gestionar las ocultas.
DROP POLICY IF EXISTS "Managers can read all promotions" ON fullchinavzla.promotions;
CREATE POLICY "Managers can read all promotions"
  ON fullchinavzla.promotions
  FOR SELECT
  TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

COMMIT;
