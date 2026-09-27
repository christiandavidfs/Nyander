-- ============================================================================
-- Nyander — Seed Data
-- Run AFTER 000_super_schema.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- BACKFILL PROFILES FOR EXISTING AUTH USERS
-- (después de DROP TABLE profiles, los usuarios existentes pierden su fila)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO profiles (id, email, role, display_name)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'role', 'usuario'),
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- COUNTRIES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO countries (code, name, currency, tax_name, tax_rate, flag) VALUES
  ('US', 'United States', 'USD', 'Sales Tax', 8.00, '🇺🇸'),
  ('GB', 'United Kingdom', 'GBP', 'VAT', 20.00, '🇬🇧'),
  ('ES', 'Spain', 'EUR', 'IVA', 21.00, '🇪🇸'),
  ('MX', 'Mexico', 'MXN', 'IVA', 16.00, '🇲🇽'),
  ('CO', 'Colombia', 'COP', 'IVA', 19.00, '🇨🇴'),
  ('AR', 'Argentina', 'ARS', 'IVA', 21.00, '🇦🇷'),
  ('CL', 'Chile', 'CLP', 'IVA', 19.00, '🇨🇱'),
  ('PE', 'Peru', 'PEN', 'IGV', 18.00, '🇵🇪'),
  ('BR', 'Brazil', 'BRL', 'ICMS', 18.00, '🇧🇷'),
  ('DE', 'Germany', 'EUR', 'VAT', 19.00, '🇩🇪'),
  ('FR', 'France', 'EUR', 'TVA', 20.00, '🇫🇷'),
  ('IT', 'Italy', 'EUR', 'IVA', 22.00, '🇮🇹'),
  ('PT', 'Portugal', 'EUR', 'IVA', 23.00, '🇵🇹'),
  ('NL', 'Netherlands', 'EUR', 'VAT', 21.00, '🇳🇱'),
  ('PL', 'Poland', 'PLN', 'VAT', 23.00, '🇵🇱'),
  ('JP', 'Japan', 'JPY', 'Consumption Tax', 10.00, '🇯🇵'),
  ('AU', 'Australia', 'AUD', 'GST', 10.00, '🇦🇺'),
  ('CA', 'Canada', 'CAD', 'GST/HST', 13.00, '🇨🇦')
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- SPONSORS (mock businesses — no owner, visible for testing)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO sponsors (business_name, description, website_url, category, ranking, status, plan, amount, currency) VALUES
  ('PetsWorld', 'Everything for your pet at the best prices — food, toys, beds, and accessories.', 'https://petsworld.example.com', 'Pet Store', 100, 'active', 'yearly', 150.00, 'USD'),
  ('VetCare Clinic', 'Professional veterinary services with over 15 years of experience. Vaccinations, surgery, dental care.', 'https://vetcare.example.com', 'Veterinarian', 90, 'active', 'monthly', 15.00, 'USD'),
  ('Happy Paws Grooming', 'Expert grooming for cats and dogs. Bathing, haircuts, nail trimming, and spa treatments.', 'https://happypaws.example.com', 'Grooming', 75, 'active', 'monthly', 15.00, 'USD'),
  ('Catnip Toys', 'Handmade organic catnip toys that your feline friend will love. Eco-friendly materials.', 'https://catniptoys.example.com', 'Pet Store', 60, 'active', 'monthly', 15.00, 'USD'),
  ('Animal Wellness Center', 'Holistic and alternative treatments for pets. Acupuncture, massage, and nutritional counseling.', 'https://wellness.example.com', 'Veterinarian', 50, 'active', 'yearly', 150.00, 'USD'),
  ('PetTaxi Service', 'Safe and reliable pet transportation to vet appointments, grooming, or boarding.', 'https://pettaxi.example.com', 'Service', 40, 'active', 'monthly', 15.00, 'USD'),
  ('Furry Friends Boarding', 'Luxury cat boarding with individual suites, play areas, and 24/7 supervision.', 'https://furryboarding.example.com', 'Boarding', 30, 'trial', 'trial', NULL, 'USD'),
  ('AquaPets', 'Specialized aquarium and fish supplies. Tanks, filters, food, and live fish delivery.', 'https://aquapets.example.com', 'Pet Store', 20, 'active', 'yearly', 150.00, 'USD')
ON CONFLICT DO NOTHING;

