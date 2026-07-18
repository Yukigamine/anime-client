import "server-only";
import type { Anime, Manga } from "@/generated/prisma/client";
import type { MediaDetailSnapshot } from "@/lib/media-detail-types";
import prisma from "@/lib/prisma";
import {
  ANIME_TITLE_KEY,
  getCached,
  MANGA_TITLE_KEY,
  setCached,
  TITLE_TTL,
} from "@/lib/redis";

function animeTitleKey(identifier: string): string {
  return `${ANIME_TITLE_KEY}:${identifier}`;
}

function mangaTitleKey(identifier: string): string {
  return `${MANGA_TITLE_KEY}:${identifier}`;
}

function toAnimeSnapshot(anime: Anime): MediaDetailSnapshot {
  return {
    id: anime.id,
    kitsuId: anime.kitsuId,
    anilistId: anime.anilistId,
    titleEn: anime.titleEn,
    titleJp: anime.titleJp,
    titleRomaji: anime.titleRomaji,
    synopsis: anime.synopsis,
    coverImageUrl: anime.coverImageUrl,
    bannerImageUrl: anime.bannerImageUrl,
    episodeCount: anime.episodeCount,
    chapterCount: null,
    volumeCount: null,
    showStatus: anime.showStatus,
    averageRating: anime.averageRating,
    startDate: anime.startDate?.toISOString() ?? null,
    endDate: anime.endDate?.toISOString() ?? null,
  };
}

function toMangaSnapshot(manga: Manga): MediaDetailSnapshot {
  return {
    id: manga.id,
    kitsuId: manga.kitsuId,
    anilistId: manga.anilistId,
    titleEn: manga.titleEn,
    titleJp: manga.titleJp,
    titleRomaji: manga.titleRomaji,
    synopsis: manga.synopsis,
    coverImageUrl: manga.coverImageUrl,
    bannerImageUrl: null,
    episodeCount: null,
    chapterCount: manga.chapterCount,
    volumeCount: manga.volumeCount,
    showStatus: manga.showStatus,
    averageRating: manga.averageRating,
    startDate: manga.startDate?.toISOString() ?? null,
    endDate: manga.endDate?.toISOString() ?? null,
  };
}

async function cacheTitle(
  key: (identifier: string) => string,
  snapshot: MediaDetailSnapshot,
  requestedIdentifier: string,
): Promise<void> {
  const identifiers = new Set([
    requestedIdentifier,
    snapshot.id,
    snapshot.kitsuId,
  ]);
  await Promise.all(
    [...identifiers]
      .filter((identifier): identifier is string => Boolean(identifier))
      .map((identifier) => setCached(key(identifier), snapshot, TITLE_TTL)),
  );
}

export async function getAnimeDetailSnapshot(
  identifier: string,
): Promise<MediaDetailSnapshot | null> {
  const cacheKey = animeTitleKey(identifier);
  const cached = await getCached<MediaDetailSnapshot>(cacheKey);
  if (cached) return cached;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: identifier }, { kitsuId: identifier }] },
  });
  if (!anime) return null;

  const snapshot = toAnimeSnapshot(anime);
  await cacheTitle(animeTitleKey, snapshot, identifier);
  return snapshot;
}

export async function getMangaDetailSnapshot(
  identifier: string,
): Promise<MediaDetailSnapshot | null> {
  const cacheKey = mangaTitleKey(identifier);
  const cached = await getCached<MediaDetailSnapshot>(cacheKey);
  if (cached) return cached;

  const manga = await prisma.manga.findFirst({
    where: { OR: [{ id: identifier }, { kitsuId: identifier }] },
  });
  if (!manga) return null;

  const snapshot = toMangaSnapshot(manga);
  await cacheTitle(mangaTitleKey, snapshot, identifier);
  return snapshot;
}
