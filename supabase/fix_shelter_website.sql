-- Shelter website URL (run in Supabase SQL Editor, safe)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