-- Sopot shelter location (update demo shelter to PL)
UPDATE profiles SET country_code='PL', latitude=54.4418, longitude=18.5601, display_name='Schronisko Sopot', address='Sopot, Poland' WHERE id='352fd298-61ec-4c1f-9f1a-7018dfec439f';
UPDATE profiles SET country_code='PL', latitude=54.4418, longitude=18.5601 WHERE id='3b98206f-c4ed-4da5-9267-ce95d4d8339b';

-- Mock cats around Sopot/Gdańsk spread at 0-115km to test distance filters 1/5/10/25/50/100/200km
INSERT INTO cats (id, shelter_id, name, age, breed, description, location, latitude, longitude, health_status, image_urls, video_urls, temperament, likes, status, country_code) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '352fd298-61ec-4c1f-9f1a-7018dfec439f', 'Mruczek', '2 years', 'European Shorthair', 'Friendly and cuddly, loves laps and windows.', 'Sopot, ul. Bohaterów Monte Cassino — 0.1km', 54.4418, 18.5601, 'Healthy', ARRAY['https://cdn2.thecatapi.com/images/bpc.jpg'], '{}', '{"friendly":5,"calm":4,"playful":3}'::jsonb, 12, 'available', 'PL'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '352fd298-61ec-4c1f-9f1a-7018dfec439f', 'Misia', '5 years', 'Siberian', 'Gentle giant, calm, loves quiet homes.', 'Sopot, Molo — 0.7km', 54.4400, 18.5705, 'Healthy', ARRAY['https://cdn2.thecatapi.com/images/MjA4NjEzNg.jpg'], '{}', '{"calm":5,"friendly":4,"cuddly":4}'::jsonb, 15, 'available', 'PL'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '352fd298-61ec-4c1f-9f1a-7018dfec439f', 'Kropka', '3 years', 'British Shorthair', 'Calm and independent, perfect for apartment.', 'Sopot, Kamienny Potok — 2.5km', 54.4550, 18.5850, 'Healthy', ARRAY['https://cdn2.thecatapi.com/images/bpc1.jpg'], '{}', '{"calm":5,"independent":4,"friendly":3}'::jsonb, 8, 'available', 'PL'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', '352fd298-61ec-4c1f-9f1a-7018dfec439f', 'Zoja', '8 months', 'Scottish Fold', 'Sweet, sociable, loves toys.', 'Gdynia Orłowo — 8km', 54.5100, 18.5300, 'Healthy', ARRAY['https://cdn2.thecatapi.com/images/3PjUma8B4.jpg'], '{}', '{"sociable":5,"playful":4,"friendly":4}'::jsonb, 22, 'available', 'PL'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '352fd298-61ec-4c1f-9f1a-7018dfec439f', 'Luna', '1 year', 'Maine Coon', 'Playful, very sociable, great with kids.', 'Wejherowo — 18km', 54.6000, 18.6500, 'Healthy', ARRAY['https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg'], '{}', '{"playful":5,"sociable":5,"friendly":4}'::jsonb, 24, 'available', 'PL'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '352fd298-61ec-4c1f-9f1a-7018dfec439f', 'Burek', '4 months', 'Ragdoll', 'Kitten, super cuddly, needs attention.', 'Tczew — 32km', 54.0900, 18.7900, 'Healthy', ARRAY['https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg'], '{}', '{"cuddly":5,"playful":5}'::jsonb, 31, 'available', 'PL'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', '352fd298-61ec-4c1f-9f1a-7018dfec439f', 'Felix', '2.5 years', 'Bengal', 'Energetic and playful, needs space.', 'Grudziądz area — 62km', 53.9000, 18.6000, 'Healthy', ARRAY['https://cdn2.thecatapi.com/images/aax.jpg'], '{}', '{"playful":5,"independent":3}'::jsonb, 19, 'available', 'PL'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', '352fd298-61ec-4c1f-9f1a-7018dfec439f', 'Tygrys', '6 years', 'European Shorthair', 'Independent but loyal, calm companion.', 'Bydgoszcz — 115km', 53.4300, 18.0000, 'Healthy', ARRAY['https://cdn2.thecatapi.com/images/5iYq9NmT1.jpg'], '{}', '{"independent":5,"calm":4}'::jsonb, 9, 'available', 'PL')
ON CONFLICT (id) DO NOTHING;
