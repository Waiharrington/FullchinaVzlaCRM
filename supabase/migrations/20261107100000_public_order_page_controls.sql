BEGIN;
ALTER TABLE fullchinavzla.sellable_products
  ADD COLUMN IF NOT EXISTS public_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS public_carousel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_carousel_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN fullchinavzla.sellable_products.public_visible IS 'Controla la visibilidad del producto exclusivamente en la página pública de pedidos.';
COMMENT ON COLUMN fullchinavzla.sellable_products.public_carousel IS 'Incluye el producto en el carrusel de recomendaciones de la página pública.';
COMMENT ON COLUMN fullchinavzla.sellable_products.public_carousel_order IS 'Orden del producto dentro del carrusel público.';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_public_catalog()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
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
    'image_url', p.image_url,
    'allow_protein_extras', p.allow_protein_extras,
    'public_visible', p.public_visible,
    'public_carousel', p.public_carousel,
    'public_carousel_order', p.public_carousel_order
  ) ORDER BY p.category, p.name), '[]'::jsonb)
  FROM fullchinavzla.sellable_products p
  WHERE p.is_active = true AND p.public_visible = true
    AND p.price >= 0.50 AND NOT COALESCE(p.is_delivery, false);
$$;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_public_catalog() TO anon, authenticated, service_role;
COMMIT;
