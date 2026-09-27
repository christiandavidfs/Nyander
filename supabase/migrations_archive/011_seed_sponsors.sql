-- Seed mock sponsors for testing
INSERT INTO sponsors (business_name, description, website_url, category, ranking, status, plan, amount, currency)
VALUES
  ('PetsWorld', 'Everything for your pet at the best prices — food, toys, beds, and accessories.', 'https://petsworld.example.com', 'Pet Store', 100, 'active', 'monthly', 49.99, 'USD'),
  ('VetCare Clinic', 'Professional veterinary services with over 15 years of experience. Vaccinations, surgery, dental care.', 'https://vetcare.example.com', 'Veterinarian', 90, 'active', 'one_time', 199.00, 'USD'),
  ('Happy Paws Grooming', 'Expert grooming for cats and dogs. Bathing, haircuts, nail trimming, and spa treatments.', 'https://happypaws.example.com', 'Grooming', 75, 'active', 'monthly', 29.99, 'USD'),
  ('Catnip Toys', 'Handmade organic catnip toys that your feline friend will love. Eco-friendly materials.', 'https://catniptoys.example.com', 'Pet Store', 60, 'active', 'monthly', 19.99, 'USD'),
  ('Animal Wellness Center', 'Holistic and alternative treatments for pets. Acupuncture, massage, and nutritional counseling.', 'https://wellness.example.com', 'Veterinarian', 50, 'active', 'one_time', 150.00, 'USD'),
  ('PetTaxi Service', 'Safe and reliable pet transportation to vet appointments, grooming, or boarding.', 'https://pettaxi.example.com', 'Service', 40, 'active', 'monthly', 39.99, 'USD'),
  ('Furry Friends Boarding', 'Luxury cat boarding with individual suites, play areas, and 24/7 supervision.', 'https://furryboarding.example.com', 'Boarding', 30, 'trial', 'trial', NULL, 'USD'),
  ('AquaPets', 'Specialized aquarium and fish supplies. Tanks, filters, food, and live fish delivery.', 'https://aquapets.example.com', 'Pet Store', 20, 'active', 'one_time', 89.00, 'USD')
ON CONFLICT DO NOTHING;
