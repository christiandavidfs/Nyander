-- ============================================================================
-- Nyander — Super Schema: drops everything and recreates fresh
-- Run this in Supabase SQL Editor to replace all 14 migration files.
-- Then run 999_seed_data.sql for test data.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- DROP EVERYTHING (reverse dependency order)
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_cats_updated_at ON cats;
DROP TRIGGER IF EXISTS update_adoption_requests_updated_at ON adoption_requests;
DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
DROP TRIGGER IF EXISTS update_sponsorships_updated_at ON sponsorships;
DROP TRIGGER IF EXISTS update_shelter_subscriptions_updated_at ON shelter_subscriptions;

DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS sponsor_invoices CASCADE;
DROP TABLE IF EXISTS sponsor_clicks CASCADE;
DROP TABLE IF EXISTS sponsors CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS affiliate_clicks CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS shelter_subscriptions CASCADE;
DROP TABLE IF EXISTS sponsorships CASCADE;
DROP TABLE IF EXISTS donations CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS adoption_requests CASCADE;
DROP TABLE IF EXISTS cats CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS countries CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS increment_cat_likes CASCADE;
DROP FUNCTION IF EXISTS increment_shelter_earnings CASCADE;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXTENSION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- COUNTRIES (no FK deps)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_name TEXT,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  flag TEXT
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES (extends auth.users)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('usuario', 'centro', 'sponsor')),
  display_name TEXT,
  phone TEXT,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  score INTEGER DEFAULT 0,
  paypal_customer_id TEXT,
  paypal_email TEXT,
  website_url TEXT,
  avatar_url TEXT,
  country_code TEXT REFERENCES countries(code),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- CATS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE cats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age TEXT,
  breed TEXT,
  description TEXT,
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  health_status TEXT,
  image_urls TEXT[] DEFAULT '{}',
  video_urls TEXT[] DEFAULT '{}',
  temperament JSONB DEFAULT '{}',
  likes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'pending', 'adopted')),
  country_code TEXT REFERENCES countries(code),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ADOPTION REQUESTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE adoption_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cat_id, user_id, created_at)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- LIKES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cat_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONATIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id),
  shelter_id UUID NOT NULL REFERENCES profiles(id),
  donor_id UUID REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  paypal_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  platform_fee DECIMAL(10,2) DEFAULT 0,
  payout_status TEXT DEFAULT 'pending',
  payout_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SPONSORSHIPS (cat padrinazgo)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE sponsorships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  shelter_id UUID NOT NULL REFERENCES profiles(id),
  paypal_subscription_id TEXT,
  paypal_customer_id TEXT,
  amount INTEGER NOT NULL,
  interval TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'active',
  platform_fee DECIMAL(10,2) DEFAULT 0,
  payout_status TEXT DEFAULT 'pending',
  last_payment_at TIMESTAMPTZ,
  payment_count INTEGER DEFAULT 0,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- AFFILIATE CLICKS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE affiliate_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id),
  affiliate_id TEXT NOT NULL,
  referral_code TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SHELTER SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE shelter_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'pro')),
  paypal_customer_id TEXT,
  paypal_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  cat_id UUID REFERENCES cats(id),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- CONVERSATIONS & MESSAGES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  adopter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cat_id, adopter_id, shelter_id)
);

CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SPONSORS (business listings)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  description TEXT,
  website_url TEXT,
  logo_url TEXT,
  category TEXT,
  phone TEXT,
  address TEXT,
  email TEXT,
  ranking INTEGER DEFAULT 0,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES profiles(id),
  country_code TEXT REFERENCES countries(code),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'trial')),
  plan TEXT CHECK (plan IN ('trial', 'monthly', 'yearly')),
  trial_ends_at TIMESTAMPTZ,
  paypal_subscription_id TEXT,
  paypal_order_id TEXT,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SPONSOR CLICKS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE sponsor_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SPONSOR INVOICES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE sponsor_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  country_code TEXT REFERENCES countries(code),
  paypal_transaction_id TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  goal_amount DECIMAL(10,2) NOT NULL,
  raised_amount DECIMAL(10,2) DEFAULT 0,
  image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cats ENABLE ROW LEVEL SECURITY;
