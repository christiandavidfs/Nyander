require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const paypal = require('./paypal');

const app = express();
const PORT = process.env.PORT || 3001;

// Validate critical env vars at startup
const MISSING = [];
if (!process.env.SUPABASE_URL) MISSING.push('SUPABASE_URL');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) MISSING.push('SUPABASE_SERVICE_ROLE_KEY');
if (!process.env.PAYPAL_CLIENT_ID) MISSING.push('PAYPAL_CLIENT_ID');
if (!process.env.PAYPAL_SECRET) MISSING.push('PAYPAL_SECRET');
if (MISSING.length > 0) {
  console.warn(`WARNING: Missing env vars: ${MISSING.join(', ')}`);
  console.warn('The server will start but PayPal features will fail.');
}

if (!process.env.BASE_URL) {
  console.warn('WARNING: BASE_URL not set. PayPal return URLs may be incorrect.');
}

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key'
);

// Apply CORS before body parsers
app.use(cors({ origin: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
// IMPORTANT: express.raw() for webhook MUST come before express.json()
// so the raw body is available for PayPal webhook signature verification.
app.use('/webhooks/paypal', express.raw({ type: 'application/json' }));
app.use(express.json());

const PLATFORM_FEE_PERCENT_RAW = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');
const PLATFORM_FEE_PERCENT = Number.isFinite(PLATFORM_FEE_PERCENT_RAW) ? PLATFORM_FEE_PERCENT_RAW : 10;

async function isDemoUser(userId) {
  if (!userId) return false;
  try {
    const { data } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
    const email = data?.email || '';
    return email.endsWith('.demo@nyander.app') || email.includes('demo@nyander.app');
  } catch (_) { return false; }
}
async function isDemoSponsor(sponsorId) {
  if (!sponsorId) return false;
  try {
    const { data: s } = await supabase.from('sponsors').select('owner_id').eq('id', sponsorId).maybeSingle();
    if (!s?.owner_id) return false;
    return await isDemoUser(s.owner_id);
  } catch (_) { return false; }
}

// ============================================================================
// Health check
// ============================================================================
app.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    service: 'nyander-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
);

// ============================================================================
// PayPal return / cancel pages (user lands here after PayPal approval)
// ============================================================================
app.get('/api/paypal/return', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.send(successPage('Missing payment token', false));
    }

    const captured = await paypal.captureOrder(token);
    const status = captured.status;

    if (status === 'COMPLETED') {
      const purchaseUnit = captured.purchase_units?.[0];
      const metadata = JSON.parse(purchaseUnit?.custom_id || '{}');
      const amount = parseFloat(purchaseUnit?.payments?.captures?.[0]?.amount?.value || '0');

      await supabase
        .from('donations')
        .update({ status: 'completed', completed_at: new Date() })
        .eq('paypal_order_id', captured.id);

      if (metadata.shelterId && amount > 0) {
        await supabase.rpc('increment_shelter_earnings', {
          shelter_id: metadata.shelterId,
          amount,
        });
      }

      const shelterEmail = await getShelterPaypalEmail(metadata.shelterId);
      if (shelterEmail) {
        const fee = amount * (PLATFORM_FEE_PERCENT / 100);
        const shelterAmount = amount - fee;
        try {
          const payout = await paypal.sendPayout({
            recipientEmail: shelterEmail,
            amount: shelterAmount,
            currency: purchaseUnit?.payments?.captures?.[0]?.amount?.currency_code || 'EUR',
            note: `Donation received via Nyander (${PLATFORM_FEE_PERCENT}% platform fee)`,
          });
          await supabase
            .from('donations')
            .update({
              payout_status: 'completed',
              payout_id: payout.batch_header?.payout_batch_id,
              platform_fee: fee,
            })
            .eq('paypal_order_id', captured.id);
        } catch (payoutErr) {
          console.error('Payout failed, will retry:', payoutErr.message);
          await supabase
            .from('donations')
            .update({ payout_status: 'failed' })
            .eq('paypal_order_id', captured.id);
        }
      }

      return res.send(successPage('Donation successful! Thank you for your support.', true));
    }

    return res.send(successPage('Payment not completed', false));
  } catch (error) {
    console.error('Return handler error:', error);
    res.send(successPage('Payment processing error', false));
  }
});

