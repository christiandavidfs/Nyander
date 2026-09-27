-- Nyander Profile Features
-- Run AFTER 003_paypal_migration.sql

-- Avatar URL for profile pictures
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Video URLs for cat profiles (future use)
ALTER TABLE cats ADD COLUMN IF NOT EXISTS video_urls TEXT[] DEFAULT '{}';

-- Adoption requests: add shelter notes field
ALTER TABLE adoption_requests ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid() = owner
  );

-- Anyone can view avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
