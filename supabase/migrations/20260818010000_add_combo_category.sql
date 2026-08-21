-- =============================================================================
-- FULL CHINA VZLA - Agregar categoría 'combo' al catálogo
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

-- Solo insertar si no existe aún
INSERT INTO fullchinavzla.sellable_products (name, description, price, cost, category, emoji, is_active, image_url)
SELECT 'Dúo Full China', 'Elige 2 platos y ahorra más', 12.90, NULL, 'combo', '🔥', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM fullchinavzla.sellable_products WHERE category = 'combo' LIMIT 1
);

COMMIT;