app.get('/api/paypal/subscription-return', async (req, res) => {
  try {
    const { subscription_id } = req.query;
    if (!subscription_id) {
      return res.send(successPage('Missing subscription ID', false));
    }

    await supabase
      .from('sponsorships')
      .update({ status: 'active' })
      .eq('paypal_subscription_id', subscription_id);

    res.send(
      successPage(
        'Sponsorship activated! You will be charged monthly. Thank you!',
        true
      )
    );
  } catch (error) {
    console.error('Subscription return error:', error);
    res.send(successPage('Subscription activation error', false));
  }
});

app.get('/api/paypal/cancel', (req, res) => {
  res.send(infoPage('Payment canceled. No charges were made.'));
});

// ============================================================================
// Create PayPal order for one-time donation
// ============================================================================
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { catId, shelterId, amount, currency = 'EUR', userId } = req.body;

    if (!catId || !shelterId || !amount) {
      return res.status(400).json({ error: 'Missing required fields: catId, shelterId, amount' });
    }

    // Dummy payment for demo users — no PayPal call
    if (userId && await isDemoUser(userId)) {
      const mockId = `MOCK-ORDER-${Date.now()}`;
      await supabase.from('donations').insert({
        cat_id: catId,
        shelter_id: shelterId,
        donor_id: userId,
        amount,
        currency,
        paypal_order_id: mockId,
        status: 'completed',
        completed_at: new Date().toISOString(),
        platform_fee: 0,
        payout_status: 'pending',
      });
      if (amount > 0) {
        await supabase.rpc('increment_shelter_earnings', { shelter_id: shelterId, amount: parseFloat(amount) });
      }
      return res.json({ mock: true, success: true, orderID: mockId });
    }

    const order = await paypal.createOrder({
      amount,
      currency,
      description: `Donation for ${catId}`,
      metadata: { catId, shelterId, type: 'donation' },
    });

    await supabase.from('donations').insert({
      cat_id: catId,
      shelter_id: shelterId,
      donor_id: userId || null,
      amount,
      currency,
      paypal_order_id: order.id,
      status: 'pending',
      platform_fee: 0,
      payout_status: 'pending',
    });

    const approvalUrl = order.links?.find((l) => l.rel === 'payer-action')?.href
      || order.links?.find((l) => l.rel === 'approve')?.href;

    res.json({ orderID: order.id, approval_url: approvalUrl });
  } catch (error) {
    console.error('Error creating order:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Capture PayPal order (called manually if needed)
// ============================================================================
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    const capture = await paypal.captureOrder(orderId);
    res.json(capture);
  } catch (error) {
    console.error('Error capturing order:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Create PayPal subscription for recurring sponsorship
// ============================================================================
app.post('/api/paypal/create-subscription', async (req, res) => {
  try {
    const { catId, shelterId, amount, currency = 'EUR', userId } = req.body;

    if (!catId || !shelterId || !amount) {
      return res.status(400).json({ error: 'Missing required fields: catId, shelterId, amount' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    if (await isDemoUser(userId)) {
      const mockId = `MOCK-SUB-${Date.now()}`;
      await supabase.from('sponsorships').insert({
        cat_id: catId,
        user_id: userId,
        shelter_id: shelterId,
        paypal_subscription_id: mockId,
        amount,
        interval: 'month',
        currency,
        status: 'active',
      });
      await supabase.rpc('increment_shelter_earnings', { shelter_id: shelterId, amount: parseFloat(amount) });
      return res.json({ mock: true, success: true, subscriptionID: mockId });
    }

    const subscription = await paypal.createSubscription({
      amount,
      currency,
      description: `Sponsorship for ${catId}`,
      metadata: { catId, shelterId, type: 'sponsorship' },
    });

    await supabase.from('sponsorships').insert({
      cat_id: catId,
      user_id: userId,
      shelter_id: shelterId,
      paypal_subscription_id: subscription.id,
      amount,
      interval: 'month',
      currency,
      status: 'pending',
    });

    const approvalUrl = subscription.links?.find((l) => l.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new Error('No approval URL in PayPal response');
    }

    res.json({ subscriptionID: subscription.id, approval_url: approvalUrl });
  } catch (error) {
    console.error('Error creating subscription:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Cancel subscription
// ============================================================================
app.post('/api/paypal/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Missing subscriptionId' });
    }

    await paypal.cancelSubscription(subscriptionId);

    await supabase
      .from('sponsorships')
      .update({ status: 'canceled', canceled_at: new Date() })
      .eq('paypal_subscription_id', subscriptionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling subscription:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Create PayPal order for sponsor yearly payment
// ============================================================================
app.post('/api/paypal/create-sponsor-order', async (req, res) => {
  try {
    const { sponsorId, amount, currency = 'USD' } = req.body;

    if (!sponsorId || !amount) {
      return res.status(400).json({ error: 'Missing required fields: sponsorId, amount' });
    }

    if (await isDemoSponsor(sponsorId)) {
      const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await supabase.from('sponsors').update({ status: 'active', started_at: new Date().toISOString(), expires_at: expiresAt.toISOString(), paypal_order_id: `MOCK-SPONSOR-ORDER-${Date.now()}` }).eq('id', sponsorId);
      return res.json({ mock: true, success: true });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const order = await paypal.createOrder({
      amount,
      currency,
      description: `Sponsor listing yearly subscription`,
      metadata: { sponsorId, type: 'sponsor_listing' },
      returnUrl: `${baseUrl}/api/paypal/sponsor-return`,
      cancelUrl: `${baseUrl}/api/paypal/cancel`,
    });

    await supabase.from('sponsors').update({ paypal_order_id: order.id }).eq('id', sponsorId);

    const approvalUrl = order.links?.find((l) => l.rel === 'payer-action')?.href
      || order.links?.find((l) => l.rel === 'approve')?.href;

    res.json({ orderID: order.id, approval_url: approvalUrl });
  } catch (error) {
    console.error('Error creating sponsor order:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Create PayPal subscription for sponsor monthly payment
// ============================================================================
app.post('/api/paypal/create-sponsor-subscription', async (req, res) => {
  try {
    const { sponsorId, amount, currency = 'USD' } = req.body;

    if (!sponsorId || !amount) {
      return res.status(400).json({ error: 'Missing required fields: sponsorId, amount' });
    }

    if (await isDemoSponsor(sponsorId)) {
      await supabase.from('sponsors').update({ status: 'active', started_at: new Date().toISOString(), paypal_subscription_id: `MOCK-SPONSOR-SUB-${Date.now()}` }).eq('id', sponsorId);
      return res.json({ mock: true, success: true });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const subscription = await paypal.createSubscription({
      amount,
      currency,
      description: `Sponsor listing monthly`,
      metadata: { sponsorId, type: 'sponsor_listing' },
      returnUrl: `${baseUrl}/api/paypal/sponsor-subscription-return`,
      cancelUrl: `${baseUrl}/api/paypal/cancel`,
    });

    await supabase.from('sponsors').update({ paypal_subscription_id: subscription.id }).eq('id', sponsorId);

    const approvalUrl = subscription.links?.find((l) => l.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new Error('No approval URL in PayPal response');
    }

    res.json({ subscriptionID: subscription.id, approval_url: approvalUrl });
  } catch (error) {
    console.error('Error creating sponsor subscription:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Sponsor return — after one-time PayPal payment
// ============================================================================
app.get('/api/paypal/sponsor-return', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.send(infoPage('Sponsor payment could not be verified.'));
    }

    const capture = await paypal.captureOrder(token);

    const paypalOrderId = capture.id;

    // Find sponsor by order_id
    const { data: sponsor } = await supabase
      .from('sponsors')
      .select('id')
      .eq('paypal_order_id', paypalOrderId)
      .single();

    if (sponsor) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await supabase
        .from('sponsors')
        .update({
          status: 'active',
          started_at: new Date(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', sponsor.id);
    }

    res.send(successPage('Sponsor payment successful! Your listing is now active.'));
  } catch (error) {
    console.error('Sponsor return error:', error.response?.data || error.message);
    res.send(infoPage('Sponsor payment completed, but there was a verification issue. Contact support.'));
  }
});

// ============================================================================
// Sponsor return — after PayPal subscription approval
// ============================================================================
app.get('/api/paypal/sponsor-subscription-return', async (req, res) => {
  try {
    const { subscription_id } = req.query;
    if (!subscription_id) {
      return res.send(infoPage('Sponsor subscription could not be verified.'));
    }

    const { data: sponsor } = await supabase
      .from('sponsors')
      .select('id')
      .eq('paypal_subscription_id', subscription_id)
      .single();

    if (sponsor) {
      await supabase
        .from('sponsors')
        .update({
          status: 'active',
          started_at: new Date(),
        })
        .eq('id', sponsor.id);
    }

    res.send(successPage('Sponsor subscription active! Your listing is now live.'));
  } catch (error) {
    console.error('Sponsor subscription return error:', error.response?.data || error.message);
    res.send(infoPage('Sponsor subscription completed, but there was a verification issue. Contact support.'));
  }
});

// Webhook idempotency: in-memory set (use DB table for multi-instance)
const processedEvents = new Set();

// ============================================================================
// PayPal webhook handler (raw body MUST be available for signature verification)
// ============================================================================
app.post('/webhooks/paypal', async (req, res) => {
  try {
    const rawBody = req.body.toString();
    const event = JSON.parse(rawBody);

    if (event.id && processedEvents.has(event.id)) {
      return res.json({ received: true, deduplicated: true });
    }

    const isValid = await paypal.verifyWebhook({
      headers: req.headers,
      body: event,
    });

    if (!isValid) {
      console.error('Webhook verification failed');
      return res.status(400).send('Webhook verification failed');
    }

    if (event.id) processedEvents.add(event.id);

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCapture(event);
        break;
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;
      case 'PAYMENT.SALE.COMPLETED':
        await handleSaleCompleted(event);
        break;
      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
      case 'PAYMENT.PAYOUTS-ITEM.FAILED':
      case 'PAYMENT.PAYOUTS-ITEM.BLOCKED':
        await handlePayoutItem(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.event_type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Track affiliate click
// ============================================================================
app.post('/api/track-affiliate-click', async (req, res) => {
  try {
    const { catId, affiliateId, referralCode, timestamp, userAgent } = req.body;

    await supabase.from('affiliate_clicks').insert({
      cat_id: catId,
      affiliate_id: affiliateId,
      referral_code: referralCode,
      timestamp: new Date(timestamp),
      user_agent: userAgent,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking affiliate click:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Webhook handlers
// ============================================================================

async function handlePaymentCapture(event) {
  const resource = event.resource;
  const customId = resource.custom_id;

  if (!customId) return;

  let metadata;
  try { metadata = JSON.parse(customId); } catch (_) { return; }

  // capture ID vs order ID: try supplementary_data first
  const orderId = resource.supplementary_data?.related_ids?.order_id || resource.id;
  const captureId = resource.id;

  if (metadata.type === 'donation') {
    // Idempotency: skip if already completed
    const { data: existing } = await supabase.from('donations').select('status').or(`paypal_order_id.eq.${orderId},paypal_order_id.eq.${captureId}`).maybeSingle();
    if (existing?.status === 'completed') return;

    const { error: updErr } = await supabase
      .from('donations')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .or(`paypal_order_id.eq.${orderId},paypal_order_id.eq.${captureId}`);
    if (updErr) console.error('Donation update failed:', updErr.message);

    if (metadata.shelterId) {
      const amount = parseFloat(resource.amount?.value || '0');
      if (Number.isFinite(amount) && amount > 0) {
        // Check donation not already counted by seeing if status was pending before
        if (!existing || existing.status !== 'completed') {
          await supabase.rpc('increment_shelter_earnings', {
            shelter_id: metadata.shelterId,
            amount,
          });
        }
      }
      const shelterEmail = await getShelterPaypalEmail(metadata.shelterId);
      if (shelterEmail) {
        const feeRaw = amount * (PLATFORM_FEE_PERCENT / 100);
        const fee = Number.isFinite(feeRaw) ? feeRaw : 0;
        const shelterAmount = Number.isFinite(amount - fee) ? amount - fee : amount;
        if (shelterAmount > 0) {
          try {
            const payout = await paypal.sendPayout({
              recipientEmail: shelterEmail,
              amount: shelterAmount,
              currency: resource.amount?.currency_code || 'EUR',
              note: `Donation via Nyander (${PLATFORM_FEE_PERCENT}% platform fee deducted)`,
            });
            await supabase
              .from('donations')
              .update({
                payout_status: 'completed',
                payout_id: payout.batch_header?.payout_batch_id,
                platform_fee: fee,
              })
              .or(`paypal_order_id.eq.${orderId},paypal_order_id.eq.${captureId}`);
          } catch (err) {
            console.error('Payout failed:', err.message);
          }
        }
      }
    }
  } else if (metadata.type === 'sponsor_listing') {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await supabase
      .from('sponsors')
      .update({ status: 'active', started_at: new Date().toISOString(), expires_at: expiresAt.toISOString() })
      .eq('id', metadata.sponsorId);
  }
}

async function handleSubscriptionActivated(event) {
  const resource = event.resource;
  // Try sponsorships first (cat sponsorship)
  const { data: sponsorship } = await supabase
    .from('sponsorships')
    .select('id')
    .eq('paypal_subscription_id', resource.id)
    .maybeSingle();

  if (sponsorship) {
    await supabase
      .from('sponsorships')
      .update({ status: 'active' })
      .eq('paypal_subscription_id', resource.id);
  } else {
    // Sponsor listing
    await supabase
      .from('sponsors')
      .update({ status: 'active', started_at: new Date() })
      .eq('paypal_subscription_id', resource.id);
  }
}

async function handleSubscriptionCancelled(event) {
  const resource = event.resource;
  const { data: sponsorship } = await supabase
    .from('sponsorships')
    .select('id')
    .eq('paypal_subscription_id', resource.id)
    .maybeSingle();

  if (sponsorship) {
    await supabase
      .from('sponsorships')
      .update({ status: 'canceled', canceled_at: new Date() })
      .eq('paypal_subscription_id', resource.id);
  } else {
    await supabase
      .from('sponsors')
      .update({ status: 'expired' })
      .eq('paypal_subscription_id', resource.id);
  }
}

async function handleSaleCompleted(event) {
  const resource = event.resource;
  const billingAgreementId = resource.billing_agreement_id;

  if (!billingAgreementId) return;

  const { data: sponsorship } = await supabase
    .from('sponsorships')
    .select('shelter_id, payment_count')
    .eq('paypal_subscription_id', billingAgreementId)
    .maybeSingle();

  if (sponsorship?.shelter_id) {
    const amt = parseFloat(resource.amount?.total || '0');
    if (Number.isFinite(amt) && amt > 0) {
      await supabase.rpc('increment_shelter_earnings', {
        shelter_id: sponsorship.shelter_id,
        amount: amt,
      });
    }
    await supabase
      .from('sponsorships')
      .update({
        last_payment_at: new Date().toISOString(),
        payment_count: (sponsorship.payment_count || 0) + 1,
      })
      .eq('paypal_subscription_id', billingAgreementId);

    await supabase.from('notifications').insert({
      user_id: sponsorship.shelter_id,
      type: 'sponsorship_payment',
      message: 'New monthly sponsorship payment received!',
    });
  }
}

async function handlePayoutItem(event) {
  const r = event.resource;
  const batchId = r.payout_batch_id || r.sender_batch_id;
  const status = event.event_type.includes('SUCCEEDED') ? 'completed' : 'failed';
  if (!batchId) return;
  await supabase.from('donations').update({ payout_status: status }).eq('payout_id', batchId);
  await supabase.from('sponsorships').update({ payout_status: status }).eq('payout_id', batchId);
}

// ============================================================================
// Helpers
// ============================================================================

async function getShelterPaypalEmail(shelterId) {
  if (!shelterId) return null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('paypal_email')
      .eq('id', shelterId)
      .single();
    return data?.paypal_email || null;
  } catch (err) {
    console.error('Error fetching shelter PayPal email:', err.message);
    return null;
  }
}

function successPage(message, isSuccess) {
  const icon = isSuccess ? '&#9989;' : '&#9888;';
  const color = isSuccess ? '#34c759' : '#ff9500';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nyander - Payment</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f7;color:#1d1d1f}.card{text-align:center;padding:48px 32px;background:white;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:400px}.icon{font-size:64px;margin-bottom:16px}h1{font-size:24px;margin:0 0 8px}p{font-size:16px;color:#86868b;margin:0 0 24px;line-height:1.5}.btn{display:inline-block;padding:12px 32px;background:${color};color:white;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px}.btn:hover{opacity:0.9}</style>
</head>
<body><div class="card"><div class="icon">${icon}</div><h1>${isSuccess ? 'Payment Successful!' : 'Payment Issue'}</h1><p>${message}</p><a class="btn" href="javascript:window.close()">Close this tab</a></div></body></html>`;
}

function infoPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nyander</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f7;color:#1d1d1f}.card{text-align:center;padding:48px 32px;background:white;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:400px}.icon{font-size:64px;margin-bottom:16px}h1{font-size:24px;margin:0 0 8px}p{font-size:16px;color:#86868b;margin:0 0 24px}.btn{display:inline-block;padding:12px 32px;background:#007aff;color:white;text-decoration:none;border-radius:12px;font-weight:600}.btn:hover{opacity:0.9}</style>
</head>
<body><div class="card"><div class="icon">&#8505;</div><h1>Payment Canceled</h1><p>${message}</p><a class="btn" href="javascript:window.close()">Close this tab</a></div></body></html>`;
}

app.listen(PORT, () => {
  console.log(`Nyander API running on port ${PORT}`);
  if (MISSING.length > 0) {
    console.log(`Missing env vars: ${MISSING.join(', ')}. PayPal endpoints will return 500 errors.`);
  }
});
