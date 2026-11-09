BEGIN;

ALTER TABLE fullchinavzla.public_order_page_settings
  DROP CONSTRAINT IF EXISTS public_order_page_settings_desktop_banner_image_check;

ALTER TABLE fullchinavzla.public_order_page_settings
  ADD CONSTRAINT public_order_page_settings_desktop_banner_image_check
  CHECK (
    desktop_banner_image IN (
      '/optimized/fondos/hero-banner-food.webp',
      '/optimized/fondos/combo-banner-bg.webp',
      '/optimized/fondos/public-flow-bg.webp',
      '/optimized/fondos/delivery-card-bg.webp'
    )
    OR (
      char_length(desktop_banner_image) <= 1500000
      AND desktop_banner_image ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    )
  );

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_update_public_order_page_settings(
  p_mobile_heading TEXT,
  p_search_placeholder TEXT,
  p_desktop_eyebrow TEXT,
  p_desktop_title_prefix TEXT,
  p_desktop_title_accent TEXT,
  p_desktop_description TEXT,
  p_desktop_banner_image TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_row fullchinavzla.public_order_page_settings%ROWTYPE;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'No tienes permiso para editar la página de pedir' USING ERRCODE = '42501';
  END IF;

  IF char_length(btrim(COALESCE(p_mobile_heading, ''))) NOT BETWEEN 1 AND 70
    OR char_length(btrim(COALESCE(p_search_placeholder, ''))) NOT BETWEEN 1 AND 90
    OR char_length(btrim(COALESCE(p_desktop_eyebrow, ''))) NOT BETWEEN 1 AND 70
    OR char_length(btrim(COALESCE(p_desktop_title_prefix, ''))) NOT BETWEEN 1 AND 50
    OR char_length(btrim(COALESCE(p_desktop_title_accent, ''))) NOT BETWEEN 1 AND 50
    OR char_length(btrim(COALESCE(p_desktop_description, ''))) NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Revisa los textos de la portada: hay campos vacíos o demasiado largos' USING ERRCODE = '22023';
  END IF;

  IF p_desktop_banner_image IS NULL OR NOT (
    p_desktop_banner_image IN (
      '/optimized/fondos/hero-banner-food.webp',
      '/optimized/fondos/combo-banner-bg.webp',
      '/optimized/fondos/public-flow-bg.webp',
      '/optimized/fondos/delivery-card-bg.webp'
    )
    OR (
      char_length(p_desktop_banner_image) <= 1500000
      AND p_desktop_banner_image ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    )
  ) THEN
    RAISE EXCEPTION 'Sube una imagen JPG, PNG o WebP válida y liviana para la portada' USING ERRCODE = '22023';
  END IF;

  INSERT INTO fullchinavzla.public_order_page_settings (
    id, mobile_heading, search_placeholder, desktop_eyebrow, desktop_title_prefix,
    desktop_title_accent, desktop_description, desktop_banner_image, updated_at, updated_by
  ) VALUES (
    TRUE, btrim(p_mobile_heading), btrim(p_search_placeholder), btrim(p_desktop_eyebrow),
    btrim(p_desktop_title_prefix), btrim(p_desktop_title_accent), btrim(p_desktop_description),
    p_desktop_banner_image, now(), auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    mobile_heading = EXCLUDED.mobile_heading,
    search_placeholder = EXCLUDED.search_placeholder,
    desktop_eyebrow = EXCLUDED.desktop_eyebrow,
    desktop_title_prefix = EXCLUDED.desktop_title_prefix,
    desktop_title_accent = EXCLUDED.desktop_title_accent,
    desktop_description = EXCLUDED.desktop_description,
    desktop_banner_image = EXCLUDED.desktop_banner_image,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'mobileHeading', v_row.mobile_heading,
    'searchPlaceholder', v_row.search_placeholder,
    'desktopEyebrow', v_row.desktop_eyebrow,
    'desktopTitlePrefix', v_row.desktop_title_prefix,
    'desktopTitleAccent', v_row.desktop_title_accent,
    'desktopDescription', v_row.desktop_description,
    'desktopBannerImage', v_row.desktop_banner_image
  );
END;
$$;

COMMENT ON TABLE fullchinavzla.public_order_page_settings IS 'Textos de portada pública y ruta o imagen personalizada del banner.';
COMMENT ON FUNCTION fullchinavzla.fn_admin_update_public_order_page_settings(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) IS 'Actualiza la portada de pedir solo para owner y manager.';

COMMIT;
