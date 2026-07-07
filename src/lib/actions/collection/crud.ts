"use server";

import { kitsuThunder } from "@/lib/kitsu/thunder";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type {
  ActionResult,
  AnimeCollectionItemInput,
  MangaCollectionItemInput,
} from "./types";

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

export async function resolveAnimeId(
  kitsuId: string,
): Promise<ActionResult<string>> {
  try {
    const existing = await prisma.anime.findUnique({
      where: { kitsuId },
      select: { id: true },
    });
    if (existing) return { ok: true, data: existing.id };

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
