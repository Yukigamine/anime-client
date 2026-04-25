import type { AnimeEntry, WatchStatus } from "@/generated/prisma/client";
import { getCachedList, LIST_CACHE_KEY, setCachedList } from "./cache";
import { prisma } from "./db";

export type { AnimeEntry };

export async function getAnimeList(
  status?: WatchStatus,
): Promise<AnimeEntry[]> {
  const cacheKey = `${LIST_CACHE_KEY}:${status ?? "all"}`;
  const cached = await getCachedList<AnimeEntry[]>(cacheKey);
  if (cached) return cached;

  const entries = await prisma.animeEntry.findMany({
    where: status ? { watchStatus: status } : undefined,
    orderBy: [{ watchStatus: "asc" }, { titleEn: "asc" }],
  });

  await setCachedList(cacheKey, entries);
  return entries;
}

export async function getListCounts(): Promise<Record<string, number>> {
  const cacheKey = `${LIST_CACHE_KEY}:counts`;
  const cached = await getCachedList<Record<string, number>>(cacheKey);
  if (cached) return cached;

  const groups = await prisma.animeEntry.groupBy({
    by: ["watchStatus"],
    _count: { watchStatus: true },
  });

  const total = groups.reduce((sum, g) => sum + g._count.watchStatus, 0);
  const counts: Record<string, number> = { ALL: total };
  for (const g of groups) {
    counts[g.watchStatus] = g._count.watchStatus;
  }

  await setCachedList(cacheKey, counts);
  return counts;
}
