-- =============================================================================
-- FULL CHINA VZLA - Delivery por distancia (origen + zonas por km)
-- =============================================================================
-- Permite estimar el costo de delivery en el menú público según la distancia
-- entre el local (origen) y la ubicación del cliente. Todo administrable:
--   * delivery_config: un único registro con el origen y el factor de ruta.
--   * delivery_zones: rangos de km con su precio (editables por el owner).
-- El menú público (anon) lo lee vía fn_get_delivery_settings (SECURITY DEFINER).
-- La estimación se muestra como "a confirmar"; Caja mantiene su monto manual.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

-- 1) Configuración única (origen del local + factor de ruta).
CREATE TABLE IF NOT EXISTS fullchinavzla.delivery_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  origin_lat DOUBLE PRECISION,
  origin_lng DOUBLE PRECISION,
  road_factor NUMERIC(4,2) NOT NULL DEFAULT 1.30,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Origen sembrado con la ubicación real de Full China (Maracay, Aragua).
INSERT INTO fullchinavzla.delivery_config (id, origin_lat, origin_lng)
VALUES (1, 10.2547567, -67.5926267)
ON CONFLICT (id) DO NOTHING;

-- 2) Zonas por rango de distancia.
CREATE TABLE IF NOT EXISTS fullchinavzla.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_km NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_km NUMERIC(6,2),                    -- NULL = sin límite superior ("más de X km")
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zonas de ejemplo (editables). Full China ajusta los precios reales.
INSERT INTO fullchinavzla.delivery_zones (min_km, max_km, price, sort_order)
SELECT * FROM (VALUES
  (0::numeric, 3::numeric,  2::numeric, 10),
  (3::numeric, 6::numeric,  3::numeric, 20),
  (6::numeric, 10::numeric, 5::numeric, 30),
  (10::numeric, NULL::numeric, 8::numeric, 40)
) AS seed(min_km, max_km, price, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM fullchinavzla.delivery_zones);

ALTER TABLE fullchinavzla.delivery_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Lectura para cualquier usuario con perfil.
DROP POLICY IF EXISTS delivery_config_select ON fullchinavzla.delivery_config;
CREATE POLICY delivery_config_select ON fullchinavzla.delivery_config
  FOR SELECT TO authenticated USING (fullchinavzla.get_current_user_role() IS NOT NULL);
DROP POLICY IF EXISTS delivery_zones_select ON fullchinavzla.delivery_zones;
CREATE POLICY delivery_zones_select ON fullchinavzla.delivery_zones
  FOR SELECT TO authenticated USING (fullchinavzla.get_current_user_role() IS NOT NULL);

-- Escritura solo owner/manager.
DROP POLICY IF EXISTS delivery_config_update ON fullchinavzla.delivery_config;
CREATE POLICY delivery_config_update ON fullchinavzla.delivery_config
  FOR UPDATE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS delivery_zones_insert ON fullchinavzla.delivery_zones;
CREATE POLICY delivery_zones_insert ON fullchinavzla.delivery_zones
  FOR INSERT TO authenticated
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS delivery_zones_update ON fullchinavzla.delivery_zones;
CREATE POLICY delivery_zones_update ON fullchinavzla.delivery_zones
  FOR UPDATE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS delivery_zones_delete ON fullchinavzla.delivery_zones;
CREATE POLICY delivery_zones_delete ON fullchinavzla.delivery_zones
  FOR DELETE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT, UPDATE ON fullchinavzla.delivery_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.delivery_zones TO authenticated;
GRANT SELECT ON fullchinavzla.delivery_config, fullchinavzla.delivery_zones TO service_role;

-- Lectura pública (menú de clientes): origen + zonas activas.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_delivery_settings()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT jsonb_build_object(
    'originLat', c.origin_lat,
    'originLng', c.origin_lng,
    'roadFactor', c.road_factor,
    'enabled', c.is_enabled,
    'zones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', z.id, 'minKm', z.min_km, 'maxKm', z.max_km, 'price', z.price, 'sortOrder', z.sort_order
      ) ORDER BY z.sort_order, z.min_km)
      FROM fullchinavzla.delivery_zones z
      WHERE z.is_active = true
    ), '[]'::jsonb)
  )
  FROM fullchinavzla.delivery_config c
  WHERE c.id = 1;
$$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_delivery_settings() TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS set_updated_at_delivery_config ON fullchinavzla.delivery_config;
CREATE TRIGGER set_updated_at_delivery_config
  BEFORE UPDATE ON fullchinavzla.delivery_config
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_delivery_zones ON fullchinavzla.delivery_zones;
CREATE TRIGGER set_updated_at_delivery_zones
  BEFORE UPDATE ON fullchinavzla.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();

COMMIT;
