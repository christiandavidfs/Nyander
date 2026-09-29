import type { UserProfile } from '@/types';

export const mockUser: UserProfile = {
  id: 'demo-user',
  email: 'demo@nyander.app',
  role: 'usuario',
  display_name: 'Alex Demo',
  phone: '+48 555 010 204',
  address: 'Warsaw, Poland',
  score: 86,
  latitude: null,
  longitude: null,
  paypal_email: null,
  website_url: null,
  avatar_url: null,
  country_code: null,
  created_at: '2026-06-01T08:00:00.000Z',
};

export const mockUserStats = {
  savedPets: 4,
  adoptionRequests: 2,
  approvedRequests: 1,
};
