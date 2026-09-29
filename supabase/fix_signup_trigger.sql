-- Fix: profiles are created by the signup trigger (SECURITY DEFINER),
-- the app no longer writes to profiles on register (RLS violation without session).
-- Run in Supabase SQL Editor (safe: only replaces the trigger function).

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
