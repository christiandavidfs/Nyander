# 🐱 CatAdoption - Tinder for Cats

A Tinder-like adoption platform for cats managed by shelters, NGOs, and individuals. Users can swipe, like, donate, and sponsor cats until they find their forever home.

## Features

- **User Authentication**: Email/password + Google OAuth (roles: Usuario/Centro)
- **Cat Profiles**: Photos, age, breed, health status, location
- **Proximity Matching**: MVP uses location-based matching (future: filters)
- **Like System**: Track interest in cats
- **Adoption Requests**: In-app messaging between users and shelters
- **Donations**: One-time donations to specific cats
- **Padrinazgo (Sponsorship)**: Recurring monthly sponsorships until adoption
- **Premium Shelter Plans**: €29-39/month subscription for shelters
- **Affiliate Integration**: Deep-linking referral codes for pet insurance/food/vet platforms
- **Notifications**: Emotional adoption notifications to drive repeat engagement
- **CSV Export**: Export cat data for shelters

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Expo SDK 56, React Native 0.85, TypeScript 6, React 19 |
| **Navigation** | Expo Router (file-based) + React Navigation |
| **Backend** | Supabase (PostgreSQL + Auth + Storage) |
| **Payments** | PayPal Checkout + Subscriptions + Payouts |
| **Server** | Node.js + Express (API + webhooks) |
| **Animations** | React Native Reanimated |
| **Typography** | SpaceMono (expo-font) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Expo)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Auth UI    │  │  Cat Feed    │  │  Monetization    │  │
│  │  (Login/     │  │  (Swipe/     │  │  (Donate/Sponsor)│  │
│  │   Register)  │  │   Cards)     │  │                   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│           │                 │                    │          │
│           └─────────────────┼────────────────────┘          │
│                             │                               │
└─────────────────────────────┼───────────────────────────────┘
                              │
              ┌───────────────▼────────────────┐
              │     SUPABASE (Backend)         │
              │  ┌──────────┐ ┌─────────────┐ │
              │  │   Auth   │ │ PostgreSQL  │ │
              │  │  Users,  │ │  Cats,      │ │
              │  │  Roles   │ │  Donations, │ │
              │  └──────────┘ │  Affiliates │ │
              │               └─────────────┘ │
              └───────────────────────────────┘
                              │
                              │ Webhooks
                              │
              ┌───────────────▼────────────────┐
               │     YOUR SERVER (Node.js)      │
               │  ┌──────────────────────────┐  │
               │  │  PayPal API              │  │
               │  │  - Orders (one-time)     │  │
               │  │  - Subscriptions         │  │
               │  │  - Payouts to shelters   │  │
               │  │  - Webhooks              │  │
               │  └──────────────────────────┘  │
               └───────────────────────────────┘
                               │
                               │
               ┌───────────────▼────────────────┐
               │          PAYPAL                 │
               │  ┌──────────────────────────┐  │
               │  │  Platform Account        │  │
               │  │  (Collects fees)         │  │
               │  └──────────────────────────┘  │
               │  ┌──────────────────────────┐  │
               │  │  Shelter Payouts         │  │
               │  │  (Sent to PayPal email)  │  │
               │  └──────────────────────────┘  │
               └───────────────────────────────┘
```

## Money Flow

### Donations (One-time)
```
Donor → PayPal Checkout → Platform receives payment
                ↓
    [Platform fee: 10% → stays with platform]
                ↓
    [PayPal Payout → Shelter PayPal email]
```

### Padrinazgo (Recurring Sponsorship)
```
Donor → PayPal Subscription → Monthly payments
                ↓
        Platform (10%) + Shelter (rest)
                ↓
        PayPal Payout to Shelter account
```

### Premium Shelter Plans
```
Shelter → PayPal Subscription → Platform (100%, no split)
                ↓
        Monthly recurring revenue
```

## Free Testing Setup (No Credit Card Needed)

### 1. Supabase (Free Tier - Forever)
- **URL**: https://supabase.com
- **Cost**: Free (500MB database, 50k monthly active users)
- **Setup**:
  1. Create account with GitHub
  2. Click "New Project"
  3. Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Project Settings → API
  4. Run the SQL migration in `server/migrations/001_monetization.sql` in SQL Editor
  5. Enable Auth providers (Email + Google)

### 2. PayPal Developer Account (Free)
- **URL**: https://developer.paypal.com/dashboard
- **Cost**: Free (sandbox mode)
- **Setup**:
  1. Log in with your PayPal account
  2. Go to **Dashboard → Apps & Credentials**
  3. Under **REST API apps**, create a new app (or use default)
  4. Copy `Client ID` and `Secret` (sandbox keys)
  5. Go to **Dashboard → Webhooks** → Add webhook endpoint:
     - URL: `https://your-server.com/webhooks/paypal`
     - Events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `BILLING.SUBSCRIPTION.*`, `PAYMENT.SALE.COMPLETED`
  6. Copy `Webhook ID`
  7. For sandbox testing, create sandbox test accounts in **Dashboard → Sandbox → Accounts**

