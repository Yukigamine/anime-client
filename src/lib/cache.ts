import "server-only";
import { createClient } from "redis";
import { kitsuThunder } from "@/lib/kitsu/thunder";

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
export const ANIME_SERIES_KEY = "anime:series";
export const MANGA_SERIES_KEY = "manga:series";
export const ANIME_SEARCH_KEY = "anime:search";
export const MANGA_SEARCH_KEY = "manga:search";

// ─── TTLs ─────────────────────────────────────────────────────────────────────

export const LIST_TTL = 60 * 5; // 5 minutes
export const SERIES_TTL_MAX = 60 * 60 * 24 * 7; // 7 days

/** Returns TTL in seconds: min(updatedAt + 7 days, now + 7 days) capped at 7d. */
export function computeSeriesTTL(updatedAt: Date): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const updatedSec = Math.floor(updatedAt.getTime() / 1000);
  const remaining = updatedSec + SERIES_TTL_MAX - nowSec;
  return Math.max(1, Math.min(remaining, SERIES_TTL_MAX));
}

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

/** Invalidates both anime and manga list caches (use after a full sync). */
export async function invalidateListCache(): Promise<void> {
  await Promise.all([
    invalidateByPrefix(ANIME_LIST_KEY),
    invalidateByPrefix(MANGA_LIST_KEY),
  ]);
}

// ─── Anime series detail ──────────────────────────────────────────────────────

export type AnimeSeriesDetail = {
  kitsuId: string;
  titleEn: string | null;
  titleRomaji: string | null;
  episodeCount: number | null;
  posterUrl: string | null;
  updatedAt: string;
};

export async function getAnimeSeriesDetail(
  kitsuId: string,
): Promise<AnimeSeriesDetail | null> {
  const cacheKey = `${ANIME_SERIES_KEY}:${kitsuId}`;

  const cached = await getCached<AnimeSeriesDetail>(cacheKey);
  if (cached) {
    const remainingTTL = computeSeriesTTL(new Date(cached.updatedAt));
    if (remainingTTL > 0) return cached;
    console.warn(
      `[cache] Anime ${kitsuId} stale beyond 7d cutoff — falling back to live fetch`,
    );
  }

  try {
    const result = await kitsuThunder("query")({
      findAnimeBySlug: [
        { slug: kitsuId },
        {
          id: true,
          titles: { canonical: true, romanized: true },
          episodeCount: true,
          updatedAt: true,
          posterImage: { original: { url: true } },
        },
      ],
    });

    const anime = result.findAnimeBySlug;
    if (!anime) return null;

    const detail: AnimeSeriesDetail = {
      kitsuId,
      titleEn: anime.titles?.canonical ?? null,
      titleRomaji: anime.titles?.romanized ?? null,
      episodeCount: anime.episodeCount ?? null,
      posterUrl: anime.posterImage?.original?.url ?? null,
      updatedAt: anime.updatedAt as string,
    };

    await setCached(
      cacheKey,
      detail,
      computeSeriesTTL(new Date(detail.updatedAt)),
    );
    return detail;
  } catch (err) {
    console.error(`[cache] Failed to fetch anime series ${kitsuId}:`, err);
    return null;
  }
}

// ─── Manga series detail ──────────────────────────────────────────────────────

export type MangaSeriesDetail = {
  kitsuId: string;
  titleEn: string | null;
  titleRomaji: string | null;
  /** Total chapters; null when Kitsu has no data */
  totalChapters: number | null;
  /** Total volumes; null when Kitsu has no data */
  totalVolumes: number | null;
  /** Whether the totals come from Kitsu (true) or are unknown (false) */
  totalsFromKitsu: boolean;
  posterUrl: string | null;
  updatedAt: string;
};

export async function getMangaSeriesDetail(
  kitsuId: string,
): Promise<MangaSeriesDetail | null> {
  const cacheKey = `${MANGA_SERIES_KEY}:${kitsuId}`;

  const cached = await getCached<MangaSeriesDetail>(cacheKey);
  if (cached) {
    const remainingTTL = computeSeriesTTL(new Date(cached.updatedAt));
    if (remainingTTL > 0) return cached;
    console.warn(
      `[cache] Manga ${kitsuId} stale beyond 7d cutoff — falling back to live fetch`,
    );
  }

  try {
    const result = await kitsuThunder("query")({
      findMangaBySlug: [
        { slug: kitsuId },
        {
          id: true,
          titles: { canonical: true, romanized: true },
          chapterCount: true,
          chapterCountGuess: true,
          volumeCount: true,
          updatedAt: true,
          posterImage: { original: { url: true } },
        },
      ],
    });

    const manga = result.findMangaBySlug;
    if (!manga) return null;

    const totalChapters = manga.chapterCount ?? manga.chapterCountGuess ?? null;
    const totalVolumes = manga.volumeCount ?? null;

    const detail: MangaSeriesDetail = {
      kitsuId,
      titleEn: manga.titles?.canonical ?? null,
      titleRomaji: manga.titles?.romanized ?? null,
      totalChapters,
      totalVolumes,
      totalsFromKitsu: totalChapters !== null || totalVolumes !== null,
      posterUrl: manga.posterImage?.original?.url ?? null,
      updatedAt: manga.updatedAt as string,
    };

    await setCached(
      cacheKey,
      detail,
      computeSeriesTTL(new Date(detail.updatedAt)),
    );
    return detail;
  } catch (err) {
    console.error(`[cache] Failed to fetch manga series ${kitsuId}:`, err);
    return null;
  }
}
