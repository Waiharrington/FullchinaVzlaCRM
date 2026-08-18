-- =============================================================================
-- FULL CHINA VZLA - Agregar image_url al catálogo público
-- =============================================================================
-- fn_get_public_catalog no retornaba image_url → el menú público siempre
-- caía a imágenes genéricas del carousel. Agrega el campo al SELECT.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_public_catalog()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'price', p.price,
    'category', p.category,
    'emoji', p.emoji,
    'image_url', p.image_url
  ) ORDER BY p.category, p.name), '[]'::jsonb)
  FROM fullchinavzla.sellable_products p
  WHERE p.is_active = true AND p.price >= 0.50;
$$;

COMMIT;
