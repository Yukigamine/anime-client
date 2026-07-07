"use server";

import { kitsuThunder } from "@/lib/kitsu/thunder";
import {
  ANIME_SEARCH_KEY,
  getCached,
  MANGA_SEARCH_KEY,
  setCached,
} from "@/lib/redis";
import { requireSession } from "@/lib/session";
import type { ActionResult, KitsuSearchResult } from "./types";

const SEARCH_CACHE_TTL = 60 * 60;

export async function searchAnimeByTitle(
  query: string,
): Promise<ActionResult<KitsuSearchResult[]>> {
  await requireSession();
  if (!query.trim()) return { ok: true, data: [] };

  const cacheKey = `${ANIME_SEARCH_KEY}:${query.toLowerCase().trim()}`;
  const cached = await getCached<KitsuSearchResult[]>(cacheKey);
  if (cached) return { ok: true, data: cached };

  try {
    const result = await kitsuThunder("query")({
      searchAnimeByTitle: [
        { title: query, first: 10 },
        {
          nodes: {
            id: true,
            slug: true,
            titles: { canonical: true, romanized: true },
            posterImage: { original: { url: true } },
          },
        },
      ],
    });

    const nodes = result.searchAnimeByTitle?.nodes ?? [];
    const items: KitsuSearchResult[] = nodes.filter(Boolean).map((n) => ({
      kitsuId: n?.slug,
      rawId: String(n?.id),
      titleEn: n?.titles?.canonical ?? n?.slug,
      titleRomaji: n?.titles?.romanized ?? null,
      posterUrl: n?.posterImage?.original?.url ?? null,
    }));

    await setCached(cacheKey, items, SEARCH_CACHE_TTL);
    return { ok: true, data: items };
  } catch (err) {
    console.error("[collection] searchAnimeByTitle error:", err);
    return { ok: false, error: "Search failed" };
  }
}

export async function searchMangaByTitle(
  query: string,
): Promise<ActionResult<KitsuSearchResult[]>> {
  await requireSession();
  if (!query.trim()) return { ok: true, data: [] };

  const cacheKey = `${MANGA_SEARCH_KEY}:${query.toLowerCase().trim()}`;
  const cached = await getCached<KitsuSearchResult[]>(cacheKey);
  if (cached) return { ok: true, data: cached };

  try {
    const result = await kitsuThunder("query")({
      searchMangaByTitle: [
        { title: query, first: 10 },
        {
          nodes: {
            id: true,
            slug: true,
            titles: { canonical: true, romanized: true },
            posterImage: { original: { url: true } },
          },
        },
      ],
    });

    const nodes = result.searchMangaByTitle?.nodes ?? [];
    const items: KitsuSearchResult[] = nodes.filter(Boolean).map((n) => ({
      kitsuId: n?.slug,
      rawId: String(n?.id),
      titleEn: n?.titles?.canonical ?? n?.slug,
      titleRomaji: n?.titles?.romanized ?? null,
      posterUrl: n?.posterImage?.original?.url ?? null,
    }));

    await setCached(cacheKey, items, SEARCH_CACHE_TTL);
    return { ok: true, data: items };
  } catch (err) {
    console.error("[collection] searchMangaByTitle error:", err);
    return { ok: false, error: "Search failed" };
  }
}
