BEGIN;

ALTER TABLE fullchinavzla.public_order_page_settings
  ADD COLUMN IF NOT EXISTS store_status_mode TEXT NOT NULL DEFAULT 'automatic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_order_page_settings_store_status_mode_check'
      AND conrelid = 'fullchinavzla.public_order_page_settings'::regclass
  ) THEN
    ALTER TABLE fullchinavzla.public_order_page_settings
      ADD CONSTRAINT public_order_page_settings_store_status_mode_check
      CHECK (store_status_mode IN ('automatic', 'open', 'closed'));
  END IF;
END;
$$;

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
    'contactReels', contact_reels,
    'storeStatusMode', store_status_mode
  )
  FROM fullchinavzla.public_order_page_settings
  WHERE id = TRUE;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_update_public_order_contact(
  p_contact_phone TEXT,
  p_contact_whatsapp TEXT,
  p_contact_address TEXT,
  p_contact_directions_url TEXT,
  p_contact_instagram_url TEXT,
  p_contact_facebook_url TEXT,
  p_contact_days TEXT,
  p_contact_open_time TEXT,
  p_contact_close_time TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_row fullchinavzla.public_order_page_settings%ROWTYPE;
  v_days TEXT[];
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'No tienes permiso para editar la información del local' USING ERRCODE = '42501';
  END IF;

  v_days := string_to_array(COALESCE(p_contact_days, ''), ', ');
  IF char_length(COALESCE(p_contact_phone, '')) > 30
    OR char_length(COALESCE(p_contact_whatsapp, '')) > 30
    OR char_length(btrim(COALESCE(p_contact_address, ''))) NOT BETWEEN 1 AND 180
    OR char_length(btrim(COALESCE(p_contact_days, ''))) NOT BETWEEN 1 AND 80
    OR COALESCE(p_contact_open_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR COALESCE(p_contact_close_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR COALESCE(p_contact_open_time, '') >= COALESCE(p_contact_close_time, '')
    OR (
      COALESCE(p_contact_days, '') NOT IN ('Martes a Domingo', 'Lunes a Domingo', 'Lunes a Sábado', 'Lunes a Viernes')
      AND (
        COALESCE(p_contact_days, '') !~ '^[^,]+(, [^,]+)*$'
        OR EXISTS (
          SELECT 1 FROM unnest(v_days) AS selected(day_name)
          WHERE selected.day_name NOT IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo')
        )
        OR cardinality(v_days) <> (SELECT count(DISTINCT day_name)::INTEGER FROM unnest(v_days) AS selected(day_name))
      )
    )
    OR COALESCE(p_contact_directions_url, '') !~ '^https?://[^[:space:]]+$'
    OR COALESCE(p_contact_instagram_url, '') !~ '^https?://[^[:space:]]+$'
    OR (COALESCE(p_contact_facebook_url, '') <> '' AND p_contact_facebook_url !~ '^https?://[^[:space:]]+$') THEN
    RAISE EXCEPTION 'Revisa teléfono, dirección, horario y enlaces del local' USING ERRCODE = '22023';
  END IF;

  INSERT INTO fullchinavzla.public_order_page_settings (
    id, contact_phone, contact_whatsapp, contact_address, contact_directions_url,
    contact_instagram_url, contact_facebook_url, contact_days, contact_open_time,
    contact_close_time, updated_at, updated_by
  ) VALUES (
    TRUE, btrim(COALESCE(p_contact_phone, '')), btrim(COALESCE(p_contact_whatsapp, '')),
    btrim(p_contact_address), btrim(p_contact_directions_url), btrim(p_contact_instagram_url),
    btrim(COALESCE(p_contact_facebook_url, '')), btrim(p_contact_days),
    p_contact_open_time, p_contact_close_time, now(), auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    contact_phone = EXCLUDED.contact_phone,
    contact_whatsapp = EXCLUDED.contact_whatsapp,
    contact_address = EXCLUDED.contact_address,
    contact_directions_url = EXCLUDED.contact_directions_url,
    contact_instagram_url = EXCLUDED.contact_instagram_url,
    contact_facebook_url = EXCLUDED.contact_facebook_url,
    contact_days = EXCLUDED.contact_days,
    contact_open_time = EXCLUDED.contact_open_time,
    contact_close_time = EXCLUDED.contact_close_time,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'contactPhone', v_row.contact_phone,
    'contactWhatsapp', v_row.contact_whatsapp,
    'contactAddress', v_row.contact_address,
    'contactDirectionsUrl', v_row.contact_directions_url,
    'contactInstagramUrl', v_row.contact_instagram_url,
    'contactFacebookUrl', v_row.contact_facebook_url,
    'contactDays', v_row.contact_days,
    'contactOpenTime', v_row.contact_open_time,
    'contactCloseTime', v_row.contact_close_time
  );
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_update_public_order_store_status(p_status_mode TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_status_mode TEXT;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el estado de la tienda' USING ERRCODE = '42501';
  END IF;

  IF p_status_mode NOT IN ('automatic', 'open', 'closed') THEN
    RAISE EXCEPTION 'El estado de la tienda no es válido' USING ERRCODE = '22023';
  END IF;

  UPDATE fullchinavzla.public_order_page_settings
  SET store_status_mode = p_status_mode,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = TRUE
  RETURNING store_status_mode INTO v_status_mode;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la configuración de la página de pedir' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('storeStatusMode', v_status_mode);
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_update_public_order_store_status(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_update_public_order_store_status(TEXT) TO authenticated, service_role;

COMMENT ON COLUMN fullchinavzla.public_order_page_settings.store_status_mode IS 'Estado de tienda: automatic respeta el horario; open fuerza apertura; closed fuerza cierre.';
COMMENT ON FUNCTION fullchinavzla.fn_admin_update_public_order_store_status(TEXT) IS 'Cambia el estado público de la tienda solo para owner y manager.';

COMMIT;
