-- =============================================================================
-- FULL CHINA VZLA - MENÚ SEMANAL: FOTOS + HISTORIAL DE ACTIVACIÓN POR SEMANA
-- =============================================================================
-- (1) image_url en weekly_menu_items para foto del plato (data URL o ruta).
-- (2) weekly_menu_activations: registra en qué semana (lun–dom) estuvo activo
--     cada plato → habilita el navegador de semanas, el calendario y "última
--     vez usado" con datos reales. Un plato está "activo en la semana W" si
--     existe una fila (weekly_dish_id, week_start=W).
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

ALTER TABLE fullchinavzla.weekly_menu_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;
COMMENT ON COLUMN fullchinavzla.weekly_menu_items.image_url IS
  'Foto del plato especial (data URL o ruta); NULL = usar emoji';

CREATE TABLE IF NOT EXISTS fullchinavzla.weekly_menu_activations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_dish_id  UUID NOT NULL REFERENCES fullchinavzla.weekly_menu_items(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  week_end        DATE NOT NULL,
  activated_by    UUID REFERENCES fullchinavzla.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (weekly_dish_id, week_start)
);
COMMENT ON TABLE fullchinavzla.weekly_menu_activations IS
  'Historial: en qué semana (lun–dom) estuvo activo cada plato especial';
CREATE INDEX IF NOT EXISTS idx_wma_dish ON fullchinavzla.weekly_menu_activations(weekly_dish_id);
CREATE INDEX IF NOT EXISTS idx_wma_week ON fullchinavzla.weekly_menu_activations(week_start);

ALTER TABLE fullchinavzla.weekly_menu_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wma_select ON fullchinavzla.weekly_menu_activations;
CREATE POLICY wma_select ON fullchinavzla.weekly_menu_activations FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

DROP POLICY IF EXISTS wma_write ON fullchinavzla.weekly_menu_activations;
CREATE POLICY wma_write ON fullchinavzla.weekly_menu_activations FOR ALL TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.weekly_menu_activations TO authenticated;

RESET ROLE;

COMMIT;

-- ROLLBACK:
--   DROP TABLE IF EXISTS fullchinavzla.weekly_menu_activations;
--   ALTER TABLE fullchinavzla.weekly_menu_items DROP COLUMN IF EXISTS image_url;
