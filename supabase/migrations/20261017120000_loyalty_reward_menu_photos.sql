BEGIN;
SET LOCAL search_path = fullchinavzla;

-- Incluye la imagen original del menú para que administración pueda reconocer
-- visualmente los platos al armar la secuencia de premios.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_get_loyalty_menu_products()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', sp.id,
      'name', sp.name,
      'category', sp.category,
      'image_url', sp.image_url
    ) ORDER BY sp.name)
    FROM fullchinavzla.sellable_products sp
    WHERE sp.is_active
      AND EXISTS (
        SELECT 1 FROM fullchinavzla.recipe_components rc
        WHERE rc.sellable_product_id = sp.id AND rc.ingredient_id IS NOT NULL
      )
  ), '[]'::JSONB);
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_get_loyalty_menu_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_get_loyalty_menu_products() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
