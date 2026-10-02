-- Reserva atómica de la cola de WhatsApp, campañas por lote (batch_id) y
-- recuperación segura de envíos interrumpidos.
--
-- Problemas que resuelve (revisión 2026-10-01):
--  1. Duplicados entre instancias: el bot ahora RECLAMA la fila con
--     UPDATE ... FOR UPDATE SKIP LOCKED en una sola transacción (RPC),
--     pasando a estado 'sending' ANTES de enviar.
--  2. Reenvíos tras reinicio: una fila 'sending' vieja se resuelve como
--     'failed' (nunca vuelve a 'queued'), así no se reenvía un mensaje
--     que pudo haber salido.
--  3. "Detener envío" por campaña: batch_id agrupa los mensajes de cada
--     encolado y permite cancelar solo ese lote (incluida la fila 'sending'
--     en curso, que el bot re-verifica justo antes de enviar).
--
-- NO ejecutar en el VPS sin autorización explícita y backup previo.

ALTER TABLE fullchinavzla.whatsapp_messages
  ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

ALTER TABLE fullchinavzla.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE fullchinavzla.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sending_claimed
  ON fullchinavzla.whatsapp_messages (claimed_at)
  WHERE status = 'sending';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_batch_active
  ON fullchinavzla.whatsapp_messages (batch_id, created_at)
  WHERE status IN ('queued', 'sending');

-- Reclama el siguiente mensaje de cola de forma atómica: dos procesos jamás
-- reciben la misma fila (SKIP LOCKED) y la fila queda en 'sending' apenas se
-- reserva, por lo que otro proceso ya no la verá como 'queued'.
-- Devuelve json con las columnas + full_name del cliente (para [Nombre]).
CREATE OR REPLACE FUNCTION fullchinavzla.claim_next_whatsapp_message()
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  WITH claimed AS (
    UPDATE fullchinavzla.whatsapp_messages m
    SET status = 'sending',
        claimed_at = now()
    WHERE m.id = (
      SELECT n.id
      FROM fullchinavzla.whatsapp_messages n
      WHERE n.status = 'queued'
      ORDER BY n.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING m.*
  )
  SELECT to_jsonb(c) || jsonb_build_object('full_name', cu.full_name)
  FROM claimed c
  LEFT JOIN fullchinavzla.customers cu ON cu.id = c.customer_id
$$;

REVOKE ALL ON FUNCTION fullchinavzla.claim_next_whatsapp_message()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.claim_next_whatsapp_message()
  TO service_role;

COMMENT ON FUNCTION fullchinavzla.claim_next_whatsapp_message() IS
  'Reclama atómicamente el siguiente mensaje en cola (queued -> sending). Solo el bot (service_role).';
