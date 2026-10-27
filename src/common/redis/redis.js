import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../logger.js';


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
    if (reportedDown) return;
    reportedDown = true;
    logger.warn({ err: err.message }, 'Redis unavailable - cache bypassed, will keep retrying');
  });
}
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