### 3. Your Backend Server (Free Hosting Options)

| Service | Free Tier | Best For |
|---------|-----------|----------|
| **Railway** | $5 credit/month, then ~€3/month | Easiest, auto-deploy from Git |
| **Render** | Free web service (spins down after 15 min) | Zero cost, manual deploy |
| **Glitch** | Free (always on for small apps) | Quick prototyping |
| **Fly.io** | 3 VMs free | Fast global edge |

**Recommended**: Use Railway for testing because it's simple. Or Render if you want truly free hosting.

## Setup Instructions

### Prerequisites
```bash
Node.js 18+
Expo CLI
Git
```

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd Nyander
```

### 2. Frontend Setup
```bash
# Install dependencies
npm install --legacy-peer-deps

# Install expo-router
npx expo install expo-router

# Start development server
npm run web        # Web
npm run android    # Android
npm run ios        # iOS (requires Mac)
```

### 3. Supabase Setup
```bash
# 1. Create free project at supabase.com
# 2. Run migration SQL in Supabase SQL Editor:
cat server/migrations/001_monetization.sql
# 3. Copy credentials to .env:
```

### 4. Backend Server Setup
```bash
cd server
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase + Stripe keys

# Start server
npm run dev
# Or for production:
npm start
```

### 5. Expose Webhook Locally (for PayPal)
```bash
# Use ngrok to tunnel local server
ngrok http 3001
# Copy the ngrok URL (e.g. https://abc123.ngrok.io)

# Configure it as your webhook URL in PayPal Developer Dashboard:
# https://developer.paypal.com/dashboard/applications → Webhooks
# URL: https://abc123.ngrok.io/webhooks/paypal
```

## Environment Variables

### Frontend (`Nyander/.env`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3001
```

### Backend (`Nyander/server/.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret
PAYPAL_SANDBOX=true
PAYPAL_WEBHOOK_ID=your_webhook_id
PLATFORM_FEE_PERCENT=10
BASE_URL=http://localhost:3001
PORT=3001
```

## Testing the App

### 1. Create Test Shelter
```
1. Register in app → select "Shelter" role
2. Create a cat profile
3. Note the shelter ID
```

### 2. Create Test Donor
```
1. Register in app → select "User" role
2. Browse cats
3. Click "Donate" or "Sponsor"
```

### 3. PayPal Sandbox Testing
Use PayPal sandbox buyer accounts created at:
https://developer.paypal.com/dashboard → Sandbox → Accounts

Default sandbox card for testing:
```
Card: 4111 1111 1111 1111
Exp: any future date
CVC: any 3 digits
```

## ROI Model (Ethical Startup)

| Stage | Shelters | Monthly Flow | Platform Revenue | Infra Cost | Net |
|-------|----------|--------------|------------------|------------|-----|
| Early | 50 | €2,000 donations | €30 (donations) + €300 (affiliates) | €50 | ~€280 |
| Growth | 300 | €15,000 donations | €225 + €3,000 affiliates + €2,400 subscriptions | €200 | ~€5,400 |
| Scale | 1,500 | €80,000 donations | €1,200 + €15,000 + €16,000 | €3,000 | ~€29,000 |

**Key Insight**: Donations are the acquisition engine. Affiliates + subscriptions = profitability.

## Roadmap

### MVP (Current)
- ✅ Authentication (Email/Google)
- ✅ Cat listing with like system
- ✅ Basic adoption requests
- ✅ One-time donations (PayPal)
- ✅ Padrinazgo sponsorships (PayPal subscriptions)
- ✅ Shelter premium plans
- ✅ PayPal payouts to shelters

### Phase 2
- [ ] Proximity-based matching (GPS)
- [ ] Advanced filters (age, breed, health)
- [ ] In-app encrypted messaging
- [ ] Adoption progress tracking
- [ ] Email/SMS notifications

### Phase 3
- [ ] ML-powered cat-owner matching
- [ ] Virtual vet consultations affiliate
- [ ] Multi-language (ES/EN/PT)
- [ ] Shelter analytics dashboard
- [ ] Mobile app stores (iOS/Android)

## Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

## License

MIT - see LICENSE file

## Support

- **Issues**: https://github.com/your-username/Nyander/issues
- **Email**: support@catadoption.app

---

**Built with 🐾 for cats who are waiting for their forever homes.**
