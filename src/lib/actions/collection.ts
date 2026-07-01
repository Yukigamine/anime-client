"use server";

import type {
  CollectionCondition,
  CollectionRarity,
  MangaLanguage,
  MediaFormat,
} from "@/generated/prisma/enums";
import type { MangaSeriesDetail } from "@/lib/cache";
import {
  ANIME_SEARCH_KEY,
  getCached,
  getMangaSeriesDetail,
  MANGA_SEARCH_KEY,
  setCached,
} from "@/lib/cache";
import { kitsuThunder } from "@/lib/kitsu/thunder";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type KitsuSearchResult = {
  kitsuId: string;
  /** Kitsu internal numeric id */
  rawId: string;
  titleEn: string;
  titleRomaji: string | null;
  posterUrl: string | null;
};

export type AnimeCollectionItemInput = {
  animeId: string;
  rarity: CollectionRarity;
  format: MediaFormat;
  condition: CollectionCondition;
  notes?: string;
  purchasedAt?: string; // ISO date string or empty
  pricePaid?: number;
  barcode?: string;
};

export type MangaCollectionItemInput = {
  mangaId: string;
  condition: CollectionCondition;
  language: MangaLanguage;
  notes?: string;
  containsSerialized: boolean;
  containsOmnibus: boolean;
  volumes: number[];
  chapters: number[];
};

// ─── Search ───────────────────────────────────────────────────────────────────

const SEARCH_CACHE_TTL = 60 * 60; // 1 hour

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

// ─── Series Detail ────────────────────────────────────────────────────────────

export async function fetchMangaSeriesDetail(
  kitsuId: string,
): Promise<ActionResult<MangaSeriesDetail>> {
  await requireSession();
  try {
    const detail = await getMangaSeriesDetail(kitsuId);
    if (!detail) {
      return { ok: false, error: "Series not found" };
    }
    return { ok: true, data: detail };
  } catch (err) {
    console.error("[collection] fetchMangaSeriesDetail error:", err);
    return { ok: false, error: "Failed to fetch series details" };
  }
}

// ─── Anime CRUD ───────────────────────────────────────────────────────────────

export async function addAnimeCollectionItem(
  input: AnimeCollectionItemInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession();
    const item = await prisma.animeCollectionItem.create({
      data: {
        animeId: input.animeId,
        rarity: input.rarity,
        format: input.format,
        condition: input.condition,
        notes: input.notes || null,
        purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null,
        pricePaid: input.pricePaid ?? null,
        barcode: input.barcode || null,
      },
    });
    return { ok: true, data: { id: item.id } };
  } catch (err) {
    console.error("[collection] addAnimeCollectionItem error:", err);
    return { ok: false, error: "Failed to add item" };
  }
}

export async function editAnimeCollectionItem(
  id: string,
  input: Omit<AnimeCollectionItemInput, "animeId">,
): Promise<ActionResult> {
  try {
    await requireSession();
    const existing = await prisma.animeCollectionItem.findUnique({
      where: { id },
      select: { animeId: true },
    });
    if (!existing) return { ok: false, error: "Item not found" };

    await prisma.animeCollectionItem.update({
      where: { id },
      data: {
        rarity: input.rarity,
        format: input.format,
        condition: input.condition,
        notes: input.notes || null,
        purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null,
        pricePaid: input.pricePaid ?? null,
        barcode: input.barcode || null,
      },
    });
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[collection] editAnimeCollectionItem error:", err);
    return { ok: false, error: "Failed to update item" };
  }
}

export async function deleteAnimeCollectionItem(
  id: string,
): Promise<ActionResult> {
  try {
    await requireSession();
    const existing = await prisma.animeCollectionItem.findUnique({
      where: { id },
      select: { animeId: true },
    });
    if (!existing) return { ok: false, error: "Item not found" };

    await prisma.animeCollectionItem.delete({ where: { id } });
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[collection] deleteAnimeCollectionItem error:", err);
    return { ok: false, error: "Failed to delete item" };
  }
}

