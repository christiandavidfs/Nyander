-- Nyander Production Fixes
-- Run this AFTER 001_initial_schema.sql
-- From Supabase Studio: SQL Editor > paste > Run

-- 1. Function to safely increment cat likes (prevents race conditions)
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

-- 2. Fix RLS: profiles should not expose Stripe account IDs to everyone
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Shelters can view adoption requester profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM adoption_requests
      WHERE (adoption_requests.user_id = id OR adoption_requests.shelter_id = id)
        AND (adoption_requests.user_id = auth.uid() OR adoption_requests.shelter_id = auth.uid())
    )
  );

-- 3. Fix RLS: donations require authentication
DROP POLICY IF EXISTS "Anyone can insert donations" ON donations;
CREATE POLICY "Authenticated users can insert donations" ON donations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Fix RLS: affiliate clicks require authentication
DROP POLICY IF EXISTS "Anyone can insert affiliate clicks" ON affiliate_clicks;
CREATE POLICY "Authenticated users can insert affiliate clicks" ON affiliate_clicks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Fix RLS: notifications should only be insertable by the system or the user
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "Users can insert own notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Function to auto-create profile on user signup (avoids RLS insert issues)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name, score)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'usuario'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    0
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
