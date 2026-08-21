-- =============================================================================
-- FULL CHINA VZLA - Gestión de usuarios de acceso (login) desde la app
-- =============================================================================
-- Conjunto de RPC SECURITY DEFINER (owner-only) para administrar los usuarios
-- de autenticación sin exponer nunca la service_role al navegador. Todas las
-- funciones validan que quien llama sea 'owner' y operan sólo sobre usuarios
-- que tengan un perfil en fullchinavzla.profiles (aislamiento por tenant).
--
-- Las funciones quedan owned por supabase_admin (superuser) para poder tocar el
-- schema auth; se ejecutan como DEFINER y se exponen sólo al rol authenticated.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

-- Guarda reutilizable: exige rol owner del usuario autenticado ------------------
CREATE OR REPLACE FUNCTION fullchinavzla.assert_owner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $fn$
DECLARE v_role text;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Sólo el dueño (owner) puede administrar usuarios. Rol actual: %', COALESCE(v_role, 'ninguno');
  END IF;
END;
$fn$;

-- Listar usuarios de acceso -----------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_list_users()
RETURNS TABLE (
  id             uuid,
  email          text,
  full_name      text,
  role           text,
  is_active      boolean,
  created_at     timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $fn$
BEGIN
  PERFORM fullchinavzla.assert_owner();
  RETURN QUERY
    SELECT u.id,
           u.email::text,
           p.full_name,
           p.role,
           COALESCE(p.is_active, true),
           u.created_at,
           u.last_sign_in_at
    FROM fullchinavzla.profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.role, u.email;
END;
$fn$;

-- Cambiar contraseña ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_password(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $fn$
BEGIN
  PERFORM fullchinavzla.assert_owner();
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'El usuario no pertenece a este negocio.';
  END IF;
  UPDATE auth.users
     SET encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   WHERE id = p_user_id;
END;
$fn$;

-- Cambiar correo ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_email(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $fn$
DECLARE v_email text := lower(trim(p_email));
BEGIN
  PERFORM fullchinavzla.assert_owner();
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Correo inválido: %', p_email;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'El usuario no pertenece a este negocio.';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email AND id <> p_user_id) THEN
    RAISE EXCEPTION 'Ese correo ya está en uso por otro usuario.';
  END IF;

  UPDATE auth.users
     SET email = v_email,
         email_confirmed_at = COALESCE(email_confirmed_at, now()),
         updated_at = now()
   WHERE id = p_user_id;

  UPDATE auth.identities
     SET identity_data = jsonb_set(
           jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email), true),
           '{email_verified}', 'true'::jsonb, true),
         provider_id = v_email,
         updated_at = now()
   WHERE user_id = p_user_id AND provider = 'email';
END;
$fn$;

-- Cambiar rol / accesos ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $fn$
BEGIN
  PERFORM fullchinavzla.assert_owner();
  IF p_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_role;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'El usuario no pertenece a este negocio.';
  END IF;
  -- No permitir dejar el negocio sin ningún owner
  IF p_role <> 'owner'
     AND EXISTS (SELECT 1 FROM fullchinavzla.profiles WHERE id = p_user_id AND role = 'owner')
     AND (SELECT count(*) FROM fullchinavzla.profiles WHERE role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'No puedes quitar el último dueño (owner) del negocio.';
  END IF;
  UPDATE fullchinavzla.profiles SET role = p_role WHERE id = p_user_id;
END;
$fn$;

-- Activar / suspender acceso ----------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_active(p_user_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $fn$
BEGIN
  PERFORM fullchinavzla.assert_owner();
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'El usuario no pertenece a este negocio.';
  END IF;
  IF NOT p_active
     AND EXISTS (SELECT 1 FROM fullchinavzla.profiles WHERE id = p_user_id AND role = 'owner')
     AND (SELECT count(*) FROM fullchinavzla.profiles WHERE role = 'owner' AND COALESCE(is_active,true)) <= 1 THEN
    RAISE EXCEPTION 'No puedes suspender al último dueño (owner) activo.';
  END IF;
  UPDATE fullchinavzla.profiles SET is_active = p_active WHERE id = p_user_id;
  UPDATE auth.users
     SET banned_until = CASE WHEN p_active THEN NULL ELSE 'infinity'::timestamptz END,
         updated_at = now()
   WHERE id = p_user_id;
END;
$fn$;

-- Crear usuario de acceso -------------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_create_user(
  p_email text, p_password text, p_full_name text, p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $fn$
DECLARE
  v_id    uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
BEGIN
  PERFORM fullchinavzla.assert_owner();
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Correo inválido: %', p_email;
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
  END IF;
  IF p_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_role;
  END IF;
  IF coalesce(trim(p_full_name), '') = '' THEN
    RAISE EXCEPTION 'El nombre es obligatorio.';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Ya existe un usuario con ese correo.';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    -- Tokens vacíos ('' no NULL) para evitar el bug de GoTrue al escanear
    -- usuarios ("converting NULL to string is unsupported").
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', trim(p_full_name)),
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_email, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- El trigger global on_auth_user_created (de otro tenant, flexpro) inserta
  -- filas en flexpro.profiles/leaderboard para CUALQUIER usuario nuevo. Las
  -- limpiamos aquí para no ensuciar ese tenant con usuarios de FullChina.
  DELETE FROM flexpro.leaderboard WHERE user_id = v_id;
  DELETE FROM flexpro.profiles    WHERE id = v_id;

  INSERT INTO fullchinavzla.profiles (id, full_name, role, is_active)
  VALUES (v_id, trim(p_full_name), p_role, true);

  RETURN v_id;
END;
$fn$;

-- Permisos: sólo el rol authenticated puede invocar (la guarda interna exige owner)
REVOKE ALL ON FUNCTION fullchinavzla.assert_owner()                                    FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_list_users()                             FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_password(uuid, text)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_email(uuid, text)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_role(uuid, text)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_active(uuid, boolean)                FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_create_user(text, text, text, text)      FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_list_users()                          TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_password(uuid, text)              TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_email(uuid, text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_role(uuid, text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_active(uuid, boolean)             TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_create_user(text, text, text, text)   TO authenticated;

COMMIT;
