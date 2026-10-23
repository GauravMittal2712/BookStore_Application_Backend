import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../logger.js';

// null when REDIS_URL is not set: every caller must treat Redis as optional.
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    })
  : null;

let reportedDown = false;
if (redis) {
  redis.on('ready', () => {
    everReady = true;
    reportedDown = false;
    logger.info('Redis ready');
  });
  redis.on('error', (err) => {
    if (reportedDown) return; // do not spam the log on every reconnect attempt
    reportedDown = true;
    logger.warn({ err: err.message }, 'Redis unavailable - cache bypassed, will keep retrying');
  });
}

// Commands queue until the first connection (so start-up work like loading Lua scripts succeeds);
// after that, while Redis is down, callers get an immediate error instead of waiting for a retry.
let everReady = false;
export function redisCommand(...args) {
  if (everReady && !redisReady()) return Promise.reject(new Error('Redis unavailable'));
  return redis.call(...args);
}

export const redisEnabled = () => !!redis;
export const redisReady = () => !!redis && redis.status === 'ready';

export async function connectRedis(timeoutMs = 5000) {
  if (!redis) {
    logger.info('REDIS_URL not set - caching disabled, rate limits are in-memory');
    return;
  }
  if (redis.status === 'ready') return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    redis.once('ready', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (!redisReady()) logger.warn('Redis not ready yet - continuing without cache');
}

export async function closeRedis() {
  if (!redis) return;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
