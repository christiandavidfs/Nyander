#!/bin/bash
set -e

echo "Setting up Nyander for production..."

# Check environment
if [ ! -f .env ]; then
  echo "Error: .env file not found. Copy .env.example to .env and fill in your values."
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# Install server dependencies
echo "Installing server dependencies..."
cd server && npm install && cd ..

# Run database migrations
echo "Running database migrations..."
echo "NOTE: Run these SQL commands in your Supabase SQL Editor in order:"
echo "  1. supabase/migrations/001_initial_schema.sql"
echo "  2. supabase/migrations/002_production_fixes.sql"
echo "  3. supabase/migrations/003_paypal_migration.sql"
echo ""
read -p "Have you run all migrations? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Please run the migrations first!"
  exit 1
fi

# Build web
echo "Building web export..."
npx expo export --platform web --output-dir dist

echo "Production setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy backend (server/) to Render/Railway/Fly.io"
echo "2. Configure PayPal webhook in PayPal Developer Dashboard:"
echo "   - URL: https://your-server.com/webhooks/paypal"
echo "   - Events: CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED,"
echo "             BILLING.SUBSCRIPTION.*, PAYMENT.SALE.COMPLETED"
echo "3. Set server env vars: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_WEBHOOK_ID"
echo "4. Deploy web export (dist/) to Vercel/Netlify"
