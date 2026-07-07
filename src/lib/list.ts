import "server-only";
import type {
  Anime,
  AnimeListEntry,
  Manga,
  MangaListEntry,
  ReadStatus,
  WatchStatus,
} from "@/generated/prisma/client";
import prisma from "./prisma";
import {
  ANIME_LIST_KEY,
  getCached,
  LIST_TTL,
  MANGA_LIST_KEY,
  setCached,
} from "./redis";

export type AnimeWithEntry = Anime & { listEntry: AnimeListEntry | null };
export type MangaWithEntry = Manga & { listEntry: MangaListEntry | null };

export async function getAnimeList(
  status?: WatchStatus,
): Promise<AnimeWithEntry[]> {
  const cacheKey = `${ANIME_LIST_KEY}:${status ?? "all"}`;
  const cached = await getCached<AnimeWithEntry[]>(cacheKey);
  if (cached) return cached;

  const entries = await prisma.anime.findMany({
    where: status
      ? { listEntry: { watchStatus: status } }
      : { listEntry: { isNot: null } },
    include: { listEntry: true },
    orderBy: [{ titleEn: "asc" }],
  });

  await setCached(cacheKey, entries, LIST_TTL);
  return entries;
}

export async function getAnimeListCounts(): Promise<Record<string, number>> {
  const cacheKey = `${ANIME_LIST_KEY}:counts`;
  const cached = await getCached<Record<string, number>>(cacheKey);
  if (cached) return cached;

  const groups = await prisma.animeListEntry.groupBy({
    by: ["watchStatus"],
    _count: { watchStatus: true },
  });

  const total = groups.reduce((s, g) => s + g._count.watchStatus, 0);
  const counts: Record<string, number> = { ALL: total };
  for (const g of groups) counts[g.watchStatus] = g._count.watchStatus;

  await setCached(cacheKey, counts, LIST_TTL);
  return counts;
}

export async function getMangaList(
  status?: ReadStatus,
): Promise<MangaWithEntry[]> {
  const cacheKey = `${MANGA_LIST_KEY}:${status ?? "all"}`;
  const cached = await getCached<MangaWithEntry[]>(cacheKey);
  if (cached) return cached;

  const entries = await prisma.manga.findMany({
    where: status
      ? { listEntry: { readStatus: status } }
      : { listEntry: { isNot: null } },
    include: { listEntry: true },
    orderBy: [{ titleEn: "asc" }],
  });

  await setCached(cacheKey, entries, LIST_TTL);
  return entries;
}

export async function getMangaListCounts(): Promise<Record<string, number>> {
  const cacheKey = `${MANGA_LIST_KEY}:counts`;
  const cached = await getCached<Record<string, number>>(cacheKey);
  if (cached) return cached;

  const groups = await prisma.mangaListEntry.groupBy({
    by: ["readStatus"],
    _count: { readStatus: true },
  });

  const total = groups.reduce((s, g) => s + g._count.readStatus, 0);
  const counts: Record<string, number> = { ALL: total };
  for (const g of groups) counts[g.readStatus] = g._count.readStatus;

  await setCached(cacheKey, counts, LIST_TTL);
  return counts;
}
