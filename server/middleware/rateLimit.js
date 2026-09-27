const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().catch(console.error);

// General API rate limit
const apiLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// PayPal webhook rate limit (more lenient)
const webhookLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Allow more for webhooks
  message: { error: 'Webhook rate limit exceeded.' },
  skip: (req) => req.path !== '/webhooks/paypal',
});

module.exports = {
  apiLimiter,
  webhookLimiter,
  redisClient,
};
