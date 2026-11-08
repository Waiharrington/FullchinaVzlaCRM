BEGIN;

ALTER TABLE fullchinavzla.public_order_page_settings
  ADD COLUMN IF NOT EXISTS carousel_selection_configured BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE fullchinavzla.public_order_page_settings settings
SET carousel_selection_configured = EXISTS (
  SELECT 1
  FROM fullchinavzla.sellable_products product
  WHERE product.public_carousel
    AND product.is_active
    AND product.public_visible
    AND NOT COALESCE(product.is_delivery, FALSE)
    AND product.price >= 0.50
)
WHERE settings.id = TRUE;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_public_order_page_settings()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT jsonb_build_object(
    'mobileHeading', mobile_heading,
    'searchPlaceholder', search_placeholder,
    'desktopEyebrow', desktop_eyebrow,
    'desktopTitlePrefix', desktop_title_prefix,
    'desktopTitleAccent', desktop_title_accent,
    'desktopDescription', desktop_description,
    'desktopBannerImage', desktop_banner_image,
    'carouselSelectionConfigured', carousel_selection_configured
  )
  FROM fullchinavzla.public_order_page_settings
  WHERE id = TRUE;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_public_order_carousel(p_product_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_ids UUID[] := COALESCE(p_product_ids, ARRAY[]::UUID[]);
  v_valid_count INTEGER;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF auth.uid() IS NULL OR COALESCE(v_role, '') NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo dueña o gerente puede configurar el carrusel' USING ERRCODE = '42501';
  END IF;

  IF cardinality(v_ids) > 8 THEN
    RAISE EXCEPTION 'El carrusel admite hasta 8 productos' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(DISTINCT product_id) FROM unnest(v_ids) AS requested(product_id)) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'El carrusel no puede repetir productos' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_valid_count
  FROM unnest(v_ids) AS requested(product_id)
  JOIN fullchinavzla.sellable_products product ON product.id = requested.product_id
  WHERE product.is_active
    AND product.public_visible
    AND NOT COALESCE(product.is_delivery, FALSE)
    AND product.price >= 0.50;

  IF v_valid_count <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Uno de los productos ya no está disponible para el carrusel' USING ERRCODE = '22023';
  END IF;

  UPDATE fullchinavzla.sellable_products product
  SET public_carousel = product.id = ANY(v_ids),
      public_carousel_order = COALESCE(array_position(v_ids, product.id), 0)
  WHERE product.public_carousel IS DISTINCT FROM (product.id = ANY(v_ids))
     OR product.public_carousel_order IS DISTINCT FROM COALESCE(array_position(v_ids, product.id), 0);

  UPDATE fullchinavzla.public_order_page_settings
  SET carousel_selection_configured = TRUE,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = TRUE;

  RETURN jsonb_build_object('productIds', to_jsonb(v_ids), 'carouselSelectionConfigured', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_public_order_carousel(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_public_order_carousel(UUID[]) TO authenticated;

COMMENT ON COLUMN fullchinavzla.public_order_page_settings.carousel_selection_configured IS 'Distingue una selección manual vacía del carrusel automático inicial.';
COMMENT ON FUNCTION fullchinavzla.fn_admin_set_public_order_carousel(UUID[]) IS 'Guarda de forma atómica los hasta 8 productos del carrusel de pedir; solo owner y manager.';

COMMIT;