ALTER TABLE adoption_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — COUNTRIES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view countries" ON countries
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — PROFILES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Shelters can view adoption requester profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM adoption_requests
      WHERE (adoption_requests.user_id = profiles.id OR adoption_requests.shelter_id = profiles.id)
        AND (adoption_requests.user_id = auth.uid() OR adoption_requests.shelter_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Conversation participants can view each other" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE (conversations.adopter_id = auth.uid() OR conversations.shelter_id = auth.uid())
        AND (conversations.adopter_id = profiles.id OR conversations.shelter_id = profiles.id)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — CATS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view available cats" ON cats
  FOR SELECT USING (status = 'available' OR auth.uid() = shelter_id);

CREATE POLICY "Shelters can insert own cats" ON cats
  FOR INSERT WITH CHECK (auth.uid() = shelter_id);

CREATE POLICY "Shelters can update own cats" ON cats
  FOR UPDATE USING (auth.uid() = shelter_id);

CREATE POLICY "Shelters can delete own cats" ON cats
  FOR DELETE USING (auth.uid() = shelter_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — ADOPTION REQUESTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own requests" ON adoption_requests
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = shelter_id);

CREATE POLICY "Users can insert requests" ON adoption_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shelters can update requests" ON adoption_requests
  FOR UPDATE USING (auth.uid() = shelter_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — LIKES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view likes" ON likes
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON likes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own likes" ON likes
  FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — DONATIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Shelters can view own donations" ON donations
  FOR SELECT USING (auth.uid() = shelter_id OR auth.uid() = donor_id);

CREATE POLICY "Authenticated users can insert donations" ON donations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — SPONSORSHIPS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own sponsorships" ON sponsorships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = shelter_id);

CREATE POLICY "Users can insert sponsorships" ON sponsorships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — AFFILIATE CLICKS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Authenticated users can insert affiliate clicks" ON affiliate_clicks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Shelters can view own cat affiliate clicks" ON affiliate_clicks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cats WHERE cats.id = affiliate_clicks.cat_id AND cats.shelter_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — SHELTER SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Shelters can view own subscription" ON shelter_subscriptions
  FOR SELECT USING (auth.uid() = shelter_id);

CREATE POLICY "Shelters can insert own subscription" ON shelter_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = shelter_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — CONVERSATIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Participants can view conversations" ON conversations
  FOR SELECT USING (auth.uid() = adopter_id OR auth.uid() = shelter_id);

CREATE POLICY "Participants can insert conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = adopter_id OR auth.uid() = shelter_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — MESSAGES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Participants can view messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.adopter_id = auth.uid() OR conversations.shelter_id = auth.uid())
    )
  );

CREATE POLICY "Participants can insert messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.adopter_id = auth.uid() OR conversations.shelter_id = auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — SPONSORS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view active sponsors" ON sponsors
  FOR SELECT USING (status IN ('active', 'trial') OR owner_id = auth.uid());

CREATE POLICY "Authenticated users can insert sponsors" ON sponsors
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners can update their sponsor" ON sponsors
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their sponsor" ON sponsors
  FOR DELETE USING (owner_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — SPONSOR CLICKS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Authenticated users can track clicks" ON sponsor_clicks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view click counts" ON sponsor_clicks
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — SPONSOR INVOICES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Sponsors can view own invoices" ON sponsor_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sponsors WHERE sponsors.id = sponsor_invoices.sponsor_id AND sponsors.owner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — CAMPAIGNS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view active campaigns" ON campaigns
  FOR SELECT USING (true);

CREATE POLICY "Shelters can insert own campaigns" ON campaigns
  FOR INSERT WITH CHECK (auth.uid() = shelter_id);

CREATE POLICY "Shelters can update own campaigns" ON campaigns
  FOR UPDATE USING (auth.uid() = shelter_id);

CREATE POLICY "Shelters can delete own campaigns" ON campaigns
  FOR DELETE USING (auth.uid() = shelter_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_cats_shelter_id ON cats(shelter_id);
CREATE INDEX IF NOT EXISTS idx_cats_status ON cats(status);
CREATE INDEX IF NOT EXISTS idx_cats_location ON cats(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_likes_cat_id ON likes(cat_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_cat_id ON donations(cat_id);
CREATE INDEX IF NOT EXISTS idx_donations_shelter_id ON donations(shelter_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_cat_id ON sponsorships(cat_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_user_id ON sponsorships(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_cat_id ON affiliate_clicks(cat_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_adopter ON conversations(adopter_id);
CREATE INDEX IF NOT EXISTS idx_conversations_shelter ON conversations(shelter_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_shelter ON campaigns(shelter_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_ranking ON sponsors(ranking DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsors_status ON sponsors(status);
CREATE INDEX IF NOT EXISTS idx_sponsor_clicks_sponsor ON sponsor_clicks(sponsor_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_cat_likes(cat_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cats SET likes = likes + 1 WHERE id = cat_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_shelter_earnings(shelter_id UUID, amount DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET score = score + amount WHERE id = shelter_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cats_updated_at BEFORE UPDATE ON cats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_adoption_requests_updated_at BEFORE UPDATE ON adoption_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sponsorships_updated_at BEFORE UPDATE ON sponsorships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shelter_subscriptions_updated_at BEFORE UPDATE ON shelter_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name, score, country_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'usuario'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    0,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.countries
        WHERE code = NULLIF(NEW.raw_user_meta_data->>'country_code', '')
      ) THEN NEW.raw_user_meta_data->>'country_code'
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════════════

-- Cat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('cat_media', 'cat_media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload cat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload cat media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cat_media' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Anyone can view cat media" ON storage.objects;
CREATE POLICY "Anyone can view cat media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cat_media');

DROP POLICY IF EXISTS "Owners can update cat media" ON storage.objects;
CREATE POLICY "Owners can update cat media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cat_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners can delete cat media" ON storage.objects;
CREATE POLICY "Owners can delete cat media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cat_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Sponsor logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor_logos', 'sponsor_logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view sponsor logos" ON storage.objects;
CREATE POLICY "Anyone can view sponsor logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sponsor_logos');

DROP POLICY IF EXISTS "Authenticated users can upload sponsor logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload sponsor logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sponsor_logos' AND auth.role() = 'authenticated'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
