import "server-only";
import { ReadStatus, ShowStatus, WatchStatus } from "@/generated/prisma/client";
import { getToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  type GraphQLTypes,
  MediaListStatus,
  MediaStatus,
} from "@/lib/zeus/anilist";
import { anilistThunder } from "./thunder";

function extractErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const msg = error.message;

  // Extract just the first meaningful line
  const lines = msg.split("\n").filter((line) => line.trim());
  let errorMsg = lines[0] || msg;

  // For Prisma "Invalid invocation" errors, extract the operation name
  if (errorMsg?.includes("Invalid")) {
    const match = errorMsg.match(/Invalid `(?:prisma\.)?(.+?)`/);
    if (match) {
      const operation = match[1].split(".").pop();
      return `Invalid ${operation}`;
    }
  }

  // Truncate if too long
  if (errorMsg.length > 100) {
    errorMsg = `${errorMsg.substring(0, 97)}...`;
  }

  return errorMsg || "Unknown error";
}

// ---------------------------------------------------------------------------
// Typed query helper — return type is inferred by TypeScript, no assertions.
// ---------------------------------------------------------------------------

function fetchAniListPage(
  username: string,
  type: GraphQLTypes["MediaType"],
  page: number,
) {
  return anilistThunder("query")({
    Page: [
      { page, perPage: 50 },
      {
        pageInfo: { hasNextPage: true, currentPage: true },
        mediaList: [
          {
            userName: username,
            type,
            sort: ["UPDATED_TIME_DESC" as GraphQLTypes["MediaListSort"]],
          },
          {
            id: true,
            status: true,
            progress: true,
            progressVolumes: true,
            score: [
              { format: "POINT_10_DECIMAL" as GraphQLTypes["ScoreFormat"] },
              true,
            ],
            notes: true,
            repeat: true,
            private: true,
            startedAt: { year: true, month: true, day: true },
            completedAt: { year: true, month: true, day: true },
            updatedAt: true,
            media: {
              id: true,
              idMal: true,
              title: {
                english: [{}, true],
                romaji: [{}, true],
                native: [{}, true],
              },
              description: [{ asHtml: false }, true],
              episodes: true,
              chapters: true,
              volumes: true,
              status: [{}, true],
              coverImage: { large: true, medium: true },
              bannerImage: true,
              averageScore: true,
              startDate: { year: true, month: true, day: true },
              endDate: { year: true, month: true, day: true },
            },
          },
        ],
      },
    ],
  });
}

type AniListPageResult = Awaited<ReturnType<typeof fetchAniListPage>>;
type AniListPageData = NonNullable<AniListPageResult["Page"]>;
type AniListListItem = NonNullable<AniListPageData["mediaList"]>[number];
type AniListMediaItem = NonNullable<AniListListItem["media"]>;
type FuzzyDate =
  | { year?: number | null; month?: number | null; day?: number | null }
  | null
  | undefined;

// ---------------------------------------------------------------------------
// Status mappers
// ---------------------------------------------------------------------------

function mapWatchStatus(s: MediaListStatus | null | undefined): WatchStatus {
  switch (s) {
    case MediaListStatus.CURRENT:
    case MediaListStatus.REPEATING:
      return WatchStatus.WATCHING;
    case MediaListStatus.PLANNING:
      return WatchStatus.PLAN_TO_WATCH;
    case MediaListStatus.COMPLETED:
      return WatchStatus.COMPLETED;
    case MediaListStatus.PAUSED:
      return WatchStatus.ON_HOLD;
    case MediaListStatus.DROPPED:
      return WatchStatus.DROPPED;
    default:
      return WatchStatus.PLAN_TO_WATCH;
  }
}

function mapReadStatus(s: MediaListStatus | null | undefined): ReadStatus {
  switch (s) {
    case MediaListStatus.CURRENT:
    case MediaListStatus.REPEATING:
      return ReadStatus.READING;
    case MediaListStatus.PLANNING:
      return ReadStatus.PLAN_TO_READ;
    case MediaListStatus.COMPLETED:
      return ReadStatus.COMPLETED;
    case MediaListStatus.PAUSED:
      return ReadStatus.ON_HOLD;
    case MediaListStatus.DROPPED:
      return ReadStatus.DROPPED;
    default:
      return ReadStatus.PLAN_TO_READ;
  }
}

