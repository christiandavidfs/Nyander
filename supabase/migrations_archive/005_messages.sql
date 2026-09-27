-- Conversations for chat between adopters and shelters
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  adopter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cat_id, adopter_id, shelter_id)
);

-- Messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS: participants can view their conversations
CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = adopter_id OR auth.uid() = shelter_id);

CREATE POLICY "Participants can insert conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = adopter_id OR auth.uid() = shelter_id);

-- RLS: participants can view messages in their conversations
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.adopter_id = auth.uid() OR conversations.shelter_id = auth.uid())
    )
  );

CREATE POLICY "Participants can insert messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.adopter_id = auth.uid() OR conversations.shelter_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_adopter ON conversations(adopter_id);
CREATE INDEX IF NOT EXISTS idx_conversations_shelter ON conversations(shelter_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
