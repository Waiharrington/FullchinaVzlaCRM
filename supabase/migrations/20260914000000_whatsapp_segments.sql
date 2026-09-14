-- Segmentos manuales para campañas de WhatsApp.
BEGIN;

SET LOCAL search_path = fullchinavzla, pg_temp;

CREATE TABLE IF NOT EXISTS fullchinavzla.whatsapp_segments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  description TEXT,
  created_by  UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_segments_name
  ON fullchinavzla.whatsapp_segments (lower(trim(name)));

CREATE TABLE IF NOT EXISTS fullchinavzla.whatsapp_segment_members (
  segment_id  UUID NOT NULL REFERENCES fullchinavzla.whatsapp_segments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES fullchinavzla.customers(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (segment_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_segment_members_customer
  ON fullchinavzla.whatsapp_segment_members (customer_id);

DROP TRIGGER IF EXISTS set_updated_at_whatsapp_segments ON fullchinavzla.whatsapp_segments;
CREATE TRIGGER set_updated_at_whatsapp_segments
  BEFORE UPDATE ON fullchinavzla.whatsapp_segments
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();

ALTER TABLE fullchinavzla.whatsapp_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.whatsapp_segment_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_segments_select ON fullchinavzla.whatsapp_segments;
CREATE POLICY whatsapp_segments_select ON fullchinavzla.whatsapp_segments
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS whatsapp_segments_write ON fullchinavzla.whatsapp_segments;
CREATE POLICY whatsapp_segments_write ON fullchinavzla.whatsapp_segments
  FOR ALL TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS whatsapp_segment_members_select ON fullchinavzla.whatsapp_segment_members;
CREATE POLICY whatsapp_segment_members_select ON fullchinavzla.whatsapp_segment_members
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS whatsapp_segment_members_write ON fullchinavzla.whatsapp_segment_members;
CREATE POLICY whatsapp_segment_members_write ON fullchinavzla.whatsapp_segment_members
  FOR ALL TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  fullchinavzla.whatsapp_segments,
  fullchinavzla.whatsapp_segment_members
TO authenticated, service_role;

COMMIT;
