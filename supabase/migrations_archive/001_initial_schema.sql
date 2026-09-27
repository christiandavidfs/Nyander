-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('usuario', 'centro')),
  display_name TEXT,
  phone TEXT,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  score INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cats table
CREATE TABLE IF NOT EXISTS cats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  likes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'pending', 'adopted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adoption requests table
CREATE TABLE IF NOT EXISTS adoption_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cat_id, user_id, created_at)
);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cat_id, user_id)
);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id),
  shelter_id UUID NOT NULL REFERENCES profiles(id),
  donor_id UUID REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sponsorships table (padrinazgo)
CREATE TABLE IF NOT EXISTS sponsorships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  shelter_id UUID NOT NULL REFERENCES profiles(id),
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  interval TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'active',
  last_payment_at TIMESTAMPTZ,
  payment_count INTEGER DEFAULT 0,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliate clicks tracking
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cat_id UUID NOT NULL REFERENCES cats(id),
  affiliate_id TEXT NOT NULL,
  referral_code TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shelter subscriptions (premium plans)
CREATE TABLE IF NOT EXISTS shelter_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shelter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'pro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  cat_id UUID REFERENCES cats(id),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cats ENABLE ROW LEVEL SECURITY;
ALTER TABLE adoption_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for cats
CREATE POLICY "Anyone can view available cats" ON cats FOR SELECT USING (status = 'available' OR auth.uid() = shelter_id);
CREATE POLICY "Shelters can insert own cats" ON cats FOR INSERT WITH CHECK (auth.uid() = shelter_id);
CREATE POLICY "Shelters can update own cats" ON cats FOR UPDATE USING (auth.uid() = shelter_id);
CREATE POLICY "Shelters can delete own cats" ON cats FOR DELETE USING (auth.uid() = shelter_id);

-- RLS Policies for adoption_requests
CREATE POLICY "Users can view own requests" ON adoption_requests FOR SELECT USING (auth.uid() = user_id OR auth.uid() = shelter_id);
CREATE POLICY "Users can insert requests" ON adoption_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Shelters can update requests" ON adoption_requests FOR UPDATE USING (auth.uid() = shelter_id);

-- RLS Policies for likes
CREATE POLICY "Anyone can view likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own likes" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON likes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for donations
CREATE POLICY "Shelters can view own donations" ON donations FOR SELECT USING (auth.uid() = shelter_id OR auth.uid() = donor_id);
CREATE POLICY "Anyone can insert donations" ON donations FOR INSERT WITH CHECK (true);

-- RLS Policies for sponsorships
CREATE POLICY "Users can view own sponsorships" ON sponsorships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = shelter_id);
CREATE POLICY "Users can insert sponsorships" ON sponsorships FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for affiliate_clicks
CREATE POLICY "Anyone can insert affiliate clicks" ON affiliate_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Shelters can view own cat affiliate clicks" ON affiliate_clicks FOR SELECT USING (
  EXISTS (SELECT 1 FROM cats WHERE cats.id = affiliate_clicks.cat_id AND cats.shelter_id = auth.uid())
);

-- RLS Policies for shelter_subscriptions
CREATE POLICY "Shelters can view own subscription" ON shelter_subscriptions FOR SELECT USING (auth.uid() = shelter_id);
CREATE POLICY "Shelters can insert own subscription" ON shelter_subscriptions FOR INSERT WITH CHECK (auth.uid() = shelter_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Indexes for performance
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cats_updated_at BEFORE UPDATE ON cats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_adoption_requests_updated_at BEFORE UPDATE ON adoption_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sponsorships_updated_at BEFORE UPDATE ON sponsorships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shelter_subscriptions_updated_at BEFORE UPDATE ON shelter_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
