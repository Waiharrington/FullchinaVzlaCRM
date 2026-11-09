BEGIN;

-- Dedicated public assets for Full China. The global self-hosted upload cap is
-- not changed; this bucket is capped at 25 MiB and accepts only video/poster media.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fullchina-public-media',
  'Full China public media',
  TRUE,
  26214400,
  ARRAY['video/mp4', 'image/jpeg']::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS fullchina_public_media_read ON storage.objects;
CREATE POLICY fullchina_public_media_read
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'fullchina-public-media');

DROP POLICY IF EXISTS fullchina_public_media_upload ON storage.objects;
CREATE POLICY fullchina_public_media_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fullchina-public-media'
    AND name ~ '^instagram/[1-6]/[0-9a-f-]{36}\.(mp4|jpg)$'
    AND fullchinavzla.get_current_user_role() IN ('owner', 'manager')
  );

DROP POLICY IF EXISTS fullchina_public_media_delete ON storage.objects;
CREATE POLICY fullchina_public_media_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fullchina-public-media'
    AND name ~ '^instagram/[1-6]/[0-9a-f-]{36}\.(mp4|jpg)$'
    AND fullchinavzla.get_current_user_role() IN ('owner', 'manager')
  );

ALTER TABLE fullchinavzla.public_order_page_settings
  ADD COLUMN IF NOT EXISTS contact_reels JSONB NOT NULL DEFAULT '[
    {"src":"/videos/instagram/reel-1.mp4?v=20261024-new","poster":"/optimized/instagram/reel-1.webp?v=20261024-new"},
    {"src":"/videos/instagram/reel-2.mp4?v=20260922-audio","poster":"/optimized/instagram/reel-2.webp"},
    {"src":"/videos/instagram/reel-3.mp4?v=20260922-audio","poster":"/optimized/instagram/reel-3.webp"},
    {"src":"/videos/instagram/reel-4.mp4?v=20261024-reel4","poster":"/optimized/instagram/reel-4.webp?v=20261024-reel4"},
    {"src":"/videos/instagram/reel-5.mp4?v=20260922-audio","poster":"/optimized/instagram/reel-5.webp"},
    {"src":"/videos/instagram/reel-6.mp4?v=20260922-audio","poster":"/optimized/instagram/reel-6.webp"}
  ]'::JSONB;

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
    'carouselSelectionConfigured', carousel_selection_configured,
    'contactPhone', contact_phone,
    'contactWhatsapp', contact_whatsapp,
    'contactAddress', contact_address,
    'contactDirectionsUrl', contact_directions_url,
    'contactInstagramUrl', contact_instagram_url,
    'contactFacebookUrl', contact_facebook_url,
    'contactDays', contact_days,
    'contactOpenTime', contact_open_time,
    'contactCloseTime', contact_close_time,
    'contactReels', contact_reels
  )
  FROM fullchinavzla.public_order_page_settings
  WHERE id = TRUE;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_update_public_order_reels(p_reels JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_reel JSONB;
  v_index INTEGER;
  v_video_path TEXT;
  v_poster_path TEXT;
  v_valid_static BOOLEAN;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'No tienes permiso para editar los videos de la tienda' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_reels) IS DISTINCT FROM 'array' OR jsonb_array_length(p_reels) <> 6 THEN
    RAISE EXCEPTION 'La lista de videos debe contener seis espacios' USING ERRCODE = '22023';
  END IF;

  FOR v_reel, v_index IN
    SELECT item.value, item.ordinality::INTEGER
    FROM jsonb_array_elements(p_reels) WITH ORDINALITY AS item(value, ordinality)
  LOOP
    v_video_path := COALESCE(v_reel->>'videoPath', '');
    v_poster_path := COALESCE(v_reel->>'posterPath', '');

    IF v_video_path <> '' OR v_poster_path <> '' THEN
      IF v_video_path !~ ('^instagram/' || v_index || '/[0-9a-f-]{36}\.mp4$')
        OR v_poster_path !~ ('^instagram/' || v_index || '/[0-9a-f-]{36}\.jpg$')
        OR split_part(v_video_path, '/', 3) <> split_part(v_poster_path, '/', 3) THEN
        RAISE EXCEPTION 'La ruta de un video no es válida para esta tienda' USING ERRCODE = '22023';
      END IF;
    ELSE
      v_valid_static := EXISTS (
        SELECT 1
        FROM (VALUES
          ('/videos/instagram/reel-1.mp4?v=20261024-new', '/optimized/instagram/reel-1.webp?v=20261024-new'),
          ('/videos/instagram/reel-2.mp4?v=20260922-audio', '/optimized/instagram/reel-2.webp'),
          ('/videos/instagram/reel-3.mp4?v=20260922-audio', '/optimized/instagram/reel-3.webp'),
          ('/videos/instagram/reel-4.mp4?v=20261024-reel4', '/optimized/instagram/reel-4.webp?v=20261024-reel4'),
          ('/videos/instagram/reel-5.mp4?v=20260922-audio', '/optimized/instagram/reel-5.webp'),
          ('/videos/instagram/reel-6.mp4?v=20260922-audio', '/optimized/instagram/reel-6.webp')
        ) AS library(src, poster)
        WHERE library.src = v_reel->>'src'
          AND library.poster = v_reel->>'poster'
      );
      IF NOT v_valid_static THEN
        RAISE EXCEPTION 'Solo puedes escoger videos de la biblioteca de Full China' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  UPDATE fullchinavzla.public_order_page_settings
  SET contact_reels = p_reels, updated_at = now(), updated_by = auth.uid()
  WHERE id = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la configuración de la página de pedir' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('contactReels', p_reels);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_update_public_order_reels(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_update_public_order_reels(JSONB) TO authenticated, service_role;

COMMENT ON COLUMN fullchinavzla.public_order_page_settings.contact_reels IS 'Seis videos de contacto: recursos locales de Full China o rutas de su bucket de medios.';
COMMENT ON FUNCTION fullchinavzla.fn_admin_update_public_order_reels(JSONB) IS 'Actualiza los videos públicos de contacto solo para owner y manager.';

COMMIT;
