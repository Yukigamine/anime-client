import { ReadStatus, ShowStatus, WatchStatus } from "@/generated/prisma/client";
import { getToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type {
  KitsuAnime,
  KitsuAnimeLibraryEntry,
  KitsuAnimeLibraryResponse,
  KitsuManga,
  KitsuMangaLibraryEntry,
  KitsuMangaLibraryResponse,
  KitsuUser,
  KitsuWatchStatus,
} from "./types";

const KITSU_API = "https://kitsu.io/api/edge";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.api+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Kitsu GET ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

async function patchJson(
  url: string,
  body: unknown,
  token: string,
): Promise<void> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kitsu PATCH ${res.status}: ${text}`);
  }
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapWatchStatus(s: KitsuWatchStatus): WatchStatus {
  switch (s) {
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
  }
}

function mapReadStatus(s: KitsuWatchStatus): ReadStatus {
  switch (s) {
    case "current":
      return ReadStatus.READING;
    case "planned":
      return ReadStatus.PLAN_TO_READ;
    case "completed":
      return ReadStatus.COMPLETED;
    case "on_hold":
      return ReadStatus.ON_HOLD;
    case "dropped":
      return ReadStatus.DROPPED;
  }
}

function mapShowStatus(s: string): ShowStatus {
  switch (s) {
    case "current":
    case "releasing":
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

function toRating(ratingTwenty: number | null): number | null {
  return ratingTwenty != null ? ratingTwenty / 2 : null;
}

function toKitsuRating(rating: number | null): number | null {
  return rating != null ? Math.round(rating * 2) : null;
}

function reverseWatchStatus(s: WatchStatus): KitsuWatchStatus {
  switch (s) {
    case WatchStatus.WATCHING:
      return "current";
    case WatchStatus.PLAN_TO_WATCH:
      return "planned";
    case WatchStatus.COMPLETED:
      return "completed";
    case WatchStatus.ON_HOLD:
      return "on_hold";
    case WatchStatus.DROPPED:
      return "dropped";
  }
}

function reverseReadStatus(s: ReadStatus): KitsuWatchStatus {
  switch (s) {
    case ReadStatus.READING:
      return "current";
    case ReadStatus.PLAN_TO_READ:
      return "planned";
    case ReadStatus.COMPLETED:
      return "completed";
    case ReadStatus.ON_HOLD:
      return "on_hold";
    case ReadStatus.DROPPED:
      return "dropped";
  }
}

// ─── User lookup ──────────────────────────────────────────────────────────────

async function getUserId(username: string, token?: string): Promise<string> {
  const filter = token
    ? "filter[self]=true"
    : `filter[name]=${encodeURIComponent(username)}`;
  const data = await fetchJson<{ data: KitsuUser[] }>(
    `${KITSU_API}/users?${filter}&fields[users]=id,name`,
    token,
  );
  if (!data.data.length) throw new Error(`Kitsu user not found: ${username}`);
  return data.data[0].id;
}

// ─── Pull: anime ──────────────────────────────────────────────────────────────

async function pullAnimeEntry(
  entry: KitsuAnimeLibraryEntry,
  anime: KitsuAnime | null,
): Promise<void> {
  const ea = entry.attributes;
  const a = anime?.attributes;

  const titleEn =
    a?.titles?.en ?? a?.titles?.en_jp ?? a?.canonicalTitle ?? null;
  const coverImageUrl = a?.posterImage?.medium ?? a?.posterImage?.small ?? null;

  // Upsert the canonical Anime record
  const animeRecord = await prisma.anime.upsert({
    where: { kitsuId: anime?.id ?? `kitsu-${entry.id}` },
    create: {
      kitsuId: anime?.id ?? null,
      titleEn,
      titleJp: a?.titles?.ja_jp ?? null,
      titleRomaji: a?.titles?.en_jp ?? null,
      synopsis: a?.description ?? null,
      coverImageUrl,
      bannerImageUrl: a?.coverImage?.large ?? null,
      episodeCount: a?.episodeCount ?? null,
      showStatus: a ? mapShowStatus(a.status) : ShowStatus.UNKNOWN,
      averageRating: a?.averageRating ? parseFloat(a.averageRating) / 10 : null,
      startDate: a?.startDate ? new Date(a.startDate) : null,
      endDate: a?.endDate ? new Date(a.endDate) : null,
    },
    update: {
      titleEn,
      titleJp: a?.titles?.ja_jp ?? null,
      titleRomaji: a?.titles?.en_jp ?? null,
      synopsis: a?.description ?? null,
      coverImageUrl,
      bannerImageUrl: a?.coverImage?.large ?? null,
      episodeCount: a?.episodeCount ?? null,
      showStatus: a ? mapShowStatus(a.status) : ShowStatus.UNKNOWN,
      averageRating: a?.averageRating ? parseFloat(a.averageRating) / 10 : null,
      startDate: a?.startDate ? new Date(a.startDate) : null,
      endDate: a?.endDate ? new Date(a.endDate) : null,
    },
  });

  // Upsert the list entry
  await prisma.animeListEntry.upsert({
    where: { animeId: animeRecord.id },
    create: {
      animeId: animeRecord.id,
      kitsuEntryId: entry.id,
      watchStatus: mapWatchStatus(ea.status),
      progress: ea.progress,
      rating: toRating(ea.ratingTwenty),
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
      kitsuEntryId: entry.id,
      watchStatus: mapWatchStatus(ea.status),
      progress: ea.progress,
      rating: toRating(ea.ratingTwenty),
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

// ─── Pull: manga ──────────────────────────────────────────────────────────────

async function pullMangaEntry(
  entry: KitsuMangaLibraryEntry,
  manga: KitsuManga | null,
): Promise<void> {
  const ea = entry.attributes;
  const m = manga?.attributes;

  const titleEn =
    m?.titles?.en ?? m?.titles?.en_jp ?? m?.canonicalTitle ?? null;
  const coverImageUrl = m?.posterImage?.medium ?? m?.posterImage?.small ?? null;

  const mangaRecord = await prisma.manga.upsert({
    where: { kitsuId: manga?.id ?? `kitsu-${entry.id}` },
    create: {
      kitsuId: manga?.id ?? null,
      titleEn,
      titleJp: m?.titles?.ja_jp ?? null,
      titleRomaji: m?.titles?.en_jp ?? null,
      synopsis: m?.description ?? null,
      coverImageUrl,
      chapterCount: m?.chapterCount ?? null,
      volumeCount: m?.volumeCount ?? null,
      showStatus: m ? mapShowStatus(m.status) : ShowStatus.UNKNOWN,
      averageRating: m?.averageRating ? parseFloat(m.averageRating) / 10 : null,
      startDate: m?.startDate ? new Date(m.startDate) : null,
      endDate: m?.endDate ? new Date(m.endDate) : null,
    },
    update: {
      titleEn,
      titleJp: m?.titles?.ja_jp ?? null,
      titleRomaji: m?.titles?.en_jp ?? null,
      synopsis: m?.description ?? null,
      coverImageUrl,
      chapterCount: m?.chapterCount ?? null,
      volumeCount: m?.volumeCount ?? null,
      showStatus: m ? mapShowStatus(m.status) : ShowStatus.UNKNOWN,
      averageRating: m?.averageRating ? parseFloat(m.averageRating) / 10 : null,
      startDate: m?.startDate ? new Date(m.startDate) : null,
      endDate: m?.endDate ? new Date(m.endDate) : null,
    },
  });

  await prisma.mangaListEntry.upsert({
    where: { mangaId: mangaRecord.id },
    create: {
      mangaId: mangaRecord.id,
      kitsuEntryId: entry.id,
      readStatus: mapReadStatus(ea.status),
      progress: ea.progress,
      progressVolumes: ea.volumesOwned ?? 0,
      rating: toRating(ea.ratingTwenty),
      notes: ea.notes,
      private: ea.private,
      rereading: ea.reconsuming,
      rereadCount: ea.reconsumeCount,
      startedAt: ea.startedAt ? new Date(ea.startedAt) : null,
      completedAt: ea.finishedAt ? new Date(ea.finishedAt) : null,
      syncSource: "KITSU",
      kitsuSyncedAt: new Date(),
    },
    update: {
      kitsuEntryId: entry.id,
      readStatus: mapReadStatus(ea.status),
      progress: ea.progress,
      progressVolumes: ea.volumesOwned ?? 0,
      rating: toRating(ea.ratingTwenty),
      notes: ea.notes,
      private: ea.private,
      rereading: ea.reconsuming,
      rereadCount: ea.reconsumeCount,
      startedAt: ea.startedAt ? new Date(ea.startedAt) : null,
      completedAt: ea.finishedAt ? new Date(ea.finishedAt) : null,
      syncSource: "KITSU",
      kitsuSyncedAt: new Date(),
    },
  });
}

// ─── Public pull ──────────────────────────────────────────────────────────────

export async function pullKitsu(logId: string): Promise<void> {
  const tokenInfo = await getToken("KITSU");
  const token = tokenInfo?.accessToken;
  const username = tokenInfo?.username ?? process.env.KITSU_USERNAME ?? "";

  if (!username) throw new Error("No Kitsu username configured");

  const userId = await getUserId(username, token);

  const baseParams = `filter[userId]=${userId}&include={kind}&page[limit]=500`;

  // ── anime ──
  let animeUrl: string | null =
    `${KITSU_API}/library-entries?${baseParams.replace("{kind}", "anime")}` +
    `&filter[kind]=anime` +
    `&fields[libraryEntries]=status,progress,ratingTwenty,notes,private,reconsuming,reconsumeCount,startedAt,finishedAt,updatedAt,anime` +
    `&fields[anime]=canonicalTitle,titles,description,episodeCount,status,posterImage,coverImage,averageRating,startDate,endDate`;

  let animeSynced = 0;
  const errors: string[] = [];

  while (animeUrl) {
    const page: KitsuAnimeLibraryResponse =
      await fetchJson<KitsuAnimeLibraryResponse>(animeUrl, token);
    const map = new Map<string, KitsuAnime>(
      (page.included ?? []).map((a: KitsuAnime) => [a.id, a]),
    );
    for (const entry of page.data) {
      try {
        const anime = map.get(entry.relationships.anime.data.id) ?? null;
        await pullAnimeEntry(entry, anime);
        animeSynced++;
      } catch (e) {
        errors.push(
          `anime ${entry.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    animeUrl = page.links.next ?? null;
  }

  // ── manga ──
  let mangaUrl: string | null =
    `${KITSU_API}/library-entries?filter[userId]=${userId}&filter[kind]=manga` +
    `&include=manga` +
    `&page[limit]=500` +
    `&fields[libraryEntries]=status,progress,volumesOwned,ratingTwenty,notes,private,reconsuming,reconsumeCount,startedAt,finishedAt,updatedAt,manga` +
    `&fields[manga]=canonicalTitle,titles,description,chapterCount,volumeCount,status,posterImage,averageRating,startDate,endDate`;

  let mangaSynced = 0;

  while (mangaUrl) {
    const page: KitsuMangaLibraryResponse =
      await fetchJson<KitsuMangaLibraryResponse>(mangaUrl, token);
    const map = new Map<string, KitsuManga>(
      (page.included ?? []).map((m: KitsuManga) => [m.id, m]),
    );
    for (const entry of page.data) {
      try {
        const manga = map.get(entry.relationships.manga.data.id) ?? null;
        await pullMangaEntry(entry, manga);
        mangaSynced++;
      } catch (e) {
        errors.push(
          `manga ${entry.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    mangaUrl = page.links.next ?? null;
  }

  await prisma.syncLog.update({
    where: { id: logId },
    data: {
      status: errors.length ? "FAILED" : "COMPLETED",
      animeSynced,
      mangaSynced,
      errors,
      finishedAt: new Date(),
    },
  });
}

// ─── Push ─────────────────────────────────────────────────────────────────────

export async function pushKitsu(logId: string): Promise<void> {
  const tokenInfo = await getToken("KITSU");
  if (!tokenInfo?.accessToken)
    throw new Error("Not logged in to Kitsu — cannot push");

  const token = tokenInfo.accessToken;
  const errors: string[] = [];
  let animeSynced = 0;
  let mangaSynced = 0;

  // Push anime list entries that have a Kitsu entry ID
  const animeEntries = await prisma.animeListEntry.findMany({
    where: { kitsuEntryId: { not: null } },
  });

  for (const entry of animeEntries) {
    try {
      await patchJson(
        `${KITSU_API}/library-entries/${entry.kitsuEntryId}`,
        {
          data: {
            id: entry.kitsuEntryId,
            type: "libraryEntries",
            attributes: {
              status: reverseWatchStatus(entry.watchStatus),
              progress: entry.progress,
              ratingTwenty: toKitsuRating(entry.rating),
              notes: entry.notes ?? "",
              private: entry.private,
              reconsuming: entry.rewatching,
              reconsumeCount: entry.rewatchCount,
            },
          },
        },
        token,
      );
      animeSynced++;
    } catch (e) {
      errors.push(
        `anime entry ${entry.kitsuEntryId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Push manga list entries
  const mangaEntries = await prisma.mangaListEntry.findMany({
    where: { kitsuEntryId: { not: null } },
  });

  for (const entry of mangaEntries) {
    try {
      await patchJson(
        `${KITSU_API}/library-entries/${entry.kitsuEntryId}`,
        {
          data: {
            id: entry.kitsuEntryId,
            type: "libraryEntries",
            attributes: {
              status: reverseReadStatus(entry.readStatus),
              progress: entry.progress,
              volumesOwned: entry.progressVolumes,
              ratingTwenty: toKitsuRating(entry.rating),
              notes: entry.notes ?? "",
              private: entry.private,
              reconsuming: entry.rereading,
              reconsumeCount: entry.rereadCount,
            },
          },
        },
        token,
      );
      mangaSynced++;
    } catch (e) {
      errors.push(
        `manga entry ${entry.kitsuEntryId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  await prisma.syncLog.update({
    where: { id: logId },
    data: {
      status: errors.length ? "FAILED" : "COMPLETED",
      animeSynced,
      mangaSynced,
      errors,
      finishedAt: new Date(),
    },
  });
}
