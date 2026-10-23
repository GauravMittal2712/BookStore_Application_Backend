import { redis, redisReady } from '../redis/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../logger.js';

// Every helper is fail-open: if Redis is down, callers just hit MongoDB.

export async function cacheGet(key) {
  if (!redisReady()) return null;
  try {
    const raw = await redis.get(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (err) {
    logger.warn({ err: err.message, key }, 'cache get failed');
    return null;
  }
}

export async function cacheSet(key, value, ttl = env.BOOK_CACHE_TTL_SECONDS) {
  if (!redisReady()) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    logger.warn({ err: err.message, key }, 'cache set failed');
  }
}

export async function cacheDel(...keys) {
  if (!redisReady() || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.warn({ err: err.message }, 'cache del failed');
  }
}

// Cache-aside: return the cached value, or run loader() and store its result.
// If loader() throws (e.g. 404) nothing is cached.
export async function cacheRemember(key, ttl, loader) {
  const hit = await cacheGet(key);
  if (hit !== null) return hit;
  const value = await loader();
  await cacheSet(key, value, ttl);
  return value;
}

// Version counters let us invalidate a whole family of keys (all list queries) with one INCR.
export async function getVersion(name) {
  if (!redisReady()) return '0';
  try {
    return (await redis.get(name)) || '0';
  } catch {
    return '0';
  }
}

export async function bumpVersion(name) {
  if (!redisReady()) return;
  try {
    await redis.incr(name);
  } catch (err) {
    logger.warn({ err: err.message, name }, 'cache version bump failed');
  }
}
