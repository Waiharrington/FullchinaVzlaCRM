-- =============================================================================
-- FIX: fn_admin_set_password y fn_admin_create_user no resolvían crypt/gen_salt
-- porque pgcrypto vive en el schema `extensions` y no estaba en el search_path.
-- Se recrean con 'extensions' en el search_path (mismo patrón que fn_set_user_pin).
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_password(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'extensions', 'pg_temp'
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

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_create_user(
  p_email text, p_password text, p_full_name text, p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'extensions', 'pg_temp'
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

  DELETE FROM flexpro.leaderboard WHERE user_id = v_id;
  DELETE FROM flexpro.profiles    WHERE id = v_id;

  INSERT INTO fullchinavzla.profiles (id, full_name, role, is_active)
  VALUES (v_id, trim(p_full_name), p_role, true);

  RETURN v_id;
END;
$fn$;

COMMIT;
