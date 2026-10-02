-- Accesos necesarios para el envío real de campañas desde el bot:
-- 1. service_role (el bot) marca mensajes como enviados/fallidos.
-- 2. owner/manager cancelan los mensajes pendientes con "Detener envío".
-- 3. Índice parcial para leer el siguiente mensaje en cola.
-- NO ejecutar en el VPS sin autorización explícita y backup previo.

GRANT UPDATE (status, provider_id, error_message, sent_at)
  ON fullchinavzla.whatsapp_messages TO authenticated, service_role;

DROP POLICY IF EXISTS whatsapp_messages_update ON fullchinavzla.whatsapp_messages;
CREATE POLICY whatsapp_messages_update ON fullchinavzla.whatsapp_messages
  FOR UPDATE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_queued
  ON fullchinavzla.whatsapp_messages (created_at)
  WHERE status = 'queued';