function mapShowStatus(s: MediaStatus | null | undefined): ShowStatus {
  switch (s) {
    case MediaStatus.FINISHED:
      return ShowStatus.FINISHED;
    case MediaStatus.RELEASING:
      return ShowStatus.AIRING;
    case MediaStatus.NOT_YET_RELEASED:
      return ShowStatus.UPCOMING;
    case MediaStatus.CANCELLED:
      return ShowStatus.CANCELLED;
    case MediaStatus.HIATUS:
      return ShowStatus.UNKNOWN;
    default:
      return ShowStatus.UNKNOWN;
  }
}

function fuzzyToDate(fd: FuzzyDate): Date | null {
  if (!fd?.year) return null;
  return new Date(fd.year, (fd.month ?? 1) - 1, fd.day ?? 1);
}

function reverseWatchStatus(s: WatchStatus): MediaListStatus {
  switch (s) {
    case WatchStatus.WATCHING:
      return MediaListStatus.CURRENT;
    case WatchStatus.PLAN_TO_WATCH:
      return MediaListStatus.PLANNING;
    case WatchStatus.COMPLETED:
      return MediaListStatus.COMPLETED;
    case WatchStatus.ON_HOLD:
      return MediaListStatus.PAUSED;
    case WatchStatus.DROPPED:
      return MediaListStatus.DROPPED;
  }
}

