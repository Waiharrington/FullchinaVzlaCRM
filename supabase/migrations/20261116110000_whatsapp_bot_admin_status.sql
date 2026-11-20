-- Estado y QR de vinculación visibles solo para cuentas owner.
CREATE TABLE IF NOT EXISTS fullchinavzla.whatsapp_bot_status (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  connection_status TEXT NOT NULL DEFAULT 'starting'
    CHECK (connection_status IN ('starting', 'awaiting_qr', 'connecting', 'connected', 'disconnected', 'auth_failed')),
  qr_data_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_bot_status_qr_size CHECK (qr_data_url IS NULL OR length(qr_data_url) <= 50000)
);

ALTER TABLE fullchinavzla.whatsapp_bot_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE fullchinavzla.whatsapp_bot_status FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE fullchinavzla.whatsapp_bot_status TO service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_whatsapp_bot_status()
RETURNS TABLE (connection_status TEXT, qr_data_url TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, fullchinavzla
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.profiles p
    WHERE p.id = auth.uid() AND p.is_active = TRUE AND p.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT COALESCE(s.connection_status, 'disconnected'), s.qr_data_url, s.updated_at
  FROM (VALUES (TRUE)) AS singleton(id)
  LEFT JOIN fullchinavzla.whatsapp_bot_status s ON s.id = singleton.id;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_whatsapp_bot_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_whatsapp_bot_status() TO authenticated;

COMMENT ON TABLE fullchinavzla.whatsapp_bot_status IS
  'Heartbeat privado de WhatsApp y QR temporal de vinculación, accesible desde la PWA solo al rol owner.';
