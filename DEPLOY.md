# Quick Deploy Guide - Nyander Backend

Choose one of these free services to deploy your Nyander backend:

## Option 1: Render (Recommended for Beginners)

**Why Render?**
- Completely free tier (spins down after 15 min of inactivity)
- Auto-deploys from GitHub
- Free TLS/HTTPS
- Built-in health checks

**Steps:**

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/nyander.git
   git push -u origin main
   ```

2. **Create Render Web Service**
   - Go to [render.com](https://render.com) and sign up with GitHub
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Name: `nyander-api`
   - Runtime: `Node`
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
   - Plan: `Free`

3. **Add Environment Variables**
   In Render dashboard → Environment:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   PAYPAL_CLIENT_ID=your_paypal_client_id
   PAYPAL_SECRET=your_paypal_secret
   PAYPAL_SANDBOX=true
   PAYPAL_WEBHOOK_ID=your_webhook_id
   PLATFORM_FEE_PERCENT=10
   BASE_URL=https://nyander-api.onrender.com
   NODE_ENV=production
   PORT=3001
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait 2-3 minutes for build
   - Your API will be live at `https://nyander-api.onrender.com`

## Option 2: Railway

**Steps:**

1. **Push to GitHub** (same as above)

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app) and sign up with GitHub
   - Click "New Project" → "Deploy from GitHub"
   - Select your repo

3. **Configure Environment Variables**
   ```
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAYPAL_CLIENT_ID,
   PAYPAL_SECRET, PAYPAL_SANDBOX=true, PAYPAL_WEBHOOK_ID,
   PLATFORM_FEE_PERCENT=10, BASE_URL=https://nyander.up.railway.app
   ```

## Option 3: Fly.io

**Steps:**

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Launch App**
   ```bash
   cd server
   fly launch
   ```

3. **Set Secrets**
   ```bash
   fly secrets set SUPABASE_URL=...
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=...
   fly secrets set PAYPAL_CLIENT_ID=...
   fly secrets set PAYPAL_SECRET=...
   fly secrets set PAYPAL_WEBHOOK_ID=...
   fly secrets set PAYPAL_SANDBOX=true
   fly secrets set PLATFORM_FEE_PERCENT=10
   ```

## After Deployment: Connect Frontend

1. **Update Frontend API URL**
   In `.env`:
   ```
   EXPO_PUBLIC_API_URL=https://your-backend.onrender.com
   ```

2. **Test Health Endpoint**
   Visit: `https://your-backend.onrender.com/health`
   Should return: `{"status":"ok","service":"nyander-api",...}`

3. **Configure PayPal Webhooks**
   - Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
   - Click "Webhooks" → "Add Webhook"
   - URL: `https://your-backend.onrender.com/webhooks/paypal`
   - Events: Select all Billing Subscription events + Payment events
   - Copy the Webhook ID and add to your environment variables

## Expense Breakdown (Testing Phase)

| Service | Free Tier | When You'll Pay |
|---------|-----------|-----------------|
| Supabase | ✅ Free forever (500MB) | When you exceed 500k rows or 50k MAU |
| PayPal | ✅ Free (sandbox mode) | 2.99% + €0.30 per tx in production |
| Render | ✅ Free (spins down) | €7/month for always-on |
| Railway | ✅ $5 credit/month | ~€3/month after credits |
| Fly.io | ✅ 3 VMs free | ~€3/month if you need more |

**Total Cost: €0/month for testing**

## Next Steps

1. ✅ Create [Supabase](https://supabase.com) project (free)
2. ✅ Create [PayPal Developer](https://developer.paypal.com) account (free sandbox)
3. ✅ Deploy backend to Render/Railway/Fly.io
4. ✅ Update `.env` with real keys
5. ✅ Configure PayPal webhooks for local testing with ngrok
6. ✅ Test donations with PayPal sandbox buyer account

---

**Questions?** Open an issue or contact the team.
