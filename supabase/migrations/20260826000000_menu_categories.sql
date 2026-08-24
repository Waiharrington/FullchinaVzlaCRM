-- =============================================================================
-- FULL CHINA VZLA - Categorías del menú administrables
-- =============================================================================
-- Hasta ahora las categorías (nombres, orden) vivían fijas en el código. Esta
-- tabla las hace administrables desde la app: crear, renombrar y reordenar.
-- Se siembra con las 11 categorías actuales para no cambiar nada de golpe.
-- El menú público (anon) las lee vía fn_get_menu_categories (SECURITY DEFINER).
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE TABLE IF NOT EXISTS fullchinavzla.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semilla idempotente con las categorías vigentes (mismo orden que el código).
INSERT INTO fullchinavzla.menu_categories (key, label, sort_order) VALUES
  ('promociones',  'Promociones',    10),
  ('arroz',        'Arroz',          20),
  ('tallarines',   'Tallarines',     30),
  ('pastas',       'Pastas',         40),
  ('chopsuey',     'Chopsuey',       50),
  ('individuales', 'Individuales',   60),
  ('ejecutivos',   'Menú Ejecutivo', 70),
  ('raciones',     'Raciones',       80),
  ('extras',       'Extras',         90),
  ('bebidas',      'Bebidas',       100),
  ('otros',        'Otros',         110)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE fullchinavzla.menu_categories ENABLE ROW LEVEL SECURITY;

-- Lectura para cualquier usuario con perfil (owner/manager/cashier): la usa el
-- panel de Menú y Caja.
DROP POLICY IF EXISTS menu_categories_select ON fullchinavzla.menu_categories;
CREATE POLICY menu_categories_select ON fullchinavzla.menu_categories
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IS NOT NULL);

-- Escritura solo owner/manager.
DROP POLICY IF EXISTS menu_categories_insert ON fullchinavzla.menu_categories;
CREATE POLICY menu_categories_insert ON fullchinavzla.menu_categories
  FOR INSERT TO authenticated
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS menu_categories_update ON fullchinavzla.menu_categories;
CREATE POLICY menu_categories_update ON fullchinavzla.menu_categories
  FOR UPDATE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS menu_categories_delete ON fullchinavzla.menu_categories;
CREATE POLICY menu_categories_delete ON fullchinavzla.menu_categories
  FOR DELETE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.menu_categories TO authenticated;
GRANT SELECT ON fullchinavzla.menu_categories TO service_role;

-- Lectura pública (menú de clientes con la clave anon), solo categorías activas.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_menu_categories()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'key', c.key,
    'label', c.label,
    'sort_order', c.sort_order,
    'is_active', c.is_active
  ) ORDER BY c.sort_order, c.label), '[]'::jsonb)
  FROM fullchinavzla.menu_categories c
  WHERE c.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_menu_categories() TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS set_updated_at_menu_categories ON fullchinavzla.menu_categories;
CREATE TRIGGER set_updated_at_menu_categories
  BEFORE UPDATE ON fullchinavzla.menu_categories
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();

COMMIT;