// ─── Manga CRUD ───────────────────────────────────────────────────────────────

export async function addMangaCollectionItem(
  input: MangaCollectionItemInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession();
    const item = await prisma.mangaCollectionItem.create({
      data: {
        mangaId: input.mangaId,
        condition: input.condition,
        language: input.language,
        notes: input.notes || null,
        containsSerialized: input.containsSerialized,
        containsOmnibus: input.containsOmnibus,
        volumes: input.volumes,
        chapters: input.chapters,
      },
    });
    return { ok: true, data: { id: item.id } };
  } catch (err) {
    console.error("[collection] addMangaCollectionItem error:", err);
    return { ok: false, error: "Failed to add item" };
  }
}

export async function editMangaCollectionItem(
  id: string,
  input: Omit<MangaCollectionItemInput, "mangaId">,
  totalVolumes: number | null,
  totalChapters: number | null,
): Promise<ActionResult> {
  try {
    await requireSession();
    const existing = await prisma.mangaCollectionItem.findUnique({
      where: { id },
      select: { mangaId: true },
    });
    if (!existing) return { ok: false, error: "Item not found" };

    // Prune out-of-range selections silently (server-side log)
    const prunedVolumes =
      totalVolumes !== null
        ? input.volumes.filter((v) => v >= 1 && v <= totalVolumes)
        : input.volumes;
    const prunedChapters =
      totalChapters !== null
        ? input.chapters.filter((c) => c >= 1 && c <= totalChapters)
        : input.chapters;

    if (prunedVolumes.length !== input.volumes.length) {
      console.warn(
        `[collection] editMangaCollectionItem ${id}: pruned ${input.volumes.length - prunedVolumes.length} out-of-range volume(s)`,
      );
    }
    if (prunedChapters.length !== input.chapters.length) {
      console.warn(
        `[collection] editMangaCollectionItem ${id}: pruned ${input.chapters.length - prunedChapters.length} out-of-range chapter(s)`,
      );
    }

    await prisma.mangaCollectionItem.update({
      where: { id },
      data: {
        condition: input.condition,
        language: input.language,
        notes: input.notes || null,
        containsSerialized: input.containsSerialized,
        containsOmnibus: input.containsOmnibus,
        volumes: prunedVolumes,
        chapters: prunedChapters,
      },
    });
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[collection] editMangaCollectionItem error:", err);
    return { ok: false, error: "Failed to update item" };
  }
}

export async function deleteMangaCollectionItem(
  id: string,
): Promise<ActionResult> {
  try {
    await requireSession();
    const existing = await prisma.mangaCollectionItem.findUnique({
      where: { id },
      select: { mangaId: true },
    });
    if (!existing) return { ok: false, error: "Item not found" };

    await prisma.mangaCollectionItem.delete({ where: { id } });
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[collection] deleteMangaCollectionItem error:", err);
    return { ok: false, error: "Failed to delete item" };
  }
}

// ─── DB lookup helper (for add flow: find or create Anime/Manga record) ───────

/**
 * Finds an existing Anime record by kitsuId, or creates a stub from the
 * Kitsu search result. Returns the internal Prisma `id`.
 */
