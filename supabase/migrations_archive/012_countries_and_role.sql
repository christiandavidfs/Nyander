-- Countries reference table
CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_name TEXT,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  flag TEXT
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code TEXT REFERENCES countries(code);
ALTER TABLE cats ADD COLUMN IF NOT EXISTS country_code TEXT REFERENCES countries(code);

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS country_code TEXT REFERENCES countries(code);
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

-- Sponsor invoices for payment history
CREATE TABLE IF NOT EXISTS sponsor_invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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

ALTER TABLE sponsor_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sponsors can view own invoices"
  ON sponsor_invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sponsors WHERE sponsors.id = sponsor_invoices.sponsor_id AND sponsors.owner_id = auth.uid()
  ));

CREATE POLICY "Anyone can view active sponsors"
  ON sponsors FOR SELECT
  USING (status IN ('active', 'trial'));

DROP POLICY IF EXISTS "Anyone can view active sponsors" ON sponsors;
CREATE POLICY "Anyone can view active sponsors"
  ON sponsors FOR SELECT
  USING (status IN ('active', 'trial') OR owner_id = auth.uid());
