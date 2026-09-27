-- Nyander PayPal Migration
-- Run AFTER 001_initial_schema.sql and 002_production_fixes.sql
-- From Supabase Studio: SQL Editor > paste > Run

-- ============================================================================
-- Safely rename stripe columns → paypal (only if source column exists)
-- ============================================================================

DO $$
BEGIN
  -- profiles
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE profiles RENAME COLUMN stripe_customer_id TO paypal_customer_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_account_id') THEN
    ALTER TABLE profiles RENAME COLUMN stripe_account_id TO paypal_email;
  END IF;

  -- donations
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'donations' AND column_name = 'stripe_payment_intent_id') THEN
    ALTER TABLE donations RENAME COLUMN stripe_payment_intent_id TO paypal_order_id;
  END IF;

  -- sponsorships
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sponsorships' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE sponsorships RENAME COLUMN stripe_subscription_id TO paypal_subscription_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sponsorships' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE sponsorships RENAME COLUMN stripe_customer_id TO paypal_customer_id;
  END IF;

  -- shelter_subscriptions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shelter_subscriptions' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE shelter_subscriptions RENAME COLUMN stripe_subscription_id TO paypal_subscription_id;
  END IF;
END $$;

-- ============================================================================
-- Add paypal columns if they don't exist (in case rename was skipped)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paypal_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paypal_email TEXT;

ALTER TABLE donations ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS paypal_customer_id TEXT;

ALTER TABLE shelter_subscriptions ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;

-- ============================================================================
-- Drop old stripe columns if they still exist (after rename)
-- ============================================================================

ALTER TABLE shelter_subscriptions DROP COLUMN IF EXISTS stripe_customer_id;

-- ============================================================================
-- Add payout tracking to donations
-- ============================================================================

ALTER TABLE donations ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending';
ALTER TABLE donations ADD COLUMN IF NOT EXISTS payout_id TEXT;

-- ============================================================================
-- Add payout tracking to sponsorships
-- ============================================================================

ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending';

-- ============================================================================
-- Function to credit shelter earnings
-- ============================================================================

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
