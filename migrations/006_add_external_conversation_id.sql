ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS external_conversation_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_external_id
  ON conversations (external_conversation_id)
  WHERE external_conversation_id IS NOT NULL;
