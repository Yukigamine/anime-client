import "server-only";
import { createClient } from "redis";

let redis: ReturnType<typeof createClient> | undefined;
let connectPromise: Promise<ReturnType<typeof createClient>> | undefined;

async function getRedis() {
  if (!redis) {
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on("error", (err) => console.error("[redis] error:", err));
    connectPromise = redis.connect();
  }

  await connectPromise;
  return redis;
}

// ─── Key namespaces ───────────────────────────────────────────────────────────
// All KV keys follow: {type}:{category}:{id|status|query}
// e.g.  anime:list:WATCHING   manga:series:berserk   anime:search:naruto

export const ANIME_LIST_KEY = "anime:list";
export const MANGA_LIST_KEY = "manga:list";
export const ANIME_TITLE_KEY = "anime:title";
export const MANGA_TITLE_KEY = "manga:title";

// ─── TTLs ─────────────────────────────────────────────────────────────────────

export const LIST_TTL = 60 * 5; // 5 minutes
export const TITLE_TTL = 60 * 30; // 30 minutes

// ─── Primitives ───────────────────────────────────────────────────────────────

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const r = await getRedis();
    const data = await r.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch (err) {
    console.error(`[cache] Failed to get ${key}:`, err);
    return null;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttl: number,
): Promise<void> {
  try {
    const r = await getRedis();
    await r.setEx(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.error(`[cache] Failed to set ${key}:`, err);
    // Cache writes are best-effort
  }
}

async function deleteCached(key: string): Promise<void> {
  try {
    const r = await getRedis();
    await r.del(key);
  } catch (err) {
    console.error(`[cache] Failed to delete ${key}:`, err);
  }
}

async function invalidateByPrefix(prefix: string): Promise<void> {
  try {
    const r = await getRedis();
    const keys = await r.keys(`${prefix}:*`);
    if (keys.length > 0) await r.del(keys);
  } catch (err) {
    console.error(`[cache] Failed to invalidate prefix ${prefix}:`, err);
  }
}

// ─── Invalidation ────────────────────────────────────────────────────────────

export async function invalidateAnimeListCache(): Promise<void> {
  await invalidateByPrefix(ANIME_LIST_KEY);
}

export async function invalidateMangaListCache(): Promise<void> {
  await invalidateByPrefix(MANGA_LIST_KEY);
}

export async function invalidateAnimeTitleCache(
  id: string,
  kitsuId: string | null,
): Promise<void> {
  await Promise.all(
    [id, kitsuId]
      .filter((identifier): identifier is string => identifier !== null)
      .map((identifier) => deleteCached(`${ANIME_TITLE_KEY}:${identifier}`)),
  );
}

export async function invalidateMangaTitleCache(
  id: string,
  kitsuId: string | null,
): Promise<void> {
  await Promise.all(
    [id, kitsuId]
      .filter((identifier): identifier is string => identifier !== null)
      .map((identifier) => deleteCached(`${MANGA_TITLE_KEY}:${identifier}`)),
  );
}

/** Invalidates both anime and manga list caches (use after a full sync). */
export async function invalidateListCache(): Promise<void> {
  await Promise.all([
    invalidateByPrefix(ANIME_LIST_KEY),
    invalidateByPrefix(MANGA_LIST_KEY),
  ]);
}
