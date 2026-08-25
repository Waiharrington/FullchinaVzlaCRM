-- AI intake is intentionally a draft queue. It never writes purchases, expenses,
-- payments or stock directly. A separate authenticated approval flow must do that.
CREATE TABLE IF NOT EXISTS fullchinavzla.ai_intake_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'telegram' CHECK (source IN ('telegram')),
  source_message_id TEXT NOT NULL,
  source_chat_id TEXT NOT NULL,
  source_user_id TEXT,
  input_kind TEXT NOT NULL CHECK (input_kind IN ('text', 'voice', 'photo', 'document', 'mixed')),
  raw_text TEXT,
  transcription TEXT,
  media_file_id TEXT,
  media_mime_type TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'needs_review', 'awaiting_confirmation', 'approved', 'rejected', 'failed')),
  error_message TEXT,
  approved_by UUID REFERENCES fullchinavzla.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_message_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_intake_status ON fullchinavzla.ai_intake_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_intake_chat ON fullchinavzla.ai_intake_messages(source_chat_id, created_at DESC);

ALTER TABLE fullchinavzla.ai_intake_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_intake_owner_manager_select ON fullchinavzla.ai_intake_messages;
CREATE POLICY ai_intake_owner_manager_select ON fullchinavzla.ai_intake_messages
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS ai_intake_owner_manager_update ON fullchinavzla.ai_intake_messages;
CREATE POLICY ai_intake_owner_manager_update ON fullchinavzla.ai_intake_messages
  FOR UPDATE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT, UPDATE ON fullchinavzla.ai_intake_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON fullchinavzla.ai_intake_messages TO service_role;

DROP TRIGGER IF EXISTS set_updated_at_ai_intake_messages ON fullchinavzla.ai_intake_messages;
CREATE TRIGGER set_updated_at_ai_intake_messages
  BEFORE UPDATE ON fullchinavzla.ai_intake_messages
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();