function reverseReadStatus(s: ReadStatus): MediaListStatus {
  switch (s) {
    case ReadStatus.READING:
      return MediaListStatus.CURRENT;
    case ReadStatus.PLAN_TO_READ:
      return MediaListStatus.PLANNING;
    case ReadStatus.COMPLETED:
      return MediaListStatus.COMPLETED;
    case ReadStatus.ON_HOLD:
      return MediaListStatus.PAUSED;
    case ReadStatus.DROPPED:
      return MediaListStatus.DROPPED;
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function buildMediaCommon(media: AniListMediaItem) {
  return {
    titleEn: media.title?.english ?? media.title?.romaji ?? null,
    titleJp: media.title?.native ?? null,
    titleRomaji: media.title?.romaji ?? null,
    synopsis: media.description ?? null,
    coverImageUrl: media.coverImage?.large ?? media.coverImage?.medium ?? null,
    showStatus: mapShowStatus(media.status),
    averageRating: media.averageScore ? media.averageScore / 10 : null,
    startDate: fuzzyToDate(media.startDate),
    endDate: fuzzyToDate(media.endDate),
  };
}

async function pullAnimeItem(item: AniListListItem): Promise<boolean> {
  const media = item.media;
  if (!media) return false;
  const common = buildMediaCommon(media);
  const score = item.score ?? 0;
  const anilistUpdatedAt = item.updatedAt
    ? new Date((item.updatedAt as number) * 1000)
    : new Date();

  const sharedMedia = {
    anilistId: media.id,
    ...(media.idMal ? { malId: media.idMal } : {}),
    ...common,
    bannerImageUrl: media.bannerImage ?? null,
    episodeCount: media.episodes ?? null,
  };

  let animeRecord = await prisma.anime.findUnique({
    where: { anilistId: media.id },
  });
  if (!animeRecord && media.idMal)
    animeRecord = await prisma.anime.findUnique({
      where: { malId: media.idMal },
    });
  if (animeRecord) {
    animeRecord = await prisma.anime.update({
      where: { id: animeRecord.id },
      data: sharedMedia,
    });
  } else {
    animeRecord = await prisma.anime.create({ data: sharedMedia });
  }

  const existing = await prisma.animeListEntry.findUnique({
    where: { animeId: animeRecord.id },
  });

  const isNewer = !existing?.updatedAt || anilistUpdatedAt > existing.updatedAt;

  if (isNewer) {
    const entryData = {
      anilistEntryId: item.id,
      watchStatus: mapWatchStatus(item.status),
      progress: item.progress ?? 0,
      rating: score > 0 ? score : null,
      notes: item.notes ?? null,
      private: item.private ?? false,
      rewatching: item.status === MediaListStatus.REPEATING,
      rewatchCount: item.repeat ?? 0,
      startedAt: fuzzyToDate(item.startedAt),
      completedAt: fuzzyToDate(item.completedAt),
      updatedAt: anilistUpdatedAt,
    };

    await prisma.animeListEntry.upsert({
      where: { animeId: animeRecord.id },
      create: { animeId: animeRecord.id, ...entryData },
      update: entryData,
    });

    if (!existing) return false;

    return (
      existing.watchStatus !== entryData.watchStatus ||
      existing.progress !== entryData.progress ||
      existing.rating !== entryData.rating ||
      existing.notes !== entryData.notes ||
      existing.rewatchCount !== entryData.rewatchCount ||
      existing.rewatching !== entryData.rewatching
    );
  }

  // Not newer — only update the entry ID so push still works
  if (existing) {
    await prisma.animeListEntry.update({
      where: { animeId: animeRecord.id },
      data: { anilistEntryId: item.id },
    });
  }
  return false;
}

async function pullMangaItem(item: AniListListItem): Promise<boolean> {
  const media = item.media;
  if (!media) return false;
  const common = buildMediaCommon(media);
  const score = item.score ?? 0;
  const anilistUpdatedAt = item.updatedAt
    ? new Date((item.updatedAt as number) * 1000)
    : new Date();

  const sharedMedia = {
    anilistId: media.id,
    ...(media.idMal ? { malId: media.idMal } : {}),
    ...common,
    chapterCount: media.chapters ?? null,
    volumeCount: media.volumes ?? null,
  };

  let mangaRecord = await prisma.manga.findUnique({
    where: { anilistId: media.id },
  });
  if (!mangaRecord && media.idMal)
    mangaRecord = await prisma.manga.findUnique({
      where: { malId: media.idMal },
    });
  if (mangaRecord) {
    mangaRecord = await prisma.manga.update({
      where: { id: mangaRecord.id },
      data: sharedMedia,
    });
  } else {
    mangaRecord = await prisma.manga.create({ data: sharedMedia });
  }

  const existing = await prisma.mangaListEntry.findUnique({
    where: { mangaId: mangaRecord.id },
  });

  const isNewer = !existing?.updatedAt || anilistUpdatedAt > existing.updatedAt;

  if (isNewer) {
    const entryData = {
      anilistEntryId: item.id,
      readStatus: mapReadStatus(item.status),
      progress: item.progress ?? 0,
      progressVolumes: item.progressVolumes ?? 0,
      rating: score > 0 ? score : null,
      notes: item.notes ?? null,
      private: item.private ?? false,
      rereading: item.status === MediaListStatus.REPEATING,
      rereadCount: item.repeat ?? 0,
      startedAt: fuzzyToDate(item.startedAt),
      completedAt: fuzzyToDate(item.completedAt),
      updatedAt: anilistUpdatedAt,
    };

    await prisma.mangaListEntry.upsert({
      where: { mangaId: mangaRecord.id },
      create: { mangaId: mangaRecord.id, ...entryData },
      update: entryData,
    });

    if (!existing) return false;

    return (
      existing.readStatus !== entryData.readStatus ||
      existing.progress !== entryData.progress ||
      existing.rating !== entryData.rating ||
      existing.notes !== entryData.notes ||
      existing.rereadCount !== entryData.rereadCount ||
      existing.rereading !== entryData.rereading
    );
  }

  // Not newer — only update the entry ID so push still works
  if (existing) {
    await prisma.mangaListEntry.update({
      where: { mangaId: mangaRecord.id },
      data: { anilistEntryId: item.id },
    });
  }
  return false;
}

// ---------------------------------------------------------------------------
// Exported sync functions
// ---------------------------------------------------------------------------

export async function pullAniList(logId: string): Promise<void> {
  const tokenInfo = await getToken("ANILIST");
  const username =
    tokenInfo?.username ?? process.env.NEXT_PUBLIC_ANILIST_USERNAME ?? "";

  if (!username) throw new Error("No AniList username configured");

  const errors: string[] = [];
  let animeSynced = 0;
  let animeChanged = 0;
  let mangaSynced = 0;
  let mangaChanged = 0;

  for (const type of ["ANIME", "MANGA"] as const) {
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const result = await fetchAniListPage(
        username,
        type as GraphQLTypes["MediaType"],
        page,
      );
      const pageData = result.Page;
      if (!pageData) break;

      for (const item of pageData.mediaList ?? []) {
        try {
          if (type === "ANIME") {
            const wasChanged = await pullAnimeItem(item);
            animeSynced++;
            if (wasChanged) animeChanged++;
          } else {
            const wasChanged = await pullMangaItem(item);
            mangaSynced++;
            if (wasChanged) mangaChanged++;
          }
        } catch (e) {
          const fullMsg = e instanceof Error ? e.message : String(e);
          const shortMsg = extractErrorMessage(e);
          console.error(
            `Failed to pull ${type.toLowerCase()} ${item.media?.id}:`,
            fullMsg,
          );
          errors.push(`${type.toLowerCase()} ${item.media?.id}: ${shortMsg}`);
        }
      }

      hasNext = pageData.pageInfo?.hasNextPage ?? false;
      page++;
    }
  }

  const total = animeSynced + mangaSynced;
  const changed = animeChanged + mangaChanged;
  console.log(
    `[AniList Pull] Synced ${total} entries (${changed} changed): ${animeSynced} anime, ${mangaSynced} manga`,
  );

  await prisma.syncLog.update({
    where: { id: logId },
    data: {
      status: errors.length ? "FAILED" : "COMPLETED",
      animeSynced,
      mangaSynced,
      animeChanged,
      mangaChanged,
      errors,
      finishedAt: new Date(),
    },
  });
}

type AniListRemoteEntry = {
  title: string;
  status: AniListListItem["status"];
  progress: number | null | undefined;
  progressVolumes: number | null | undefined;
  score: number | null | undefined;
  notes: string | null | undefined;
  repeat: number | null | undefined;
  private: boolean | null | undefined;
};

async function scanAniListEntries(
  username: string,
  type: GraphQLTypes["MediaType"],
): Promise<Map<number, AniListRemoteEntry>> {
  const map = new Map<number, AniListRemoteEntry>();
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const result = await fetchAniListPage(username, type, page);
    const pageData = result.Page;
    if (!pageData) break;
    for (const item of pageData.mediaList ?? []) {
      if (item.id == null) continue;
      map.set(item.id, {
        title:
          item.media?.title?.english ??
          item.media?.title?.romaji ??
          String(item.id),
        status: item.status,
        progress: item.progress,
        progressVolumes: item.progressVolumes,
        score: item.score,
        notes: item.notes,
        repeat: item.repeat,
        private: item.private,
      });
    }
    hasNext = pageData.pageInfo?.hasNextPage ?? false;
    page++;
  }
  return map;
}

