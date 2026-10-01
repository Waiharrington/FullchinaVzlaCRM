BEGIN;
SET LOCAL ROLE supabase_admin;

ALTER TABLE fullchinavzla.employees
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

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

  -- Un dueño solo puede eliminarse si queda otro dueño activo. NULL histórico
  -- se interpreta igual que en fn_admin_list_users (activo por defecto).
  IF v_role = 'owner' AND NOT EXISTS (
    SELECT 1 FROM fullchinavzla.profiles
    WHERE role = 'owner' AND COALESCE(is_active, true)
      AND login_deleted_at IS NULL AND id <> p_user_id
  ) THEN
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

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_delete_user(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
