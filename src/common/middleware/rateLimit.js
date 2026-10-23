import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis, redisCommand, redisReady } from '../redis/redis.js';

// Shared counters when Redis is configured *and* ready; otherwise in-memory.
const store = (prefix) => {
  if (!redis || !redisReady()) return undefined;
  return new RedisStore({ prefix, sendCommand: redisCommand });
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: store('rl:api:'),
  passOnStoreError: true,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests' },
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: store('rl:auth:'),
  passOnStoreError: true,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' },
  },
});

/**
 * POST /orders — 20 placements per hour per authenticated user.
 */
export const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  store: store('rl:orders:'),
  passOnStoreError: true,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many order attempts. Try again later.' },
  },
});