function anilistAnimeNeedsUpdate(
  local: {
    watchStatus: WatchStatus;
    progress: number;
    rating: number | null;
    notes: string | null;
    rewatchCount: number;
    private: boolean;
  },
  remote: AniListRemoteEntry,
): boolean {
  const remoteRating = (remote.score ?? 0) > 0 ? (remote.score ?? null) : null;
  return (
    mapWatchStatus(remote.status) !== local.watchStatus ||
    (remote.progress ?? 0) !== local.progress ||
    remoteRating !== local.rating ||
    (remote.notes || null) !== local.notes ||
    (remote.repeat ?? 0) !== local.rewatchCount ||
    (remote.private ?? false) !== local.private
  );
}

function anilistMangaNeedsUpdate(
  local: {
    readStatus: ReadStatus;
    progress: number;
    progressVolumes: number;
    rating: number | null;
    notes: string | null;
    rereadCount: number;
    private: boolean;
  },
  remote: AniListRemoteEntry,
): boolean {
  const remoteRating = (remote.score ?? 0) > 0 ? (remote.score ?? null) : null;
  return (
    mapReadStatus(remote.status) !== local.readStatus ||
    (remote.progress ?? 0) !== local.progress ||
    (remote.progressVolumes ?? 0) !== local.progressVolumes ||
    remoteRating !== local.rating ||
    (remote.notes || null) !== local.notes ||
    (remote.repeat ?? 0) !== local.rereadCount ||
    (remote.private ?? false) !== local.private
  );
}

