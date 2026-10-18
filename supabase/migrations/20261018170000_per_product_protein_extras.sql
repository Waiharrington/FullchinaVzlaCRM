-- Configuración por plato para ofrecer proteína adicional en el menú público.
BEGIN;


ALTER TABLE fullchinavzla.sellable_products
  ADD COLUMN IF NOT EXISTS allow_protein_extras BOOLEAN NOT NULL DEFAULT TRUE;

-- Las bebidas no ofrecen extras de proteína; los platos existentes quedan activos.
UPDATE fullchinavzla.sellable_products product
SET allow_protein_extras = FALSE
WHERE lower(btrim(COALESCE(product.category, ''))) IN ('bebida', 'bebidas', 'drink', 'drinks', 'agua', 'aguas')
   OR EXISTS (
     SELECT 1
     FROM fullchinavzla.sellable_product_categories category
     WHERE category.sellable_product_id = product.id
       AND lower(btrim(category.category_key)) IN ('bebida', 'bebidas', 'drink', 'drinks', 'agua', 'aguas')
   );

COMMENT ON COLUMN fullchinavzla.sellable_products.allow_protein_extras IS
  'Permite ofrecer extras de proteína para este plato en el menú público; las bebidas se mantienen desactivadas.';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_disable_protein_extras_for_beverages()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF lower(btrim(COALESCE(NEW.category, ''))) IN ('bebida', 'bebidas', 'drink', 'drinks', 'agua', 'aguas') THEN
    NEW.allow_protein_extras := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS disable_protein_extras_for_beverages ON fullchinavzla.sellable_products;
CREATE TRIGGER disable_protein_extras_for_beverages
  BEFORE INSERT OR UPDATE
  ON fullchinavzla.sellable_products
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_disable_protein_extras_for_beverages();

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
    'image_url', p.image_url,
    'allow_protein_extras', p.allow_protein_extras
  ) ORDER BY p.category, p.name), '[]'::jsonb)
  FROM fullchinavzla.sellable_products p
  WHERE p.is_active = true AND p.price >= 0.50 AND NOT COALESCE(p.is_delivery, false);
$$;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_public_catalog() TO anon, authenticated, service_role;

-- No expone al menú público los grupos opcionales de proteína cuando el plato
-- tiene apagada la opción. Los grupos obligatorios de proteínas incluidas siguen disponibles.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_product_modifiers(p_product_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(g ORDER BY g->>'name'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'modifierId', m.id,
      'name', m.name,
      'minSelections', COALESCE(m.min_selections, 0),
      'maxSelections', m.max_selections,
      'allowRepeat', COALESCE(m.allow_repeat, false),
      'options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price', o.sale_price)
          ORDER BY o.display_order, o.name)
        FROM fullchinavzla.modifier_options o
        WHERE o.modifier_id = m.id AND o.is_active = true
      ), '[]'::jsonb)
    ) AS g
    FROM fullchinavzla.sellable_product_modifiers spm
    JOIN fullchinavzla.modifiers m ON m.id = spm.modifier_id
    JOIN fullchinavzla.sellable_products p ON p.id = spm.sellable_product_id
    WHERE spm.sellable_product_id = p_product_id
      AND m.is_active = true
      AND (p.allow_protein_extras OR NOT (
        lower(COALESCE(m.name, '')) LIKE '%proteina%'
        AND (lower(COALESCE(m.name, '')) LIKE '%extra%' OR COALESCE(m.min_selections, 0) = 0)
      ))
  ) sub;
$$;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_product_modifiers(UUID) TO anon, authenticated, service_role;

-- Defensa para pedidos web directos que intenten enviar modificadores de
-- proteína opcionales omitidos por la consulta pública.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_guard_disabled_protein_extras()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF NOT COALESCE((SELECT allow_protein_extras FROM fullchinavzla.sellable_products WHERE id = NEW.sellable_product_id), TRUE)
     AND EXISTS (
       SELECT 1
       FROM jsonb_array_elements(COALESCE(NEW.modifiers, '[]'::jsonb)) selected(value)
       JOIN fullchinavzla.modifiers modifier ON modifier.id = (selected.value->>'modifierId')::UUID
       WHERE lower(COALESCE(modifier.name, '')) LIKE '%proteina%'
         AND (lower(COALESCE(modifier.name, '')) LIKE '%extra%' OR COALESCE(modifier.min_selections, 0) = 0)
     ) THEN
    RAISE EXCEPTION 'Este plato no permite extras de proteína';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_disabled_protein_extras ON fullchinavzla.web_order_items;
CREATE TRIGGER guard_disabled_protein_extras
  BEFORE INSERT OR UPDATE OF modifiers, sellable_product_id
  ON fullchinavzla.web_order_items
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_guard_disabled_protein_extras();

COMMIT;
