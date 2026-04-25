import { ShowStatus, WatchStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type {
  AniListMediaList,
  AniListMediaStatus,
  AniListResponse,
  AniListStatus,
} from "./types";

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

const QUERY = `
query GetAnimeList($username: String, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
      currentPage
    }
    mediaList(userName: $username, type: ANIME, sort: [UPDATED_TIME_DESC]) {
      id
      status
      progress
      score(format: POINT_10_DECIMAL)
      notes
      repeat
      private
      startedAt { year month day }
      completedAt { year month day }
      updatedAt
      media {
        id
        idMal
        title { english romaji native }
        episodes
        status
        coverImage { large medium }
      }
    }
  }
}`;

async function fetchPage(
  username: string,
  page: number,
): Promise<AniListResponse["data"]["Page"]> {
  const res = await fetch(ANILIST_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { username, page } }),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`AniList API error ${res.status}`);
  }

  const json = (await res.json()) as AniListResponse;

  if (!json.data?.Page) {
    throw new Error("Unexpected AniList response shape");
  }

  return json.data.Page;
}

function mapWatchStatus(status: AniListStatus): WatchStatus {
  switch (status) {
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

function mapShowStatus(status: AniListMediaStatus): ShowStatus {
  switch (status) {
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

function fuzzyDateToDate(fd: AniListMediaList["startedAt"]): Date | null {
  if (!fd.year) return null;
  return new Date(fd.year, (fd.month ?? 1) - 1, fd.day ?? 1);
}

async function upsertEntry(item: AniListMediaList): Promise<void> {
  const { media } = item;

  const titleEn = media.title.english ?? media.title.romaji ?? null;
  const titleRomaji = media.title.romaji ?? null;
  const titleJp = media.title.native ?? null;
  const coverImageUrl =
    media.coverImage.large ?? media.coverImage.medium ?? null;

  await prisma.animeEntry.upsert({
    where: { anilistId: media.id },
    create: {
      anilistId: media.id,
      malId: media.idMal ?? null,
      titleEn,
      titleJp,
      titleRomaji,
      coverImageUrl,
      episodeCount: media.episodes ?? null,
      showStatus: mapShowStatus(media.status),
      watchStatus: mapWatchStatus(item.status),
      progress: item.progress,
      rating: item.score > 0 ? item.score : null,
      notes: item.notes,
      private: item.private,
      rewatching: item.status === "REPEATING",
      rewatchCount: item.repeat,
      startedAt: fuzzyDateToDate(item.startedAt),
      completedAt: fuzzyDateToDate(item.completedAt),
      syncSource: "ANILIST",
      anilistSyncedAt: new Date(),
    },
    update: {
      malId: media.idMal ?? undefined,
      titleEn,
      titleJp,
      titleRomaji,
      coverImageUrl,
      episodeCount: media.episodes ?? null,
      showStatus: mapShowStatus(media.status),
      watchStatus: mapWatchStatus(item.status),
      progress: item.progress,
      rating: item.score > 0 ? item.score : null,
      notes: item.notes,
      private: item.private,
      rewatching: item.status === "REPEATING",
      rewatchCount: item.repeat,
      startedAt: fuzzyDateToDate(item.startedAt),
      completedAt: fuzzyDateToDate(item.completedAt),
      syncSource: "ANILIST",
      anilistSyncedAt: new Date(),
    },
  });
}

export async function syncAniList(
  username: string,
): Promise<{ synced: number }> {
  let page = 1;
  let synced = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const pageData = await fetchPage(username, page);
    for (const item of pageData.mediaList) {
      await upsertEntry(item);
      synced++;
    }
    hasNextPage = pageData.pageInfo.hasNextPage;
    page++;
  }

  return { synced };
}
