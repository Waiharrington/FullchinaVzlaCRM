-- =============================================================================
-- FULL CHINA VZLA - Catálogo público ligero
-- =============================================================================
-- Las imágenes Base64 no deben viajar dentro de la RPC pública: con 69
-- productos llegaron a representar aproximadamente 3.7 MB de una respuesta
-- de 3.75 MB. Cada imagen inline actual se sirve desde un WebP estático
-- nombrado con el id del producto; así se conserva exactamente la foto vigente
-- del sistema y tampoco se incrusta en la respuesta JSON.
--
-- Esta migración se aplica al VPS solamente después de contar con un backup.
-- =============================================================================

BEGIN;

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
    'categories', (
      SELECT jsonb_agg(cat) FROM (
        SELECT p.category AS cat
        UNION
        SELECT spc.category_key
        FROM fullchinavzla.sellable_product_categories spc
        WHERE spc.sellable_product_id = p.id
      ) s
    ),
    'emoji', p.emoji,
    'menu_label', p.menu_label,
    'image_url', CASE
      WHEN p.image_url LIKE 'data:image/%'
        THEN '/optimized/productos/' || p.id || '.webp'
      ELSE p.image_url
    END
  ) ORDER BY p.category, p.name), '[]'::jsonb)
  FROM fullchinavzla.sellable_products p
  WHERE p.is_active = true AND p.price >= 0.50;
$$;

COMMIT;
