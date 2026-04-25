import { ReadStatus, ShowStatus, WatchStatus } from "@/generated/prisma/client";
import { getToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type {
  AniListFuzzyDate,
  AniListListResponse,
  AniListMedia,
  AniListMediaList,
  AniListMediaStatus,
  AniListStatus,
} from "./types";

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

// ─── GraphQL queries/mutations ────────────────────────────────────────────────

const LIST_QUERY = `
query GetMediaList($username: String, $type: MediaType, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage currentPage }
    mediaList(userName: $username, type: $type, sort: [UPDATED_TIME_DESC]) {
      id
      status
      progress
      progressVolumes
      score(format: POINT_10_DECIMAL)
      notes
      repeat
      private
      startedAt  { year month day }
      completedAt { year month day }
      updatedAt
      media {
        id idMal
        title { english romaji native }
        description(asHtml: false)
        episodes chapters volumes
        status
        coverImage { large medium }
        bannerImage
        averageScore
        startDate { year month day }
        endDate   { year month day }
      }
    }
  }
}`;

const UPDATE_MUTATION = `
mutation UpdateEntry(
  $id: Int
  $status: MediaListStatus
  $progress: Int
  $progressVolumes: Int
  $score: Float
  $notes: String
  $repeat: Int
  $private: Boolean
) {
  SaveMediaListEntry(
    id: $id
    status: $status
    progress: $progress
    progressVolumes: $progressVolumes
    score: $score
    notes: $notes
    repeat: $repeat
    private: $private
  ) { id }
}`;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(ANILIST_GRAPHQL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) {
    throw new Error(
      json.errors.map((e: { message: string }) => e.message).join("; "),
    );
  }
  return json as T;
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapWatchStatus(s: AniListStatus): WatchStatus {
  switch (s) {
    case "CURRENT":
    case "REPEATING":
      return WatchStatus.WATCHING;
    case "PLANNING":
      return WatchStatus.PLAN_TO_WATCH;
    case "COMPLETED":
      return WatchStatus.COMPLETED;
    case "PAUSED":
      return WatchStatus.ON_HOLD;
    case "DROPPED":
      return WatchStatus.DROPPED;
  }
}

function mapReadStatus(s: AniListStatus): ReadStatus {
  switch (s) {
    case "CURRENT":
    case "REPEATING":
      return ReadStatus.READING;
    case "PLANNING":
      return ReadStatus.PLAN_TO_READ;
    case "COMPLETED":
      return ReadStatus.COMPLETED;
    case "PAUSED":
      return ReadStatus.ON_HOLD;
    case "DROPPED":
      return ReadStatus.DROPPED;
  }
}

function mapShowStatus(s: AniListMediaStatus): ShowStatus {
  switch (s) {
    case "FINISHED":
      return ShowStatus.FINISHED;
    case "RELEASING":
      return ShowStatus.AIRING;
    case "NOT_YET_RELEASED":
      return ShowStatus.UPCOMING;
    case "CANCELLED":
      return ShowStatus.CANCELLED;
    case "HIATUS":
      return ShowStatus.UNKNOWN;
  }
}

function fuzzyToDate(fd: AniListFuzzyDate): Date | null {
  if (!fd?.year) return null;
  return new Date(fd.year, (fd.month ?? 1) - 1, fd.day ?? 1);
}

function reverseWatchStatus(s: WatchStatus): string {
  switch (s) {
    case WatchStatus.WATCHING:
      return "CURRENT";
    case WatchStatus.PLAN_TO_WATCH:
      return "PLANNING";
    case WatchStatus.COMPLETED:
      return "COMPLETED";
    case WatchStatus.ON_HOLD:
      return "PAUSED";
    case WatchStatus.DROPPED:
      return "DROPPED";
  }
}

function reverseReadStatus(s: ReadStatus): string {
  switch (s) {
    case ReadStatus.READING:
      return "CURRENT";
    case ReadStatus.PLAN_TO_READ:
      return "PLANNING";
    case ReadStatus.COMPLETED:
      return "COMPLETED";
    case ReadStatus.ON_HOLD:
      return "PAUSED";
    case ReadStatus.DROPPED:
      return "DROPPED";
  }
}

// ─── Pull helpers ─────────────────────────────────────────────────────────────

async function pullAnimeItem(item: AniListMediaList): Promise<void> {
  const { media } = item;
  const common = buildMediaCommon(media);

  const animeRecord = await prisma.anime.upsert({
    where: { anilistId: media.id },
    create: {
      anilistId: media.id,
      malId: media.idMal ?? null,
      ...common,
      episodeCount: media.episodes ?? null,
    },
    update: {
      malId: media.idMal ?? undefined,
      ...common,
      episodeCount: media.episodes ?? null,
    },
  });

  await prisma.animeListEntry.upsert({
    where: { animeId: animeRecord.id },
    create: {
      animeId: animeRecord.id,
      anilistEntryId: item.id,
      watchStatus: mapWatchStatus(item.status),
      progress: item.progress,
      rating: item.score > 0 ? item.score : null,
      notes: item.notes,
      private: item.private,
      rewatching: item.status === "REPEATING",
      rewatchCount: item.repeat,
      startedAt: fuzzyToDate(item.startedAt),
      completedAt: fuzzyToDate(item.completedAt),
      syncSource: "ANILIST",
      anilistSyncedAt: new Date(),
    },
    update: {
      anilistEntryId: item.id,
      watchStatus: mapWatchStatus(item.status),
      progress: item.progress,
      rating: item.score > 0 ? item.score : null,
      notes: item.notes,
      private: item.private,
      rewatching: item.status === "REPEATING",
      rewatchCount: item.repeat,
      startedAt: fuzzyToDate(item.startedAt),
      completedAt: fuzzyToDate(item.completedAt),
      syncSource: "ANILIST",
      anilistSyncedAt: new Date(),
    },
  });
}

async function pullMangaItem(item: AniListMediaList): Promise<void> {
  const { media } = item;
  const common = buildMediaCommon(media);

  const mangaRecord = await prisma.manga.upsert({
    where: { anilistId: media.id },
    create: {
      anilistId: media.id,
      malId: media.idMal ?? null,
      ...common,
      chapterCount: media.chapters ?? null,
      volumeCount: media.volumes ?? null,
    },
    update: {
      malId: media.idMal ?? undefined,
      ...common,
      chapterCount: media.chapters ?? null,
      volumeCount: media.volumes ?? null,
    },
  });

  await prisma.mangaListEntry.upsert({
    where: { mangaId: mangaRecord.id },
    create: {
      mangaId: mangaRecord.id,
      anilistEntryId: item.id,
      readStatus: mapReadStatus(item.status),
      progress: item.progress,
      progressVolumes: item.progressVolumes ?? 0,
      rating: item.score > 0 ? item.score : null,
      notes: item.notes,
      private: item.private,
      rereading: item.status === "REPEATING",
      rereadCount: item.repeat,
      startedAt: fuzzyToDate(item.startedAt),
      completedAt: fuzzyToDate(item.completedAt),
      syncSource: "ANILIST",
      anilistSyncedAt: new Date(),
    },
    update: {
      anilistEntryId: item.id,
      readStatus: mapReadStatus(item.status),
      progress: item.progress,
      progressVolumes: item.progressVolumes ?? 0,
      rating: item.score > 0 ? item.score : null,
      notes: item.notes,
      private: item.private,
      rereading: item.status === "REPEATING",
      rereadCount: item.repeat,
      startedAt: fuzzyToDate(item.startedAt),
      completedAt: fuzzyToDate(item.completedAt),
      syncSource: "ANILIST",
      anilistSyncedAt: new Date(),
    },
  });
}

function buildMediaCommon(media: AniListMedia) {
  return {
    titleEn: media.title.english ?? media.title.romaji ?? null,
    titleJp: media.title.native ?? null,
    titleRomaji: media.title.romaji ?? null,
    synopsis: media.description ?? null,
    coverImageUrl: media.coverImage.large ?? media.coverImage.medium ?? null,
    bannerImageUrl: media.bannerImage ?? null,
    showStatus: mapShowStatus(media.status),
    averageRating: media.averageScore ? media.averageScore / 10 : null,
    startDate: fuzzyToDate(media.startDate),
    endDate: fuzzyToDate(media.endDate),
  };
}

// ─── Public pull ──────────────────────────────────────────────────────────────

export async function pullAniList(logId: string): Promise<void> {
  const tokenInfo = await getToken("ANILIST");
  const token = tokenInfo?.accessToken;
  const username = tokenInfo?.username ?? process.env.ANILIST_USERNAME ?? "";

  if (!username) throw new Error("No AniList username configured");

  const errors: string[] = [];
  let animeSynced = 0;
  let mangaSynced = 0;

  for (const type of ["ANIME", "MANGA"] as const) {
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const resp = await gql<AniListListResponse>(
        LIST_QUERY,
        { username, type, page },
        token,
      );
      const pageData = resp.data.Page;

      for (const item of pageData.mediaList) {
        try {
          if (type === "ANIME") {
            await pullAnimeItem(item);
            animeSynced++;
          } else {
            await pullMangaItem(item);
            mangaSynced++;
          }
        } catch (e) {
          errors.push(
            `${type.toLowerCase()} ${item.media.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      hasNext = pageData.pageInfo.hasNextPage;
      page++;
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

// ─── Public push ──────────────────────────────────────────────────────────────

export async function pushAniList(logId: string): Promise<void> {
  const tokenInfo = await getToken("ANILIST");
  if (!tokenInfo?.accessToken)
    throw new Error("Not logged in to AniList — cannot push");

  const token = tokenInfo.accessToken;
  const errors: string[] = [];
  let animeSynced = 0;
  let mangaSynced = 0;

  const animeEntries = await prisma.animeListEntry.findMany({
    where: { anilistEntryId: { not: null } },
  });

  for (const entry of animeEntries) {
    try {
      await gql(
        UPDATE_MUTATION,
        {
          id: entry.anilistEntryId,
          status: reverseWatchStatus(entry.watchStatus),
          progress: entry.progress,
          score: entry.rating ?? 0,
          notes: entry.notes ?? "",
          repeat: entry.rewatchCount,
          private: entry.private,
        },
        token,
      );
      animeSynced++;
    } catch (e) {
      errors.push(
        `anime entry ${entry.anilistEntryId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const mangaEntries = await prisma.mangaListEntry.findMany({
    where: { anilistEntryId: { not: null } },
  });

  for (const entry of mangaEntries) {
    try {
      await gql(
        UPDATE_MUTATION,
        {
          id: entry.anilistEntryId,
          status: reverseReadStatus(entry.readStatus),
          progress: entry.progress,
          progressVolumes: entry.progressVolumes,
          score: entry.rating ?? 0,
          notes: entry.notes ?? "",
          repeat: entry.rereadCount,
          private: entry.private,
        },
        token,
      );
      mangaSynced++;
    } catch (e) {
      errors.push(
        `manga entry ${entry.anilistEntryId}: ${e instanceof Error ? e.message : String(e)}`,
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