export async function resolveAnimeId(
  kitsuId: string,
): Promise<ActionResult<string>> {
  try {
    const existing = await prisma.anime.findUnique({
      where: { kitsuId },
      select: { id: true },
    });
    if (existing) return { ok: true, data: existing.id };

    // Fetch detail from Kitsu to create a stub
    const result = await kitsuThunder("query")({
      findAnimeBySlug: [
        { slug: kitsuId },
        {
          id: true,
          titles: { canonical: true, romanized: true, original: true },
          episodeCount: true,
          status: true,
          startDate: true,
          endDate: true,
          averageRating: true,
          posterImage: { original: { url: true } },
          bannerImage: { original: { url: true } },
          mappings: [
            { first: 10 },
            { nodes: { externalId: true, externalSite: true } },
          ],
        },
      ],
    });

    const anime = result.findAnimeBySlug;
    if (!anime) return { ok: false, error: "Anime not found on Kitsu" };

    const { MappingExternalSiteEnum } = await import("@/lib/zeus/kitsu");
    const mappings = anime.mappings?.nodes ?? [];
    const anilistId =
      mappings
        .filter(
          (m) => m?.externalSite === MappingExternalSiteEnum.ANILIST_ANIME,
        )
        .map((m) => Number(m?.externalId))
        .find(Boolean) ?? null;
    const malId =
      mappings
        .filter(
          (m) => m?.externalSite === MappingExternalSiteEnum.MYANIMELIST_ANIME,
        )
        .map((m) => Number(m?.externalId))
        .find(Boolean) ?? null;

    const created = await prisma.anime.create({
      data: {
        kitsuId,
        anilistId,
        malId,
        titleEn: anime.titles?.canonical ?? null,
        titleRomaji: anime.titles?.romanized ?? null,
        titleJp: anime.titles?.original ?? null,
        episodeCount: anime.episodeCount ?? null,
        showStatus: "UNKNOWN",
        averageRating: anime.averageRating ?? null,
        coverImageUrl: anime.posterImage?.original?.url ?? null,
        bannerImageUrl: anime.bannerImage?.original?.url ?? null,
      },
    });
    return { ok: true, data: created.id };
  } catch (err) {
    console.error("[collection] resolveAnimeId error:", err);
    return { ok: false, error: "Failed to resolve anime" };
  }
}

/**
 * Finds an existing Manga record by kitsuId, or creates a stub from Kitsu.
 * Returns the internal Prisma `id`.
 */
export async function resolveMangaId(
  kitsuId: string,
): Promise<ActionResult<string>> {
  try {
    const existing = await prisma.manga.findUnique({
      where: { kitsuId },
      select: { id: true },
    });
    if (existing) return { ok: true, data: existing.id };

    const result = await kitsuThunder("query")({
      findMangaBySlug: [
        { slug: kitsuId },
        {
          id: true,
          titles: { canonical: true, romanized: true, original: true },
          chapterCount: true,
          chapterCountGuess: true,
          volumeCount: true,
          status: true,
          startDate: true,
          endDate: true,
          averageRating: true,
          posterImage: { original: { url: true } },
          mappings: [
            { first: 10 },
            { nodes: { externalId: true, externalSite: true } },
          ],
        },
      ],
    });

    const manga = result.findMangaBySlug;
    if (!manga) return { ok: false, error: "Manga not found on Kitsu" };

    const { MappingExternalSiteEnum } = await import("@/lib/zeus/kitsu");
    const mappings = manga.mappings?.nodes ?? [];
    const anilistId =
      mappings
        .filter(
          (m) => m?.externalSite === MappingExternalSiteEnum.ANILIST_MANGA,
        )
        .map((m) => Number(m?.externalId))
        .find(Boolean) ?? null;
    const malId =
      mappings
        .filter(
          (m) => m?.externalSite === MappingExternalSiteEnum.MYANIMELIST_MANGA,
        )
        .map((m) => Number(m?.externalId))
        .find(Boolean) ?? null;

    const created = await prisma.manga.create({
      data: {
        kitsuId,
        anilistId,
        malId,
        titleEn: manga.titles?.canonical ?? null,
        titleRomaji: manga.titles?.romanized ?? null,
        titleJp: manga.titles?.original ?? null,
        chapterCount: manga.chapterCount ?? manga.chapterCountGuess ?? null,
        volumeCount: manga.volumeCount ?? null,
        showStatus: "UNKNOWN",
        averageRating: manga.averageRating ?? null,
        coverImageUrl: manga.posterImage?.original?.url ?? null,
      },
    });
    return { ok: true, data: created.id };
  } catch (err) {
    console.error("[collection] resolveMangaId error:", err);
    return { ok: false, error: "Failed to resolve manga" };
  }
}
