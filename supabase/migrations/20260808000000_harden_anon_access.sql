-- =============================================================================
-- FULL CHINA VZLA - ENDURECIMIENTO DEL ROL ANON
-- =============================================================================
-- El frontend usa la anon key para autenticarse, pero ninguna tabla del CRM
-- necesita acceso antes de que exista una sesion autenticada. Las consultas
-- posteriores al login usan el rol `authenticated` y siguen protegidas por RLS.
--
-- Esta migracion no modifica datos, politicas RLS ni permisos de authenticated
-- o service_role.
-- =============================================================================

BEGIN;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA fullchinavzla FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fullchinavzla FROM anon;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA fullchinavzla FROM anon;
REVOKE ALL PRIVILEGES ON SCHEMA fullchinavzla FROM anon;

-- Los objetos existentes pertenecen a postgres. Evita que futuros objetos
-- vuelvan a heredar acceso anon si son creados por postgres o supabase_admin.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA fullchinavzla
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA fullchinavzla
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA fullchinavzla
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA fullchinavzla
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA fullchinavzla
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA fullchinavzla
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anon;

COMMIT;
