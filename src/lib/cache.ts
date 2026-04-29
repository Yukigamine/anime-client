import "server-only";
import { kv } from "@vercel/kv";

export const LIST_CACHE_KEY = "anime:list";
const LIST_CACHE_TTL = 60 * 5; // 5 minutes

export async function getCachedList<T>(key: string): Promise<T | null> {
  try {
    return await kv.get<T>(key);
  } catch {
    return null;
  }
}

export async function setCachedList<T>(
  key: string,
  value: T,
  ttl = LIST_CACHE_TTL,
): Promise<void> {
  try {
    await kv.set(key, value, { ex: ttl });
  } catch {
    // Cache writes are best-effort; don't crash the request
  }
}

export async function invalidateListCache(): Promise<void> {
  try {
    const keys = await kv.keys(`${LIST_CACHE_KEY}*`);
    if (keys.length > 0) {
      await kv.del(...keys);
    }
  } catch {
    // ignore
  }
}
