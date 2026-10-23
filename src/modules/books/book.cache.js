import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { redisReady } from '../../common/redis/redis.js';
import { cacheRemember, cacheDel, getVersion, bumpVersion } from '../../common/cache/cache.js';

const LIST_VERSION_KEY = 'books:list:ver';
const detailKey = (id) => `books:detail:${id}`;

const TTL = env.BOOK_CACHE_TTL_SECONDS;

export async function cachedList(query, loader) {
  if (!redisReady()) return loader();
  const version = await getVersion(LIST_VERSION_KEY);
  const hash = createHash('sha1')
    .update(JSON.stringify(Object.entries(query).sort(([a], [b]) => (a < b ? -1 : 1))))
    .digest('hex');
  return cacheRemember(`books:list:v${version}:${hash}`, TTL, loader);
}

export function cachedDetail(bookId, loader) {
  return cacheRemember(detailKey(bookId), TTL, loader);
}

// Call AFTER the database write has committed. Bumping the list version orphans every cached
// list page at once (they expire on their own via TTL); detail keys are deleted directly.
export async function invalidateBooks(bookIds = []) {
  await cacheDel(...bookIds.map((id) => detailKey(String(id))));
  await bumpVersion(LIST_VERSION_KEY);
}
