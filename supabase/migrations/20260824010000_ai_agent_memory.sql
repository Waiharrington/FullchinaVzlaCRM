CREATE TABLE IF NOT EXISTS fullchinavzla.ai_agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'telegram',
  source_chat_id TEXT NOT NULL,
  source_user_id TEXT,
  summary TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_chat_id)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.ai_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES fullchinavzla.ai_agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_conversation
  ON fullchinavzla.ai_agent_messages(conversation_id, created_at DESC);

ALTER TABLE fullchinavzla.ai_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.ai_agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_agent_conversations_owner_manager ON fullchinavzla.ai_agent_conversations;
CREATE POLICY ai_agent_conversations_owner_manager ON fullchinavzla.ai_agent_conversations
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS ai_agent_messages_owner_manager ON fullchinavzla.ai_agent_messages;
CREATE POLICY ai_agent_messages_owner_manager ON fullchinavzla.ai_agent_messages
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT ON fullchinavzla.ai_agent_conversations, fullchinavzla.ai_agent_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON fullchinavzla.ai_agent_conversations TO service_role;
GRANT SELECT, INSERT ON fullchinavzla.ai_agent_messages TO service_role;

DROP TRIGGER IF EXISTS set_updated_at_ai_agent_conversations ON fullchinavzla.ai_agent_conversations;
CREATE TRIGGER set_updated_at_ai_agent_conversations
  BEFORE UPDATE ON fullchinavzla.ai_agent_conversations
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();
