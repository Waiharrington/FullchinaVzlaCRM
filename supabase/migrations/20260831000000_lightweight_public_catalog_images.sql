-- =============================================================================
-- FULL CHINA VZLA - Catálogo público sin imágenes Base64 incrustadas
-- =============================================================================
-- El editor administrativo conserva image_url completo para no perder fotos.
-- La RPC pública, en cambio, nunca debe incluir data URLs: cada una se repite
-- dentro del JSON y hacía que /pedir descargara varios MB antes de renderizar.
-- Para productos importados de INVU se devuelve su imagen estática local; el
-- frontend la transforma a /optimized/productos/<codigo>.webp. Para una foto
-- inline sin recurso local conocido se devuelve NULL y la UI usa el fallback
-- visual de la categoría.
--
-- IMPORTANTE: esta migración solo queda versionada. Aplicarla al VPS requiere
-- autorización explícita, backup previo y verificación, según AGENTS.md.
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
    'image_url', CASE
      WHEN p.image_url LIKE 'data:image/%' THEN
        CASE
          WHEN split_part(p.source_code, ':', 1) = ANY (ARRAY[
            'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M9',
            'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17',
            'M21', 'M23', 'M24', 'M29', 'M30', 'M32', 'M34',
            'M35', 'M42', 'M47', 'M48', 'M49', 'M50', 'M53',
            'M54', 'M55', 'M60', 'M64', 'M66', 'M67', 'P41', 'P54'
          ])
          THEN '/productos/' || split_part(p.source_code, ':', 1) || '.jpg'
          ELSE NULL
        END
      ELSE p.image_url
    END
  ) ORDER BY p.category, p.name), '[]'::jsonb)
  FROM fullchinavzla.sellable_products p
  WHERE p.is_active = true AND p.price >= 0.50;
$$;

COMMIT;

-- ROLLBACK: volver a aplicar la definición de fn_get_public_catalog de
-- 20260828000000_product_categories.sql.
