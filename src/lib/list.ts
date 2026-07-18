import "server-only";
import type {
  Anime,
  AnimeListEntry,
  Manga,
  MangaListEntry,
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
export type AnimeListSnapshot = {
  items: AnimeWithEntry[];
  counts: Record<string, number>;
};
export type MangaListSnapshot = {
  items: MangaWithEntry[];
  counts: Record<string, number>;
};

export async function getAnimeListSnapshot(): Promise<AnimeListSnapshot> {
  const cacheKey = `${ANIME_LIST_KEY}:all`;
  const cached = await getCached<AnimeListSnapshot>(cacheKey);
  if (cached) return cached;

  const [items, groups] = await Promise.all([
    prisma.anime.findMany({
      where: { listEntry: { isNot: null } },
      include: { listEntry: true },
      orderBy: [{ titleEn: "asc" }],
    }),
    prisma.animeListEntry.groupBy({
      by: ["watchStatus"],
      _count: { watchStatus: true },
    }),
  ]);

  const total = groups.reduce((s, g) => s + g._count.watchStatus, 0);
  const counts: Record<string, number> = { ALL: total };
  for (const g of groups) counts[g.watchStatus] = g._count.watchStatus;

  const snapshot = { items, counts };
  await setCached(cacheKey, snapshot, LIST_TTL);
  return snapshot;
}

export async function getMangaListSnapshot(): Promise<MangaListSnapshot> {
  const cacheKey = `${MANGA_LIST_KEY}:all`;
  const cached = await getCached<MangaListSnapshot>(cacheKey);
  if (cached) return cached;

  const [items, groups] = await Promise.all([
    prisma.manga.findMany({
      where: { listEntry: { isNot: null } },
      include: { listEntry: true },
      orderBy: [{ titleEn: "asc" }],
    }),
    prisma.mangaListEntry.groupBy({
      by: ["readStatus"],
      _count: { readStatus: true },
    }),
  ]);

  const total = groups.reduce((s, g) => s + g._count.readStatus, 0);
  const counts: Record<string, number> = { ALL: total };
  for (const g of groups) counts[g.readStatus] = g._count.readStatus;

  const snapshot = { items, counts };
  await setCached(cacheKey, snapshot, LIST_TTL);
  return snapshot;
}
