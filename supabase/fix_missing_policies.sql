-- Fix missing RLS policies (run directly in Supabase SQL Editor)

-- 1. Allow conversation participants to see each other's profiles
DROP POLICY IF EXISTS "Conversation participants can view each other" ON profiles;
CREATE POLICY "Conversation participants can view each other" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE (conversations.adopter_id = auth.uid() OR conversations.shelter_id = auth.uid())
        AND (conversations.adopter_id = profiles.id OR conversations.shelter_id = profiles.id)
    )
  );

-- 2. Allow users to update their own likes (needed for upsert)
DROP POLICY IF EXISTS "Users can update own likes" ON likes;
CREATE POLICY "Users can update own likes" ON likes
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. Campaigns (if not yet created)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  goal_amount DECIMAL(10,2) NOT NULL,
  raised_amount DECIMAL(10,2) DEFAULT 0,
  image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON campaigns;
CREATE POLICY "Anyone can view active campaigns" ON campaigns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Shelters can insert own campaigns" ON campaigns;
CREATE POLICY "Shelters can insert own campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() = shelter_id);
DROP POLICY IF EXISTS "Shelters can update own campaigns" ON campaigns;
CREATE POLICY "Shelters can update own campaigns" ON campaigns FOR UPDATE USING (auth.uid() = shelter_id);
DROP POLICY IF EXISTS "Shelters can delete own campaigns" ON campaigns;
CREATE POLICY "Shelters can delete own campaigns" ON campaigns FOR DELETE USING (auth.uid() = shelter_id);

-- Temperament column
ALTER TABLE cats ADD COLUMN IF NOT EXISTS temperament JSONB DEFAULT '{}';
