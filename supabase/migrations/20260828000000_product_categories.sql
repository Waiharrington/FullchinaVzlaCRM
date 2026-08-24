-- =============================================================================
-- FULL CHINA VZLA - Un plato en varias categorías
-- =============================================================================
-- La columna sellable_products.category sigue siendo la categoría PRINCIPAL
-- (define el orden y el "hogar" del plato). Esta tabla guarda las categorías
-- ADICIONALES, para que un plato aparezca en más de una (ej. "El Clásico" en
-- Promociones y Arroz). El conjunto completo = principal + adicionales.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE TABLE IF NOT EXISTS fullchinavzla.sellable_product_categories (
  sellable_product_id UUID NOT NULL REFERENCES fullchinavzla.sellable_products(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sellable_product_id, category_key)
);

CREATE INDEX IF NOT EXISTS idx_spc_product ON fullchinavzla.sellable_product_categories(sellable_product_id);

ALTER TABLE fullchinavzla.sellable_product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spc_select ON fullchinavzla.sellable_product_categories;
CREATE POLICY spc_select ON fullchinavzla.sellable_product_categories
  FOR SELECT TO authenticated USING (fullchinavzla.get_current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS spc_insert ON fullchinavzla.sellable_product_categories;
CREATE POLICY spc_insert ON fullchinavzla.sellable_product_categories
  FOR INSERT TO authenticated
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS spc_delete ON fullchinavzla.sellable_product_categories;
CREATE POLICY spc_delete ON fullchinavzla.sellable_product_categories
  FOR DELETE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT, INSERT, DELETE ON fullchinavzla.sellable_product_categories TO authenticated;
GRANT SELECT ON fullchinavzla.sellable_product_categories TO service_role;

-- Catálogo público: añade el arreglo "categories" (principal + adicionales).
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
    'image_url', p.image_url
  ) ORDER BY p.category, p.name), '[]'::jsonb)
  FROM fullchinavzla.sellable_products p
  WHERE p.is_active = true AND p.price >= 0.50;
$$;

COMMIT;
