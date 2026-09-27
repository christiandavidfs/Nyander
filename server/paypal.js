const axios = require('axios');

const PAYPAL_API =
  process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

let accessToken = null;
let tokenExpires = 0;

// Cache PayPal catalog to avoid creating product/plan per subscription
let cachedProductId = null;
const cachedPlans = new Map(); // key: `${amount}-${currency}` -> planId

function ensureConfigured() {
  if (!CLIENT_ID || !SECRET) {
    throw new Error('PayPal not configured: missing PAYPAL_CLIENT_ID and/or PAYPAL_SECRET');
  }
}

async function getAccessToken() {
  ensureConfigured();
  if (Date.now() < tokenExpires) return accessToken;

  const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
  const { data } = await axios.post(
    `${PAYPAL_API}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  accessToken = data.access_token;
  tokenExpires = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

async function createOrder({ amount, currency, description, metadata, returnUrl, cancelUrl }) {
  ensureConfigured();
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${PAYPAL_API}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: currency, value: amount.toFixed(2) },
          description,
          custom_id: JSON.stringify(metadata),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: returnUrl || `${process.env.BASE_URL}/api/paypal/return`,
            cancel_url: cancelUrl || `${process.env.BASE_URL}/api/paypal/cancel`,
            user_action: 'PAY_NOW',
          },
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return data;
}

async function captureOrder(orderId) {
  ensureConfigured();
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return data;
}

async function createSubscription({ amount, currency, description, metadata, returnUrl, cancelUrl }) {
  ensureConfigured();
  const token = await getAccessToken();

  // Reuse cached product
  let productId = cachedProductId;
  if (!productId) {
    try {
      const { data: product } = await axios.post(
        `${PAYPAL_API}/v1/catalogs/products`,
        {
          name: 'Nyander Sponsorship',
          description: 'Recurring sponsorship via Nyander',
          type: 'SERVICE',
          category: 'CHARITY',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': `product-nyander-${Date.now()}`,
          },
        }
      );
      productId = product.id;
      cachedProductId = productId;
    } catch (err) {
      const { data: products } = await axios.get(
        `${PAYPAL_API}/v1/catalogs/products`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { page_size: 10 },
        }
      );
      productId = products.products?.find((p) => p.name === 'Nyander Sponsorship')?.id
        || products.products?.[0]?.id;
      if (!productId) {
        throw new Error('Failed to create or find PayPal product: ' + (err.response?.data?.message || err.message));
      }
      cachedProductId = productId;
    }
  }

  // Reuse cached plan per amount/currency
  const planKey = `${amount.toFixed(2)}-${currency}`;
  let plan = cachedPlans.get(planKey) ? { id: cachedPlans.get(planKey) } : null;
  if (!plan) {
    try {
      const { data: p } = await axios.post(
        `${PAYPAL_API}/v1/billing/plans`,
        {
          product_id: productId,
          name: `Nyander ${amount.toFixed(2)} ${currency}/month`,
          description,
          billing_cycles: [
            {
              frequency: { interval_unit: 'MONTH', interval_count: 1 },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: { value: amount.toFixed(2), currency_code: currency },
              },
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: { value: '0.00', currency_code: currency },
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': `plan-${planKey}-${Date.now()}`,
          },
        }
      );
      plan = p;
      cachedPlans.set(planKey, plan.id);
    } catch (err) {
      const { data: plans } = await axios.get(
        `${PAYPAL_API}/v1/billing/plans`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { product_id: productId, page_size: 20 },
        }
      );
      const existing = plans.plans?.find((pl) => {
        const price = pl.billing_cycles?.[0]?.pricing_scheme?.fixed_price;
        return price?.value === amount.toFixed(2) && price?.currency_code === currency;
      });
      plan = existing || plans.plans?.[0];
      if (!plan) {
        throw new Error('Failed to create or find PayPal plan: ' + (err.response?.data?.message || err.message));
      }
      cachedPlans.set(planKey, plan.id);
    }
  }

  if (!plan?.id) {
    throw new Error('Failed to create or find PayPal plan');
  }

  // Create the subscription
  const { data: subscription } = await axios.post(
    `${PAYPAL_API}/v1/billing/subscriptions`,
    {
      plan_id: plan.id,
      start_time: new Date(Date.now() + 3600000).toISOString(),
      quantity: '1',
      custom_id: JSON.stringify(metadata),
      application_context: {
        brand_name: 'Nyander',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: { payer_selected: 'PAYPAL', payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED' },
        return_url: returnUrl || `${process.env.BASE_URL}/api/paypal/subscription-return`,
        cancel_url: cancelUrl || `${process.env.BASE_URL}/api/paypal/cancel`,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `sub-${Date.now()}`,
      },
    }
  );

  return subscription;
}

async function cancelSubscription(subscriptionId) {
  ensureConfigured();
  const token = await getAccessToken();
  await axios.post(
    `${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    { reason: 'Canceled by user' },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

async function sendPayout({ recipientEmail, amount, currency, note }) {
  ensureConfigured();
  const token = await getAccessToken();

  const senderBatchId = `payout-${Date.now()}`;

  const { data } = await axios.post(
    `${PAYPAL_API}/v1/payments/payouts`,
    {
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: 'Nyander Payment Received',
        email_message: `You received a payment of ${currency} ${amount.toFixed(2)} via Nyander.`,
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: { value: amount.toFixed(2), currency },
          receiver: recipientEmail,
          note: note || 'Thank you for using Nyander!',
          sender_item_id: `item-${Date.now()}`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': senderBatchId,
      },
    }
  );

  return data;
}

async function verifyWebhook({ headers, body }) {
  ensureConfigured();
  if (!WEBHOOK_ID) {
    console.error('PayPal webhook verification skipped: PAYPAL_WEBHOOK_ID not set');
    return true; // Skip verification if not configured
  }

  const token = await getAccessToken();

  const verification = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: WEBHOOK_ID,
    webhook_event: body,
  };

  const { data } = await axios.post(
    `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
    verification,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return data.verification_status === 'SUCCESS';
}

module.exports = {
  createOrder,
  captureOrder,
  createSubscription,
  cancelSubscription,
  sendPayout,
  verifyWebhook,
};
