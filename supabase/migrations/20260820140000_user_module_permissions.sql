-- =============================================================================
-- FULL CHINA VZLA - Permisos de módulos por usuario (override sobre el rol)
-- =============================================================================
-- profiles.allowed_modules:
--   NULL         -> el usuario usa los permisos por defecto de su rol
--   text[] lista -> sólo puede ver esos módulos (rutas del nav), ignorando el
--                   default del rol. El owner siempre ve todo (no se aplica).
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

ALTER TABLE fullchinavzla.profiles
  ADD COLUMN IF NOT EXISTS allowed_modules text[] DEFAULT NULL;

COMMENT ON COLUMN fullchinavzla.profiles.allowed_modules IS
  'Override de módulos visibles por usuario (rutas del nav). NULL = defaults del rol.';

-- Recrear el listado para incluir allowed_modules --------------------------------
DROP FUNCTION IF EXISTS fullchinavzla.fn_admin_list_users();

CREATE FUNCTION fullchinavzla.fn_admin_list_users()
RETURNS TABLE (
  id              uuid,
  email           text,
  full_name       text,
  role            text,
  is_active       boolean,
  allowed_modules text[],
  created_at      timestamptz,
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
           p.allowed_modules,
           u.created_at,
           u.last_sign_in_at
    FROM fullchinavzla.profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.role, u.email;
END;
$fn$;

-- Setear el override de módulos --------------------------------------------------
-- p_modules NULL  -> vuelve a los defaults del rol.
-- p_modules array -> sólo esos módulos.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_modules(p_user_id uuid, p_modules text[])
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
  UPDATE fullchinavzla.profiles SET allowed_modules = p_modules WHERE id = p_user_id;
END;
$fn$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_list_users()                 FROM PUBLIC;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_modules(uuid, text[])    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_list_users()              TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_modules(uuid, text[]) TO authenticated;

COMMIT;
