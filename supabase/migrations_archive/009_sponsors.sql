-- Sponsors table for pet-related businesses (vets, pet stores, etc.)
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'trial')),
  plan TEXT CHECK (plan IN ('one_time', 'monthly', 'trial')),
  trial_ends_at TIMESTAMPTZ,
  paypal_subscription_id TEXT,
  paypal_order_id TEXT,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track clicks on sponsor links for popularity ranking
CREATE TABLE IF NOT EXISTS sponsor_clicks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_clicks ENABLE ROW LEVEL SECURITY;

-- Public can view active/trial sponsors
CREATE POLICY "Anyone can view active sponsors"
  ON sponsors FOR SELECT
  USING (status IN ('active', 'trial'));

-- Authenticated users can track clicks
CREATE POLICY "Authenticated users can track clicks"
  ON sponsor_clicks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Anyone can view click counts (aggregated, no user data)
CREATE POLICY "Anyone can view click counts"
  ON sponsor_clicks FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsors_ranking ON sponsors(ranking DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsors_status ON sponsors(status);
CREATE INDEX IF NOT EXISTS idx_sponsor_clicks_sponsor ON sponsor_clicks(sponsor_id);

-- Storage bucket for sponsor logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor_logos', 'sponsor_logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view sponsor logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sponsor_logos');

CREATE POLICY "Authenticated users can upload sponsor logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sponsor_logos'
    AND auth.role() = 'authenticated'
  );
