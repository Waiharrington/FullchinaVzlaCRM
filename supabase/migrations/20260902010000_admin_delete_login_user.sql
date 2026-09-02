BEGIN;

SET LOCAL ROLE supabase_admin;

ALTER TABLE fullchinavzla.profiles
  ADD COLUMN IF NOT EXISTS login_deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_active_login
  ON fullchinavzla.profiles (role, is_active)
  WHERE login_deleted_at IS NULL;

DROP FUNCTION IF EXISTS fullchinavzla.fn_admin_list_users();
CREATE FUNCTION fullchinavzla.fn_admin_list_users()
RETURNS TABLE (
  id uuid, email text, full_name text, role text, is_active boolean,
  allowed_modules text[], created_at timestamptz, last_sign_in_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $fn$
BEGIN
  PERFORM fullchinavzla.assert_owner();
  RETURN QUERY
    SELECT u.id, u.email::text, p.full_name, p.role,
           COALESCE(p.is_active, true), p.allowed_modules,
           u.created_at, u.last_sign_in_at
    FROM fullchinavzla.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.login_deleted_at IS NULL
    ORDER BY p.role, u.email;
END;
$fn$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'extensions', 'auth', 'pg_temp'
AS $fn$
DECLARE
  v_role text;
BEGIN
  PERFORM fullchinavzla.assert_owner();

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propio usuario mientras tienes la sesión abierta.';
  END IF;

  SELECT role INTO v_role
  FROM fullchinavzla.profiles
  WHERE id = p_user_id AND login_deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario de acceso no existe.';
  END IF;

  IF v_role = 'owner' AND (
    SELECT count(*) FROM fullchinavzla.profiles
    WHERE role = 'owner' AND is_active AND login_deleted_at IS NULL
  ) <= 1 THEN
    RAISE EXCEPTION 'No puedes eliminar el último dueño activo del negocio.';
  END IF;

  DELETE FROM fullchinavzla.pin_credentials WHERE user_id = p_user_id;
  DELETE FROM auth.identities WHERE user_id = p_user_id;

  UPDATE auth.users
  SET email = 'deleted+' || p_user_id::text || '@invalid.local',
      encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')),
      banned_until = 'infinity'::timestamptz,
      raw_user_meta_data = jsonb_build_object('deleted', true),
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE fullchinavzla.profiles
  SET is_active = false,
      allowed_modules = ARRAY[]::text[],
      login_deleted_at = now(),
      updated_at = now()
  WHERE id = p_user_id;
END;
$fn$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_list_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_delete_user(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
