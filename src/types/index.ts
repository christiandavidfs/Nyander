export type Cat = {
  id: string
  name: string
  age: string | null
  breed: string | null
  description: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  distance_km?: number | null
  health_status: string | null
  image_urls: string[]
  video_urls?: string[]
  temperament?: Record<string, number> | null
  likes: number
  status: 'available' | 'adopted' | 'pending'
  shelter_id: string
  country_code: string | null
  created_at: string
}

export type Country = {
  code: string
  name: string
  currency: string
  tax_name: string | null
  tax_rate: number
  flag: string | null
}

export type UserProfile = {
  id: string
  email: string
  role: 'usuario' | 'centro' | 'sponsor'
  display_name: string | null
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  score: number
  paypal_email: string | null
  avatar_url: string | null
  country_code: string | null
  created_at: string
}

export type Like = {
  id: string
  cat_id: string
  user_id: string
  created_at: string
}

export type AdoptionRequest = {
  id: string
  cat_id: string
  user_id: string
  shelter_id: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  message: string | null
  notes: string | null
  created_at: string
}

export type Donation = {
  id: string
  cat_id: string
  shelter_id: string
  donor_id: string | null
  amount: number
  currency: string
  paypal_order_id: string
  status: 'pending' | 'completed' | 'failed'
  platform_fee: number
  payout_status: 'pending' | 'completed' | 'failed'
  payout_id: string | null
  completed_at: string | null
  created_at: string
}

export type Conversation = {
  id: string
  cat_id: string
  adopter_id: string
  shelter_id: string
  last_message_at: string | null
  created_at: string
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export type Sponsorship = {
  id: string
  cat_id: string
  user_id: string
  shelter_id: string
  paypal_subscription_id: string
  amount: number
  interval: string
  currency: string
  status: 'pending' | 'active' | 'canceled'
  last_payment_at: string | null
  payment_count: number
  canceled_at: string | null
  created_at: string
}

export type Sponsor = {
  id: string
  business_name: string
  description: string | null
  website_url: string | null
  logo_url: string | null
  category: string | null
  phone: string | null
  address: string | null
  email: string | null
  ranking: number
  user_id: string | null
  owner_id: string | null
  country_code: string | null
  status: 'pending' | 'active' | 'expired' | 'trial'
  plan: 'trial' | 'monthly' | 'yearly' | null
  trial_ends_at: string | null
  paypal_subscription_id: string | null
  paypal_order_id: string | null
  amount: number | null
  currency: string
  started_at: string | null
  expires_at: string | null
  created_at: string
}

export type SponsorClick = {
  id: string
  sponsor_id: string
  clicked_at: string
}

export type SponsorInvoice = {
  id: string
  sponsor_id: string
  amount: number
  currency: string
  tax_amount: number
  tax_rate: number
  country_code: string | null
  paypal_transaction_id: string | null
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  period_start: string | null
  period_end: string | null
  created_at: string
}

export type Campaign = {
  id: string
  shelter_id: string
  title: string
  description: string | null
  goal_amount: number
  raised_amount: number
  image_url: string | null
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
}
