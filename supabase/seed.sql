-- Seed data for Nyander (profiles + cats only)
-- Run AFTER applying all migrations AND creating auth users.
-- Auth users should be created FIRST via:
--   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/setup-complete.mjs
-- Or alternatively:
--   npm run seed
--
-- This SQL uses session_replication_role to bypass FK constraints so it works
-- even if auth.users don't exist yet (for SQL-first setups).
-- From Supabase Studio: SQL Editor > paste > Run

SET session_replication_role = 'replica';

-- ============================================================================
-- 1. Create profiles directly (bypass FK)
-- ============================================================================

INSERT INTO profiles (id, email, role, display_name, phone, address, score) VALUES
  ('00000000-0000-0000-0000-000000000001', 'shelter@nyander.app', 'centro', 'Warsaw Foster Network', '+48 600 100 200', 'ul. Główna 15, Warsaw', 92),
  ('00000000-0000-0000-0000-000000000002', 'adopter@nyander.app', 'usuario', 'Alex Demo', '+48 600 100 201', 'ul. Marszałkowska 10, Warsaw', 85)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Create demo cats
-- ============================================================================

INSERT INTO cats (shelter_id, name, age, breed, description, location, latitude, longitude, health_status, image_urls, likes, status) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Luna',
    '2 years',
    'Domestic Shorthair',
    'Gentle, curious, and happiest when she can nap near a sunny window.',
    'Warsaw Foster Home',
    52.2297, 21.0122,
    'Vaccinated',
    ARRAY['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=900&auto=format&fit=crop'],
    34,
    'available'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Milo',
    '1 year',
    'Tabby',
    'A playful little climber who loves feather toys and confident people.',
    'City Cat Rescue',
    52.2297, 21.0122,
    'Neutered',
    ARRAY['https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=900&auto=format&fit=crop'],
    27,
    'available'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Nala',
    '4 years',
    'Calico',
    'Independent at first, deeply affectionate once she decides you are her person.',
    'Northside Shelter',
    52.2297, 21.0122,
    'Special diet',
    ARRAY['https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=900&auto=format&fit=crop'],
    41,
    'available'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Whiskers',
    '3 years',
    'Siamese',
    'Talkative, intelligent, and loves being the center of attention.',
    'Downtown Cat Alliance',
    52.2370, 21.0170,
    'Vaccinated & Neutered',
    ARRAY['https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?w=900&auto=format&fit=crop'],
    19,
    'available'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Bella',
    '5 years',
    'Persian',
    'A calm lap cat who enjoys quiet afternoons and gentle brushing sessions.',
    'Persian Paws Rescue',
    52.2150, 21.0050,
    'Regular checkups',
    ARRAY['https://images.unsplash.com/photo-1574158622682-e40e69881006?w=900&auto=format&fit=crop'],
    52,
    'available'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Simba',
    NULL,
    'Orange Tabby',
    'Kitten full of energy! Loves laser pointers, cardboard boxes, and cuddles after playtime.',
    'Kitten Rescue Network',
    52.2450, 21.0300,
    'First shots done',
    ARRAY['https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=900&auto=format&fit=crop'],
    73,
    'available'
  );

-- Restore FK checks
SET session_replication_role = 'origin';