// ---------------------------------------------------------------------------
// Batch mutation helper — bypasses Zeus to send multiple aliased mutations
// in a single HTTP request, with 429 retry.
// ---------------------------------------------------------------------------

const ANILIST_API_URL =
  process.env.ANILIST_API_URL ?? "https://graphql.anilist.co";
const PUSH_CHUNK_SIZE = 10;

async function batchAniListMutation(
  query: string,
  variables: Record<string, unknown>,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

    if (res.status === 429) {
      const raw = res.headers.get("Retry-After");
      const parsed = raw != null ? parseInt(raw, 10) : Number.NaN;
      const wait = Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
      console.warn(
        `[AniList] Rate limited — waiting ${wait}s (attempt ${attempt}/${MAX_RETRIES})`,
      );
      if (attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "(unreadable)");
      console.error(
        `[AniList] HTTP ${res.status} — query preview:\n${query.slice(0, 500)}`,
      );
      console.error(`[AniList] Response body: ${text}`);
      throw new Error(`AniList HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as {
      data?: Record<string, unknown>;
      errors?: { message: string }[];
    };
    if (body.errors?.length)
      throw new Error(body.errors.map((e) => e.message).join("; "));
    return body.data ?? {};
  }
  throw new Error("AniList rate limit: exceeded retry limit");
}

interface SaveArgs {
  id?: number;
  mediaId?: number;
  status: string;
  progress: number;
  progressVolumes?: number;
  score: number;
  notes: string;
  repeat: number;
  private: boolean;
}

interface SaveOp {
  alias: string;
  args: SaveArgs;
  isCreate: boolean;
  localEntryId: string | null;
  mediaType: "anime" | "manga";
}

interface DeleteOp {
  alias: string;
  entryId: number;
  title: string;
  mediaType: "anime" | "manga";
}

function buildSaveBatch(ops: SaveOp[]): {
  query: string;
  variables: Record<string, unknown>;
} {
  const varDecls: string[] = [];
  const selections: string[] = [];
  const variables: Record<string, unknown> = {};

  for (let i = 0; i < ops.length; i++) {
    const { alias, args } = ops[i];
    const argParts: string[] = [];

    if (args.id != null) {
      varDecls.push(`$id_${i}: Int`);
      variables[`id_${i}`] = args.id;
      argParts.push(`id: $id_${i}`);
    } else if (args.mediaId != null) {
      varDecls.push(`$mediaId_${i}: Int`);
      variables[`mediaId_${i}`] = args.mediaId;
      argParts.push(`mediaId: $mediaId_${i}`);
    }

    varDecls.push(`$status_${i}: MediaListStatus`);
    variables[`status_${i}`] = args.status;
    argParts.push(`status: $status_${i}`);

    varDecls.push(`$progress_${i}: Int`);
    variables[`progress_${i}`] = args.progress;
    argParts.push(`progress: $progress_${i}`);

    if (args.progressVolumes != null) {
      varDecls.push(`$progressVolumes_${i}: Int`);
      variables[`progressVolumes_${i}`] = args.progressVolumes;
      argParts.push(`progressVolumes: $progressVolumes_${i}`);
    }

    varDecls.push(`$score_${i}: Float`);
    variables[`score_${i}`] = args.score;
    argParts.push(`score: $score_${i}`);

    varDecls.push(`$notes_${i}: String`);
    variables[`notes_${i}`] = args.notes;
    argParts.push(`notes: $notes_${i}`);

    varDecls.push(`$repeat_${i}: Int`);
    variables[`repeat_${i}`] = args.repeat;
    argParts.push(`repeat: $repeat_${i}`);

    varDecls.push(`$private_${i}: Boolean`);
    variables[`private_${i}`] = args.private;
    argParts.push(`private: $private_${i}`);

    selections.push(
      `${alias}: SaveMediaListEntry(${argParts.join(", ")}) { id }`,
    );
  }

  const query = `mutation SaveBatch(${varDecls.join(", ")}) {\n${selections.join("\n")}\n}`;
  return { query, variables };
}

function buildDeleteBatch(ops: DeleteOp[]): {
  query: string;
  variables: Record<string, unknown>;
} {
  const varDecls: string[] = [];
  const selections: string[] = [];
  const variables: Record<string, unknown> = {};

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    varDecls.push(`$id_${i}: Int`);
    variables[`id_${i}`] = op.entryId;
    selections.push(
      `${op.alias}: DeleteMediaListEntry(id: $id_${i}) { deleted }`,
    );
  }

  const query = `mutation DeleteBatch(${varDecls.join(", ")}) {\n${selections.join("\n")}\n}`;
  return { query, variables };
}

export async function pushAniList(logId: string): Promise<void> {
  const tokenInfo = await getToken("ANILIST");
  if (!tokenInfo?.accessToken)
    throw new Error("Not logged in to AniList — cannot push");

  const username =
    tokenInfo.username ?? process.env.NEXT_PUBLIC_ANILIST_USERNAME ?? "";
  if (!username) throw new Error("No AniList username configured");
  const accessToken = tokenInfo.accessToken;

  const errors: string[] = [];
  const deletions: string[] = [];
  let animeSynced = 0;
  let animeChanged = 0;
  let mangaSynced = 0;
  let mangaChanged = 0;

  // ── Phase 1: Scan remote + load local in parallel ─────────────────────────

  const [remoteAnimeMap, remoteMangaMap, animeEntries, mangaEntries] =
    await Promise.all([
      scanAniListEntries(username, "ANIME" as GraphQLTypes["MediaType"]),
      scanAniListEntries(username, "MANGA" as GraphQLTypes["MediaType"]),
      prisma.animeListEntry.findMany({ include: { anime: true } }),
      prisma.mangaListEntry.findMany({ include: { manga: true } }),
    ]);

  // ── Phase 2: Build operation lists ────────────────────────────────────────

  const saveOps: SaveOp[] = [];
  const deleteOps: DeleteOp[] = [];

  for (const entry of animeEntries) {
    const alias = `s${saveOps.length}`;
    const animeArgs = {
      status: reverseWatchStatus(entry.watchStatus),
      progress: entry.progress,
      score: entry.rating ?? 0,
      notes: entry.notes ?? "",
      repeat: entry.rewatchCount,
      private: entry.private,
    };
    if (entry.anilistEntryId != null) {
      const remote = remoteAnimeMap.get(entry.anilistEntryId);
      remoteAnimeMap.delete(entry.anilistEntryId);
      if (remote) {
        if (!anilistAnimeNeedsUpdate(entry, remote)) continue;
        saveOps.push({
          alias,
          args: { id: entry.anilistEntryId, ...animeArgs },
          isCreate: false,
          localEntryId: null,
          mediaType: "anime",
        });
      } else if (entry.anime.anilistId != null) {
        // Stale entry ID — not found on remote; recreate by mediaId
        saveOps.push({
          alias,
          args: { mediaId: entry.anime.anilistId, ...animeArgs },
          isCreate: true,
          localEntryId: entry.id,
          mediaType: "anime",
        });
      }
    } else if (entry.anime.anilistId != null) {
      saveOps.push({
        alias,
        args: { mediaId: entry.anime.anilistId, ...animeArgs },
        isCreate: true,
        localEntryId: entry.id,
        mediaType: "anime",
      });
    }
  }

  for (const entry of mangaEntries) {
    const alias = `s${saveOps.length}`;
    const mangaArgs = {
      status: reverseReadStatus(entry.readStatus),
      progress: entry.progress,
      progressVolumes: entry.progressVolumes,
      score: entry.rating ?? 0,
      notes: entry.notes ?? "",
      repeat: entry.rereadCount,
      private: entry.private,
    };
    if (entry.anilistEntryId != null) {
      const remote = remoteMangaMap.get(entry.anilistEntryId);
      remoteMangaMap.delete(entry.anilistEntryId);
      if (remote) {
        if (!anilistMangaNeedsUpdate(entry, remote)) continue;
        saveOps.push({
          alias,
          args: { id: entry.anilistEntryId, ...mangaArgs },
          isCreate: false,
          localEntryId: null,
          mediaType: "manga",
        });
      } else if (entry.manga.anilistId != null) {
        // Stale entry ID — not found on remote; recreate by mediaId
        saveOps.push({
          alias,
          args: { mediaId: entry.manga.anilistId, ...mangaArgs },
          isCreate: true,
          localEntryId: entry.id,
          mediaType: "manga",
        });
      }
    } else if (entry.manga.anilistId != null) {
      saveOps.push({
        alias,
        args: { mediaId: entry.manga.anilistId, ...mangaArgs },
        isCreate: true,
        localEntryId: entry.id,
        mediaType: "manga",
      });
    }
  }

  for (const [entryId, { title }] of remoteAnimeMap) {
    deleteOps.push({
      alias: `d${deleteOps.length}`,
      entryId,
      title,
      mediaType: "anime",
    });
  }
  for (const [entryId, { title }] of remoteMangaMap) {
    deleteOps.push({
      alias: `d${deleteOps.length}`,
      entryId,
      title,
      mediaType: "manga",
    });
  }

  // ── Phase 3: Execute in batches ───────────────────────────────────────────

  for (let i = 0; i < saveOps.length; i += PUSH_CHUNK_SIZE) {
    const chunk = saveOps.slice(i, i + PUSH_CHUNK_SIZE);
    const { query, variables } = buildSaveBatch(chunk);
    let result: Record<string, unknown> = {};
    try {
      result = await batchAniListMutation(query, variables, accessToken);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg.includes("AniList HTTP 400") && chunk.length > 1) {
        // Retry individually to isolate bad entries without losing the whole chunk
        for (const op of chunk) {
          const { query: q, variables: v } = buildSaveBatch([
            { ...op, alias: "s0" },
          ]);
          try {
            const r = await batchAniListMutation(q, v, accessToken);
            result[op.alias] = (r as Record<string, unknown>).s0;
          } catch (ie) {
            errors.push(`save ${op.alias}: ${extractErrorMessage(ie)}`);
            result[op.alias] = null;
          }
        }
      } else {
        errors.push(
          `save batch ${i / PUSH_CHUNK_SIZE + 1}: ${extractErrorMessage(e)}`,
        );
        continue;
      }
    }

    const dbUpdates: Promise<unknown>[] = [];
    for (const op of chunk) {
      if (op.isCreate && op.localEntryId) {
        const newId = (result[op.alias] as { id?: number } | null)?.id;
        if (newId != null) {
          if (op.mediaType === "anime") {
            dbUpdates.push(
              prisma.animeListEntry.update({
                where: { id: op.localEntryId },
                data: { anilistEntryId: newId },
              }),
            );
          } else {
            dbUpdates.push(
              prisma.mangaListEntry.update({
                where: { id: op.localEntryId },
                data: { anilistEntryId: newId },
              }),
            );
          }
        }
      }
      if (op.mediaType === "anime") {
        animeSynced++;
        animeChanged++;
      } else {
        mangaSynced++;
        mangaChanged++;
      }
    }
    await Promise.all(dbUpdates);
  }

  for (let i = 0; i < deleteOps.length; i += PUSH_CHUNK_SIZE) {
    const chunk = deleteOps.slice(i, i + PUSH_CHUNK_SIZE);
    const { query, variables } = buildDeleteBatch(chunk);
    try {
      await batchAniListMutation(query, variables, accessToken);
    } catch (e) {
      errors.push(
        `delete batch ${i / PUSH_CHUNK_SIZE + 1}: ${extractErrorMessage(e)}`,
      );
      continue;
    }
    for (const op of chunk) {
      const msg = `${op.mediaType} "${op.title}" (AniList entry ${op.entryId})`;
      console.log(`[AniList Push] Deleted ${msg}`);
      deletions.push(msg);
      if (op.mediaType === "anime") animeChanged++;
      else mangaChanged++;
    }
  }

  const total = animeSynced + mangaSynced;
  const changed = animeChanged + mangaChanged;
  console.log(
    `[AniList Push] Synced ${total} entries (${changed} changed, ${deletions.length} deleted): ${animeSynced} anime, ${mangaSynced} manga`,
  );

  await prisma.syncLog.update({
    where: { id: logId },
    data: {
      status: errors.length ? "FAILED" : "COMPLETED",
      animeSynced,
      mangaSynced,
      animeChanged,
      mangaChanged,
      errors,
      deletions,
      finishedAt: new Date(),
    },
  });
}
