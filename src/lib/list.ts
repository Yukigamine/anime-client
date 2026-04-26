import type {
  Anime,
  AnimeListEntry,
  Manga,
  MangaListEntry,
  ReadStatus,
  WatchStatus,
} from "@/generated/prisma/client";
import { getCachedList, LIST_CACHE_KEY, setCachedList } from "./cache";
import { prisma } from "./db";

export type AnimeWithEntry = Anime & { listEntry: AnimeListEntry | null };
export type MangaWithEntry = Manga & { listEntry: MangaListEntry | null };

export async function getAnimeList(
  status?: WatchStatus,
): Promise<AnimeWithEntry[]> {
  const cacheKey = `${LIST_CACHE_KEY}:anime:${status ?? "all"}`;
  const cached = await getCachedList<AnimeWithEntry[]>(cacheKey);
  if (cached) return cached;

  const entries = await prisma.anime.findMany({
    where: status
      ? { listEntry: { watchStatus: status } }
      : { listEntry: { isNot: null } },
    include: { listEntry: true },
    orderBy: [{ titleEn: "asc" }],
  });

  await setCachedList(cacheKey, entries);
  return entries;
}

export async function getAnimeListCounts(): Promise<Record<string, number>> {
  const cacheKey = `${LIST_CACHE_KEY}:anime:counts`;
  const cached = await getCachedList<Record<string, number>>(cacheKey);
  if (cached) return cached;

  const groups = await prisma.animeListEntry.groupBy({
    by: ["watchStatus"],
    _count: { watchStatus: true },
  });

  const total = groups.reduce((s, g) => s + g._count.watchStatus, 0);
  const counts: Record<string, number> = { ALL: total };
  for (const g of groups) counts[g.watchStatus] = g._count.watchStatus;

  await setCachedList(cacheKey, counts);
  return counts;
}

export async function getMangaList(
  status?: ReadStatus,
): Promise<MangaWithEntry[]> {
  const cacheKey = `${LIST_CACHE_KEY}:manga:${status ?? "all"}`;
  const cached = await getCachedList<MangaWithEntry[]>(cacheKey);
  if (cached) return cached;

  const entries = await prisma.manga.findMany({
    where: status
      ? { listEntry: { readStatus: status } }
      : { listEntry: { isNot: null } },
    include: { listEntry: true },
    orderBy: [{ titleEn: "asc" }],
  });

  await setCachedList(cacheKey, entries);
  return entries;
}

export async function getMangaListCounts(): Promise<Record<string, number>> {
  const cacheKey = `${LIST_CACHE_KEY}:manga:counts`;
  const cached = await getCachedList<Record<string, number>>(cacheKey);
  if (cached) return cached;

  const groups = await prisma.mangaListEntry.groupBy({
    by: ["readStatus"],
    _count: { readStatus: true },
  });

  const total = groups.reduce((s, g) => s + g._count.readStatus, 0);
  const counts: Record<string, number> = { ALL: total };
  for (const g of groups) counts[g.readStatus] = g._count.readStatus;

  await setCachedList(cacheKey, counts);
  return counts;
}
