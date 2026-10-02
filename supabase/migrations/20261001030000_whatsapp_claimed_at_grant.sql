-- Permisos por columna explícitos del bot.
--
-- Contexto (revisión 2026-10-01): releaseClaim() en whatsapp-bot/queue.js
-- escribe `claimed_at` para liberar un reclamo cuando WhatsApp se desconecta
-- justo después de reclamar. La migración 20261001010000 solo concedió
-- UPDATE sobre (status, provider_id, error_message, sent_at). Hoy funciona
-- porque service_role además tiene UPDATE a nivel TABLA (preexistente,
-- no documentado en ninguna migración): verificado empíricamente con
-- psql + SET ROLE service_role + ROLLBACK. Si ese grant de tabla se
-- revocara y solo quedaran los grants por columna, el bot NO podría liberar
-- el reclamo y el mensaje quedaría en 'sending' hasta cerrarlo como fallido.
-- Esta migración deja `claimed_at` explícito en los grants por columna.
--
-- Verificación repetible contra la BD real: supabase/verify_whatsapp_sender.sql
-- NO ejecutar en el VPS sin autorización explícita y backup previo.

GRANT UPDATE (claimed_at)
  ON fullchinavzla.whatsapp_messages TO service_role;

COMMENT ON COLUMN fullchinavzla.whatsapp_messages.claimed_at IS
  'Instante del reclamo atómico (RPC claim_next_whatsapp_message). El bot lo limpia en releaseClaim; requiere UPDATE para service_role.';
