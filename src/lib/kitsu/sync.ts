import { ShowStatus, WatchStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type {
  KitsuAnime,
  KitsuLibraryEntry,
  KitsuLibraryResponse,
  KitsuUser,
} from "./types";

const KITSU_API = "https://kitsu.io/api/edge";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.api+json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Kitsu API error ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

async function getKitsuUserId(username: string): Promise<string> {
  const data = await fetchJson<{ data: KitsuUser[] }>(
    `${KITSU_API}/users?filter[name]=${encodeURIComponent(username)}&fields[users]=id,name`,
  );
  if (!data.data.length) {
    throw new Error(`Kitsu user not found: ${username}`);
  }
  return data.data[0].id;
}

function mapWatchStatus(kitsuStatus: string): WatchStatus {
  switch (kitsuStatus) {
    case "current":
      return WatchStatus.WATCHING;
    case "planned":
      return WatchStatus.PLAN_TO_WATCH;
    case "completed":
      return WatchStatus.COMPLETED;
    case "on_hold":
      return WatchStatus.ON_HOLD;
    case "dropped":
      return WatchStatus.DROPPED;
    default:
      return WatchStatus.PLAN_TO_WATCH;
  }
}

function mapShowStatus(kitsuStatus: string): ShowStatus {
  switch (kitsuStatus) {
    case "current":
      return ShowStatus.AIRING;
    case "finished":
      return ShowStatus.FINISHED;
    case "upcoming":
    case "tba":
      return ShowStatus.UPCOMING;
    case "unreleased":
      return ShowStatus.CANCELLED;
    default:
      return ShowStatus.UNKNOWN;
  }
}

async function upsertEntry(
  entry: KitsuLibraryEntry,
  anime: KitsuAnime | null,
): Promise<void> {
  const { attributes: ea } = entry;
  const animeAttrs = anime?.attributes;

  const titleEn =
    animeAttrs?.titles?.en ??
    animeAttrs?.titles?.en_jp ??
    animeAttrs?.canonicalTitle ??
    null;
  const titleJp = animeAttrs?.titles?.ja_jp ?? null;
  const coverImageUrl =
    animeAttrs?.posterImage?.medium ?? animeAttrs?.posterImage?.small ?? null;

  // Kitsu ratingTwenty is 0–20; normalize to 0–10
  const rating = ea.ratingTwenty != null ? ea.ratingTwenty / 2 : null;

  await prisma.animeEntry.upsert({
    where: { kitsuId: entry.id },
    create: {
      kitsuId: entry.id,
      titleEn,
      titleJp,
      coverImageUrl,
      episodeCount: animeAttrs?.episodeCount ?? null,
      showStatus: animeAttrs
        ? mapShowStatus(animeAttrs.status)
        : ShowStatus.UNKNOWN,
      watchStatus: mapWatchStatus(ea.status),
      progress: ea.progress,
      rating,
      notes: ea.notes,
      private: ea.private,
      rewatching: ea.reconsuming,
      rewatchCount: ea.reconsumeCount,
      startedAt: ea.startedAt ? new Date(ea.startedAt) : null,
      completedAt: ea.finishedAt ? new Date(ea.finishedAt) : null,
      syncSource: "KITSU",
      kitsuSyncedAt: new Date(),
    },
    update: {
      titleEn,
      titleJp,
      coverImageUrl,
      episodeCount: animeAttrs?.episodeCount ?? null,
      showStatus: animeAttrs
        ? mapShowStatus(animeAttrs.status)
        : ShowStatus.UNKNOWN,
      watchStatus: mapWatchStatus(ea.status),
      progress: ea.progress,
      rating,
      notes: ea.notes,
      private: ea.private,
      rewatching: ea.reconsuming,
      rewatchCount: ea.reconsumeCount,
      startedAt: ea.startedAt ? new Date(ea.startedAt) : null,
      completedAt: ea.finishedAt ? new Date(ea.finishedAt) : null,
      syncSource: "KITSU",
      kitsuSyncedAt: new Date(),
    },
  });
}

export async function syncKitsu(username: string): Promise<{ synced: number }> {
  const userId = await getKitsuUserId(username);

  let url: string | null =
    `${KITSU_API}/library-entries` +
    `?filter[userId]=${userId}&filter[kind]=anime` +
    `&include=anime` +
    `&fields[libraryEntries]=status,progress,ratingTwenty,notes,private,reconsuming,reconsumeCount,startedAt,finishedAt,updatedAt,anime` +
    `&fields[anime]=canonicalTitle,titles,episodeCount,status,posterImage` +
    `&page[limit]=500`;

  let synced = 0;

  while (url) {
    const resp: KitsuLibraryResponse =
      await fetchJson<KitsuLibraryResponse>(url);
    const animeMap = new Map<string, KitsuAnime>(
      (resp.included ?? []).map((a: KitsuAnime) => [a.id, a]),
    );

    for (const entry of resp.data) {
      const animeId = entry.relationships.anime.data.id;
      const anime = animeMap.get(animeId) ?? null;
      await upsertEntry(entry, anime);
      synced++;
    }

    url = resp.links.next ?? null;
  }

  return { synced };
}
