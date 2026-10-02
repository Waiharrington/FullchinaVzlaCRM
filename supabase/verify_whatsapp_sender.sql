-- Verificación de los PERMISOS REALES del bot de WhatsApp contra PostgreSQL.
-- Las pruebas unitarias del bot (whatsapp-bot/test) usan una BD simulada y no
-- pueden detectar problemas de grants: este archivo sí corre contra la BD real.
--
-- Uso (como superuser/owner, p. ej. supabase_admin):
--   docker cp supabase/verify_whatsapp_sender.sql supabase-db:/tmp/
--   docker exec supabase-db psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/verify_whatsapp_sender.sql
--
-- TODO se ejecuta dentro de BEGIN/ROLLBACK: no modifica datos ni permisos.
-- Esperado: ningún ERROR; 0 filas afectadas (la cola puede estar vacía);
-- al final, los conteos de estado deben ser idénticos a los del inicio.

\pset pager off

\echo == 1. Atributos del rol service_role (debe tener bypassrls) ==
SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles WHERE rolname = 'service_role';

\echo == 2. UPDATE a nivel TABLA (debe incluir service_role) ==
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'fullchinavzla' AND table_name = 'whatsapp_messages'
  AND privilege_type = 'UPDATE'
ORDER BY grantee;

\echo == 3. UPDATE por COLUMNA reales (pg_attribute.attacl) ==
-- Debe incluir al menos: status, provider_id, error_message, sent_at,
-- claimed_at para service_role (releaseClaim escribe claimed_at).
SELECT a.attname AS columna,
       string_agg(pg_get_userbyid(x.grantee) || '=' || x.privilege_type,
                  ', ' ORDER BY x.grantee, x.privilege_type) AS grants
FROM pg_attribute a
CROSS JOIN LATERAL aclexplode(a.attacl) x
WHERE a.attrelid = 'fullchinavzla.whatsapp_messages'::regclass
  AND a.attnum > 0
  AND a.attacl IS NOT NULL
GROUP BY a.attname
ORDER BY a.attname;

\echo == 4. Los 4 UPDATE exactos que hace el bot, como service_role ==
SELECT status, count(*) AS antes FROM fullchinavzla.whatsapp_messages
GROUP BY status ORDER BY status;

BEGIN;
SET ROLE service_role;

\echo -- releaseClaim: status + claimed_at (la duda de la revisión)
WITH released AS (
  UPDATE fullchinavzla.whatsapp_messages
  SET status = 'queued', claimed_at = NULL
  WHERE status = 'sending' AND claimed_at IS NOT NULL
  RETURNING id
)
SELECT count(*) AS filas_release_claim FROM released;

\echo -- markSent: status + sent_at + provider_id
WITH marked AS (
  UPDATE fullchinavzla.whatsapp_messages
  SET status = 'sent', sent_at = now(), provider_id = 'whatsapp-web.js'
  WHERE status = 'sending'
  RETURNING id
)
SELECT count(*) AS filas_mark_sent FROM marked;

\echo -- markFailed / resolveStale: status + error_message
WITH failed AS (
  UPDATE fullchinavzla.whatsapp_messages
  SET status = 'failed', error_message = 'verificacion (rollback)'
  WHERE status = 'sending'
  RETURNING id
)
SELECT count(*) AS filas_mark_failed FROM failed;

ROLLBACK;

\echo == 5. RPC de reclamo atómico (debe devolver json con full_name) ==
BEGIN;
SELECT fullchinavzla.claim_next_whatsapp_message() AS claimed_json;
ROLLBACK;

\echo == 6. Estado final (debe ser idéntico al del paso 4) ==
SELECT status, count(*) AS despues FROM fullchinavzla.whatsapp_messages
GROUP BY status ORDER BY status;

\echo == VERIFICACION COMPLETADA: si no hubo ERROR, los permisos del bot son correctos ==
