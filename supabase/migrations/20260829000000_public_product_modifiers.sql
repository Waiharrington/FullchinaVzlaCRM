-- =============================================================================
-- FULL CHINA VZLA - Modificadores/extras reales en el menú público
-- =============================================================================
-- El menú de clientes (anon) no podía leer los modificadores por RLS, así que
-- mostraba una lista fija de extras con precio 0 en TODOS los platos (incluidas
-- las bebidas). Este RPC SECURITY DEFINER expone los extras reales por plato,
-- con su precio; los platos sin modificadores no muestran ninguno.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

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
        SELECT jsonb_agg(jsonb_build_object(
          'id', o.id, 'name', o.name, 'price', o.sale_price
        ) ORDER BY o.display_order, o.name)
        FROM fullchinavzla.modifier_options o
        WHERE o.modifier_id = m.id AND o.is_active = true
      ), '[]'::jsonb)
    ) AS g
    FROM fullchinavzla.sellable_product_modifiers spm
    JOIN fullchinavzla.modifiers m ON m.id = spm.modifier_id
    WHERE spm.sellable_product_id = p_product_id AND m.is_active = true
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_product_modifiers(UUID) TO anon, authenticated, service_role;

COMMIT;
