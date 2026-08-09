-- Secure PIN authentication for FullChinaVzla.
-- PIN values are stored only as bcrypt hashes. The public client never receives
-- a password or the service-role key; an Edge Function exchanges a valid PIN
-- for a single-use Supabase magic-link token.

CREATE TABLE IF NOT EXISTS fullchinavzla.pin_credentials (
  user_id UUID PRIMARY KEY REFERENCES fullchinavzla.profiles(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fullchinavzla.pin_rate_limits (
  client_key TEXT PRIMARY KEY CHECK (char_length(client_key) BETWEEN 32 AND 128),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fullchinavzla.pin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.pin_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_verify_pin_login(
  p_pin TEXT,
  p_client_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, extensions, auth, pg_temp
AS $$
DECLARE
  v_limit fullchinavzla.pin_rate_limits%ROWTYPE;
  v_user_id UUID;
  v_email TEXT;
  v_failed INTEGER;
BEGIN
  IF p_client_key IS NULL OR char_length(p_client_key) NOT BETWEEN 32 AND 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  INSERT INTO fullchinavzla.pin_rate_limits(client_key)
  VALUES (p_client_key)
  ON CONFLICT (client_key) DO NOTHING;

  SELECT * INTO v_limit
  FROM fullchinavzla.pin_rate_limits
  WHERE client_key = p_client_key
  FOR UPDATE;

  IF v_limit.locked_until IS NOT NULL AND v_limit.locked_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'temporarily_locked',
      'retry_after_seconds', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_limit.locked_until - now())))::INTEGER)
    );
  END IF;

  IF v_limit.window_started_at < now() - interval '15 minutes' THEN
    UPDATE fullchinavzla.pin_rate_limits
    SET failed_attempts = 0,
        window_started_at = now(),
        locked_until = NULL,
        updated_at = now()
    WHERE client_key = p_client_key;
    v_limit.failed_attempts := 0;
  END IF;

  IF p_pin ~ '^[0-9]{4}$' THEN
    SELECT p.id, u.email
      INTO v_user_id, v_email
    FROM fullchinavzla.pin_credentials c
    JOIN fullchinavzla.profiles p ON p.id = c.user_id AND p.is_active
    JOIN auth.users u ON u.id = p.id
    WHERE extensions.crypt(p_pin, c.pin_hash) = c.pin_hash
      AND (u.banned_until IS NULL OR u.banned_until <= now())
    LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    UPDATE fullchinavzla.pin_credentials
    SET last_used_at = now(), updated_at = now()
    WHERE user_id = v_user_id;

    UPDATE fullchinavzla.pin_rate_limits
    SET failed_attempts = 0,
        window_started_at = now(),
        locked_until = NULL,
        updated_at = now()
    WHERE client_key = p_client_key;

    RETURN jsonb_build_object('ok', true, 'email', v_email);
  END IF;

  v_failed := v_limit.failed_attempts + 1;
  UPDATE fullchinavzla.pin_rate_limits
  SET failed_attempts = v_failed,
      locked_until = CASE WHEN v_failed >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
      updated_at = now()
  WHERE client_key = p_client_key;

  IF v_failed >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'temporarily_locked', 'retry_after_seconds', 900);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_set_user_pin(
  p_user_id UUID,
  p_pin TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, extensions, auth, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_role TEXT;
BEGIN
  SELECT role INTO v_actor_role
  FROM fullchinavzla.profiles
  WHERE id = v_actor AND is_active;

  IF v_actor IS NULL OR (v_actor <> p_user_id AND v_actor_role <> 'owner') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'pin_must_have_four_digits' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.profiles WHERE id = p_user_id AND is_active
  ) THEN
    RAISE EXCEPTION 'active_profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM fullchinavzla.pin_credentials
    WHERE user_id <> p_user_id
      AND extensions.crypt(p_pin, pin_hash) = pin_hash
  ) THEN
    RAISE EXCEPTION 'pin_already_in_use' USING ERRCODE = '23505';
  END IF;

  INSERT INTO fullchinavzla.pin_credentials(user_id, pin_hash)
  VALUES (p_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  ON CONFLICT (user_id) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      updated_at = now();
END;
$$;

REVOKE ALL ON fullchinavzla.pin_credentials, fullchinavzla.pin_rate_limits
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.pin_credentials,
  fullchinavzla.pin_rate_limits TO service_role;

REVOKE ALL ON FUNCTION fullchinavzla.fn_verify_pin_login(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_verify_pin_login(TEXT, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION fullchinavzla.fn_set_user_pin(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_set_user_pin(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON TABLE fullchinavzla.pin_credentials IS
  'Hashes bcrypt de PIN; nunca contiene PIN en texto plano.';
COMMENT ON FUNCTION fullchinavzla.fn_verify_pin_login(TEXT, TEXT) IS
  'Verifica PIN desde Edge Function y limita a cinco intentos fallidos por cliente cada quince minutos.';
