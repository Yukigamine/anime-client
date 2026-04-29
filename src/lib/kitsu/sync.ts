import "server-only";
import { ReadStatus, ShowStatus, WatchStatus } from "@/generated/prisma/client";
import { getToken } from "@/lib/auth";
import { ensureValidKitsuToken } from "@/lib/kitsu/auth";
import { kitsuFetch } from "@/lib/kitsu/stealth";
import prisma from "@/lib/prisma";
import {
  validateAnimeListEntry,
  validateMangaListEntry,
  validateMediaRecord,
} from "@/lib/validation";
import {
  type GraphQLTypes,
  LibraryEntryStatusEnum,
  MappingExternalSiteEnum,
} from "@/lib/zeus/kitsu";
import { kitsuThunder } from "./thunder";

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

function queryKitsuLibrary(
  slug: string,
  type: GraphQLTypes["MediaTypeEnum"],
  after?: string,
) {
  return kitsuThunder("query")({
    findProfileBySlug: [
      { slug },
      {
        library: {
          all: [
            { first: 100, after, mediaType: type },
            {
              pageInfo: { endCursor: true, hasNextPage: true },
              nodes: {
                id: true,
                notes: true,
                private: true,
                progress: true,
                rating: true,
                reconsumeCount: true,
                reconsuming: true,
                status: true,
                updatedAt: true,
                media: {
                  id: true,
                  slug: true,
                  status: true,
                  startDate: true,
                  endDate: true,
                  averageRating: true,
                  description: [{ locales: ["en", "en_jp"] }, true],
                  posterImage: {
                    original: { url: true },
                    views: [{ names: ["medium", "small"] }, { url: true }],
                  },
                  bannerImage: { original: { url: true } },
                  titles: {
                    canonical: true,
                    translated: true,
                    romanized: true,
                    original: true,
                  },
                  "...on Anime": { episodeCount: true },
                  "...on Manga": { chapterCount: true, volumeCount: true },
                  mappings: [
                    { first: 5 },
                    { nodes: { externalId: true, externalSite: true } },
                  ],
                },
              },
            },
          ],
        },
      },
    ],
  });
}

type KitsuLibraryResult = Awaited<ReturnType<typeof queryKitsuLibrary>>;
type KitsuAllPage = NonNullable<
  NonNullable<
    NonNullable<KitsuLibraryResult["findProfileBySlug"]>["library"]
  >["all"]
>;
type KitsuLibraryNode = NonNullable<KitsuAllPage["nodes"]>[number];
type KitsuMedia = NonNullable<KitsuLibraryNode["media"]>;

// Helper to fetch media details by ID and type to get episode/chapter count
async function fetchKitsuMediaDetails(
  mediaId: string,
  type: "ANIME" | "MANGA",
): Promise<{
  episodeCount?: number | null;
  chapterCount?: number | null;
} | null> {
  try {
    const result = await kitsuThunder("query")({
      findMediaByIdAndType: [
        { id: mediaId, mediaType: type as GraphQLTypes["MediaTypeEnum"] },
        {
          id: true,
          "...on Anime": { episodeCount: true },
          "...on Manga": { chapterCount: true },
        },
      ],
    });
    return result.findMediaByIdAndType ?? null;
  } catch (e) {
    console.error(
      `Failed to fetch Kitsu media ${mediaId}:`,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Field-mapping helpers
// ---------------------------------------------------------------------------

function mapWatchStatus(s: string | null | undefined): WatchStatus {
  switch (s) {
    case "CURRENT":
      return WatchStatus.WATCHING;
    case "PLANNED":
      return WatchStatus.PLAN_TO_WATCH;
    case "COMPLETED":
      return WatchStatus.COMPLETED;
    case "ON_HOLD":
      return WatchStatus.ON_HOLD;
    case "DROPPED":
      return WatchStatus.DROPPED;
    default:
      return WatchStatus.PLAN_TO_WATCH;
  }
}

function mapReadStatus(s: string | null | undefined): ReadStatus {
  switch (s) {
    case "CURRENT":
      return ReadStatus.READING;
    case "PLANNED":
      return ReadStatus.PLAN_TO_READ;
    case "COMPLETED":
      return ReadStatus.COMPLETED;
    case "ON_HOLD":
      return ReadStatus.ON_HOLD;
    case "DROPPED":
      return ReadStatus.DROPPED;
    default:
      return ReadStatus.PLAN_TO_READ;
  }
}

function reverseWatchStatus(s: WatchStatus): LibraryEntryStatusEnum {
  switch (s) {
    case WatchStatus.WATCHING:
      return LibraryEntryStatusEnum.CURRENT;
    case WatchStatus.PLAN_TO_WATCH:
      return LibraryEntryStatusEnum.PLANNED;
    case WatchStatus.COMPLETED:
      return LibraryEntryStatusEnum.COMPLETED;
    case WatchStatus.ON_HOLD:
      return LibraryEntryStatusEnum.ON_HOLD;
    case WatchStatus.DROPPED:
      return LibraryEntryStatusEnum.DROPPED;
  }
}

function reverseReadStatus(s: ReadStatus): LibraryEntryStatusEnum {
  switch (s) {
    case ReadStatus.READING:
      return LibraryEntryStatusEnum.CURRENT;
    case ReadStatus.PLAN_TO_READ:
      return LibraryEntryStatusEnum.PLANNED;
    case ReadStatus.COMPLETED:
      return LibraryEntryStatusEnum.COMPLETED;
    case ReadStatus.ON_HOLD:
      return LibraryEntryStatusEnum.ON_HOLD;
    case ReadStatus.DROPPED:
      return LibraryEntryStatusEnum.DROPPED;
  }
}

function mapShowStatus(s: string | null | undefined): ShowStatus {
  switch (s) {
    case "CURRENT":
      return ShowStatus.AIRING;
    case "FINISHED":
      return ShowStatus.FINISHED;
    case "UPCOMING":
    case "TBA":
    case "UNRELEASED":
      return ShowStatus.UPCOMING;
    default:
      return ShowStatus.UNKNOWN;
  }
}

// DB now uses 0-20 scale (matching Kitsu)
// For Kitsu API: must be Int (no decimals), range 2-20 (minimum 2), or null to unset
function toRating(rating: number | null | undefined): number | null {
  return rating ?? null;
}

function toKitsuRating(rating: number | null): number | null {
  if (rating == null || rating === 0) return null;
  // Round to integer and clamp to 2-20 range (Kitsu enforces minimum of 2)
  const rounded = Math.round(rating);
  return Math.max(2, Math.min(20, rounded));
}

function posterUrl(media: KitsuMedia): string | null {
  if (!media.posterImage) return null;
  const raw =
    media.posterImage.views?.[0]?.url ??
    media.posterImage.original?.url ??
    null;
  return raw ? raw.split("?")[0] : null;
}

function bannerUrl(media: KitsuMedia): string | null {
  const raw = media.bannerImage?.original?.url ?? null;
  return raw ? raw.split("?")[0] : null;
}

function titlesFrom(titles: KitsuMedia["titles"]) {
  return {
    titleEn: titles?.translated ?? titles?.canonical ?? "Unknown",
    titleRomaji: titles?.romanized ?? null,
    titleJp: titles?.original ?? null,
  };
}

function descriptionFrom(
  desc: string | Record<string, string> | null | undefined,
): string | null {
  if (!desc) return null;
  if (typeof desc === "string") return desc;
  return desc.en ?? desc.en_jp ?? null;
}

// ---------------------------------------------------------------------------
// External ID extraction from Kitsu mappings
// ---------------------------------------------------------------------------

type KitsuMappingNode = {
  externalId?: string | null;
  externalSite?: string | null;
};

function extractExternalIds(media: KitsuMedia): {
  anilistId: number | null;
  malId: number | null;
} {
  const mappings = (
    media as { mappings?: { nodes?: KitsuMappingNode[] | null } | null }
  ).mappings;
  const nodes = mappings?.nodes ?? [];
  let anilistId: number | null = null;
  let malId: number | null = null;
  for (const node of nodes) {
    if (!node.externalId) continue;
    if (
      node.externalSite === MappingExternalSiteEnum.ANILIST_ANIME ||
      node.externalSite === MappingExternalSiteEnum.ANILIST_MANGA
    ) {
      anilistId = parseInt(node.externalId, 10) || null;
    } else if (
      node.externalSite === MappingExternalSiteEnum.MYANIMELIST_ANIME ||
      node.externalSite === MappingExternalSiteEnum.MYANIMELIST_MANGA
    ) {
      malId = parseInt(node.externalId, 10) || null;
    }
  }
  return { anilistId, malId };
}

// ---------------------------------------------------------------------------
// Per-entry upsert helpers
// ---------------------------------------------------------------------------

async function pullAnimeEntry(node: KitsuLibraryNode): Promise<boolean> {
  const media = node.media;
  if (!media) return false;
  const titles = titlesFrom(media.titles);
  const { anilistId, malId } = extractExternalIds(media);

  // Validate media data before processing
  const mediaIssues = validateMediaRecord({
    anilistId,
    malId,
    titleEn: titles.titleEn,
  });
  if (mediaIssues.length > 0) {
    console.warn(
      `[Kitsu Pull] Skipping invalid anime ${media.id}: ${mediaIssues.join(", ")}`,
    );
    return false;
  }

  // Validate entry data (convert Kitsu rating from 0-20 to 0-10 scale first)
  const entryIssues = validateAnimeListEntry({
    progress: node.progress ?? 0,
    rating: toRating(node.rating) ?? null,
    rewatchCount: node.reconsumeCount ?? 0,
  });
  if (entryIssues.length > 0) {
    const convertedRating = toRating(node.rating);
    console.warn(
      `[Kitsu Pull] Skipping invalid anime entry for "${titles.titleEn}" (${media.id}): ${entryIssues.join(", ")}`,
    );
    console.warn(
      `  Raw rating from Kitsu: ${node.rating}, Converted to DB: ${convertedRating}, Progress: ${node.progress}, Rewatch count: ${node.reconsumeCount}`,
    );
    return false;
  }

  const kitsuUpdatedAt = node.updatedAt
    ? new Date(node.updatedAt as string)
    : new Date();

  const sharedMedia = {
    kitsuId: media.id as string,
    ...(anilistId ? { anilistId } : {}),
    ...(malId ? { malId } : {}),
    titleEn: titles.titleEn,
    titleJp: titles.titleJp,
    titleRomaji: titles.titleRomaji,
    synopsis: descriptionFrom(
      media.description as string | Record<string, string> | null | undefined,
    ),
    coverImageUrl: posterUrl(media),
    bannerImageUrl: bannerUrl(media),
    episodeCount:
      (media as { episodeCount?: number | null }).episodeCount ?? null,
    showStatus: mapShowStatus(media.status),
    averageRating: media.averageRating ?? null,
    startDate: media.startDate ? new Date(media.startDate as string) : null,
    endDate: media.endDate ? new Date(media.endDate as string) : null,
  };

  // Find existing record: kitsuId → anilistId → malId → create
  let animeRecord = await prisma.anime.findUnique({
    where: { kitsuId: media.id as string },
  });
  if (!animeRecord && anilistId) {
    animeRecord = await prisma.anime.findUnique({ where: { anilistId } });
  }
  if (!animeRecord && malId) {
    animeRecord = await prisma.anime.findUnique({ where: { malId } });
  }

  if (animeRecord) {
    // Preserve existing anilistId; don't overwrite with stale Kitsu value
    const updateData = { ...sharedMedia };
    if (animeRecord.anilistId) {
      delete updateData.anilistId;
    }

    animeRecord = await prisma.anime.update({
      where: { id: animeRecord.id },
      data: updateData,
    });
  } else {
    animeRecord = await prisma.anime.create({ data: sharedMedia });
  }

  const existing = await prisma.animeListEntry.findUnique({
    where: { animeId: animeRecord.id },
  });

  // Always record the kitsuEntryId; only overwrite tracking fields if Kitsu data is newer
  const isNewer = !existing?.updatedAt || kitsuUpdatedAt > existing.updatedAt;

  if (isNewer) {
    const entryData = {
      kitsuEntryId: node.id as string,
      watchStatus: mapWatchStatus(node.status),
      progress: node.progress ?? 0,
      rating: toRating(node.rating),
      notes: node.notes ?? null,
      private: node.private ?? false,
      rewatching: node.reconsuming ?? false,
      rewatchCount: node.reconsumeCount ?? 0,
      updatedAt: kitsuUpdatedAt,
    };
    await prisma.animeListEntry.upsert({
      where: { animeId: animeRecord.id },
      create: { animeId: animeRecord.id, ...entryData },
      update: entryData,
    });
  } else {
    // Newer data exists from another provider; only update the kitsuEntryId for push use
    await prisma.animeListEntry.update({
      where: { animeId: animeRecord.id },
      data: { kitsuEntryId: node.id as string },
    });
  }

  if (!existing) return false;
  if (!isNewer) return false;

  return (
    existing.watchStatus !== mapWatchStatus(node.status) ||
    existing.progress !== (node.progress ?? 0) ||
    existing.rating !== toRating(node.rating) ||
    existing.notes !== (node.notes ?? null) ||
    existing.rewatchCount !== (node.reconsumeCount ?? 0) ||
    existing.rewatching !== (node.reconsuming ?? false)
  );
}

async function pullMangaEntry(node: KitsuLibraryNode): Promise<boolean> {
  const media = node.media;
  if (!media) return false;
  const titles = titlesFrom(media.titles);
  const typedMedia = media as {
    chapterCount?: number | null;
    volumeCount?: number | null;
  } & KitsuMedia;
  const { anilistId, malId } = extractExternalIds(media);

  // Validate media data before processing
  const mediaIssues = validateMediaRecord({
    anilistId,
    malId,
    titleEn: titles.titleEn,
  });
  if (mediaIssues.length > 0) {
    console.warn(
      `[Kitsu Pull] Skipping invalid manga ${media.id}: ${mediaIssues.join(", ")}`,
    );
    return false;
  }

  // Validate entry data (convert Kitsu rating from 0-20 to 0-10 scale first)
  const entryIssues = validateMangaListEntry({
    progress: node.progress ?? 0,
    progressVolumes: 0,
    rating: toRating(node.rating) ?? null,
    rereadCount: node.reconsumeCount ?? 0,
  });
  if (entryIssues.length > 0) {
    const convertedRating = toRating(node.rating);
    console.warn(
      `[Kitsu Pull] Skipping invalid manga entry for "${titles.titleEn}" (${media.id}): ${entryIssues.join(", ")}`,
    );
    console.warn(
      `  Raw rating from Kitsu: ${node.rating}, Converted to DB: ${convertedRating}, Progress: ${node.progress}, Reread count: ${node.reconsumeCount}`,
    );
    return false;
  }

  const kitsuUpdatedAt = node.updatedAt
    ? new Date(node.updatedAt as string)
    : new Date();

  const sharedMedia = {
    kitsuId: media.id as string,
    ...(anilistId ? { anilistId } : {}),
    ...(malId ? { malId } : {}),
    titleEn: titles.titleEn,
    titleJp: titles.titleJp,
    titleRomaji: titles.titleRomaji,
    synopsis: descriptionFrom(
      media.description as string | Record<string, string> | null | undefined,
    ),
    coverImageUrl: posterUrl(media),
    chapterCount: typedMedia.chapterCount ?? null,
    volumeCount: typedMedia.volumeCount ?? null,
    showStatus: mapShowStatus(media.status),
    averageRating: media.averageRating ?? null,
    startDate: media.startDate ? new Date(media.startDate as string) : null,
    endDate: media.endDate ? new Date(media.endDate as string) : null,
  };

  // Find existing record: kitsuId → anilistId → malId → create
  let mangaRecord = await prisma.manga.findUnique({
    where: { kitsuId: media.id as string },
  });
  if (!mangaRecord && anilistId) {
    mangaRecord = await prisma.manga.findUnique({ where: { anilistId } });
  }
  if (!mangaRecord && malId) {
    mangaRecord = await prisma.manga.findUnique({ where: { malId } });
  }

  if (mangaRecord) {
    // Preserve existing anilistId; don't overwrite with stale Kitsu value
    const updateData = { ...sharedMedia };
    if (mangaRecord.anilistId) {
      delete updateData.anilistId;
    }

    mangaRecord = await prisma.manga.update({
      where: { id: mangaRecord.id },
      data: updateData,
    });
  } else {
    mangaRecord = await prisma.manga.create({ data: sharedMedia });
  }

  const existing = await prisma.mangaListEntry.findUnique({
    where: { mangaId: mangaRecord.id },
  });

  const isNewer = !existing?.updatedAt || kitsuUpdatedAt > existing.updatedAt;

  if (isNewer) {
    const entryData = {
      kitsuEntryId: node.id as string,
      readStatus: mapReadStatus(node.status),
      progress: node.progress ?? 0,
      progressVolumes: 0,
      rating: toRating(node.rating),
      notes: node.notes ?? null,
      private: node.private ?? false,
      rereading: node.reconsuming ?? false,
      rereadCount: node.reconsumeCount ?? 0,
      updatedAt: kitsuUpdatedAt,
    };
    await prisma.mangaListEntry.upsert({
      where: { mangaId: mangaRecord.id },
      create: { mangaId: mangaRecord.id, ...entryData },
      update: entryData,
    });
  } else {
    await prisma.mangaListEntry.update({
      where: { mangaId: mangaRecord.id },
      data: { kitsuEntryId: node.id as string },
    });
  }

  if (!existing) return false;
  if (!isNewer) return false;

  return (
    existing.readStatus !== mapReadStatus(node.status) ||
    existing.progress !== (node.progress ?? 0) ||
    existing.rating !== toRating(node.rating) ||
    existing.notes !== (node.notes ?? null) ||
    existing.rereadCount !== (node.reconsumeCount ?? 0) ||
    existing.rereading !== (node.reconsuming ?? false)
  );
}

// ---------------------------------------------------------------------------
// Exported sync functions
// ---------------------------------------------------------------------------

async function fetchLibraryPages(
  slug: string,
  type: GraphQLTypes["MediaTypeEnum"],
  pullEntry: (node: KitsuLibraryNode) => Promise<boolean>,
  label: string,
  errors: string[],
): Promise<{ total: number; changed: number }> {
  let cursor: string | null = null;
  let total = 0;
  let changed = 0;

  try {
    do {
      let result: KitsuLibraryResult | undefined;
      try {
        result = await queryKitsuLibrary(slug, type, cursor ?? undefined);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        console.error(`Failed to fetch ${label} library page:`, err);
        errors.push(`Failed to fetch ${label} library: ${err}`);
        break;
      }

      const page = result.findProfileBySlug?.library?.all;
      if (!page) break;

      for (const node of page.nodes ?? []) {
        try {
          const wasChanged = await pullEntry(node);
          total++;
          if (wasChanged) changed++;
        } catch (e) {
          const fullErr = e instanceof Error ? e.message : String(e);
          const shortErr = extractErrorMessage(e);
          console.error(`Failed to pull ${label} entry ${node.id}:`, fullErr);
          errors.push(`${label} ${node.id}: ${shortErr}`);
        }
      }

      cursor = page.pageInfo?.hasNextPage
        ? (page.pageInfo.endCursor ?? null)
        : null;
    } while (cursor);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error(`Unexpected error in fetchLibraryPages for ${label}:`, err);
    errors.push(`Unexpected error fetching ${label}: ${err}`);
  }

  return { total, changed };
}

export async function pullKitsu(logId: string): Promise<void> {
  const errors: string[] = [];
  let animeSynced = 0;
  let animeChanged = 0;
  let mangaSynced = 0;
  let mangaChanged = 0;

  try {
    const tokenInfo = await getToken("KITSU");
    const slug =
      tokenInfo?.username ?? process.env.NEXT_PUBLIC_KITSU_USERNAME ?? "";

    if (!slug) {
      errors.push("No Kitsu username configured");
    } else {
      const animeResult = await fetchLibraryPages(
        slug,
        "ANIME" as GraphQLTypes["MediaTypeEnum"],
        pullAnimeEntry,
        "anime",
        errors,
      );
      animeSynced = animeResult.total;
      animeChanged = animeResult.changed;

      const mangaResult = await fetchLibraryPages(
        slug,
        "MANGA" as GraphQLTypes["MediaTypeEnum"],
        pullMangaEntry,
        "manga",
        errors,
      );
      mangaSynced = mangaResult.total;
      mangaChanged = mangaResult.changed;
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("Unexpected error in pullKitsu:", err);
    errors.push(`Unexpected error: ${err}`);
  }

  const total = animeSynced + mangaSynced;
  const changed = animeChanged + mangaChanged;
  console.log(
    `[Kitsu Pull] Synced ${total} entries (${changed} changed): ${animeSynced} anime, ${mangaSynced} manga`,
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

type KitsuRemoteEntry = {
  entryId: string;
  mediaId: string;
  title: string;
  status: string | null | undefined;
  progress: number | null | undefined;
  rating: number | null | undefined;
  notes: string | null | undefined;
  reconsumeCount: number | null | undefined;
  reconsuming: boolean | null | undefined;
  private: boolean | null | undefined;
  malId?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
};

async function scanKitsuIds(
  slug: string,
  type: GraphQLTypes["MediaTypeEnum"],
): Promise<Map<string, KitsuRemoteEntry>> {
  const map = new Map<string, KitsuRemoteEntry>();
  let cursor: string | null = null;
  do {
    let result: Awaited<ReturnType<typeof queryKitsuLibrary>> | undefined;
    try {
      result = await queryKitsuLibrary(slug, type, cursor ?? undefined);
    } catch {
      break;
    }
    const page = result.findProfileBySlug?.library?.all;
    if (!page) break;
    for (const node of page.nodes ?? []) {
      if (!node.id || !node.media?.id) continue;
      const titles = node.media?.titles;
      const title =
        titles?.translated ??
        titles?.canonical ??
        titles?.romanized ??
        String(node.id);

      // Extract malId from media mappings
      const mappings = (
        node.media as {
          mappings?: { nodes?: KitsuMappingNode[] | null } | null;
        }
      ).mappings;
      const malId = (mappings?.nodes ?? []).find(
        (m) =>
          m.externalSite === MappingExternalSiteEnum.MYANIMELIST_ANIME ||
          m.externalSite === MappingExternalSiteEnum.MYANIMELIST_MANGA,
      )?.externalId;

      const typedNode = node.media as {
        episodeCount?: number | null;
        chapterCount?: number | null;
      } & KitsuMedia;

      map.set(node.media.id as string, {
        entryId: node.id as string,
        mediaId: node.media.id as string,
        title: title as string,
        status: node.status as string | null | undefined,
        progress: node.progress,
        rating: node.rating,
        notes: node.notes,
        reconsumeCount: node.reconsumeCount,
        reconsuming: node.reconsuming,
        private: node.private,
        malId: malId ? parseInt(malId, 10) : null,
        episodeCount: typedNode.episodeCount,
        chapterCount: typedNode.chapterCount,
      });
    }
    cursor = page.pageInfo?.hasNextPage
      ? (page.pageInfo.endCursor ?? null)
      : null;
  } while (cursor);
  return map;
}

function kitsuAnimeNeedsUpdate(
  local: {
    watchStatus: WatchStatus;
    progress: number;
    rating: number | null;
    notes: string | null;
    rewatchCount: number;
    rewatching: boolean;
    private: boolean;
  },
  remote: KitsuRemoteEntry,
): boolean {
  const watchStatusDiff = mapWatchStatus(remote.status) !== local.watchStatus;
  const progressDiff = (remote.progress ?? 0) !== local.progress;
  // Compare normalized ratings: convert local to Kitsu format for comparison
  const ratingDiff = toRating(remote.rating) !== toKitsuRating(local.rating);
  const notesDiff = (remote.notes || null) !== (local.notes || null);
  const rewatchDiff = (remote.reconsumeCount ?? 0) !== local.rewatchCount;
  const rewatchingDiff = (remote.reconsuming ?? false) !== local.rewatching;
  const privateDiff = (remote.private ?? false) !== local.private;

  const needsUpdate =
    watchStatusDiff ||
    progressDiff ||
    ratingDiff ||
    notesDiff ||
    rewatchDiff ||
    rewatchingDiff ||
    privateDiff;

  if (needsUpdate) {
    const diffs = [];
    if (watchStatusDiff)
      diffs.push(
        `watchStatus: ${mapWatchStatus(remote.status)} vs ${local.watchStatus}`,
      );
    if (progressDiff)
      diffs.push(`progress: ${remote.progress} vs ${local.progress}`);
    if (ratingDiff)
      diffs.push(
        `rating: ${toRating(remote.rating)} vs ${toKitsuRating(local.rating)} (local raw: ${local.rating})`,
      );
    if (notesDiff)
      diffs.push(
        `notes: "${remote.notes || null}" vs "${local.notes || null}"`,
      );
    if (rewatchDiff)
      diffs.push(
        `rewatchCount: ${remote.reconsumeCount} vs ${local.rewatchCount}`,
      );
    if (rewatchingDiff)
      diffs.push(`rewatching: ${remote.reconsuming} vs ${local.rewatching}`);
    if (privateDiff)
      diffs.push(`private: ${remote.private} vs ${local.private}`);
    console.log(
      `[Kitsu Push] Anime needs update (${remote.title}): ${diffs.join(", ")}`,
    );
  }

  return needsUpdate;
}

function kitsuMangaNeedsUpdate(
  local: {
    readStatus: ReadStatus;
    progress: number;
    rating: number | null;
    notes: string | null;
    rereadCount: number;
    rereading: boolean;
    private: boolean;
  },
  remote: KitsuRemoteEntry,
): boolean {
  const readStatusDiff = mapReadStatus(remote.status) !== local.readStatus;
  const progressDiff = (remote.progress ?? 0) !== local.progress;
  // Compare normalized ratings: convert local to Kitsu format for comparison
  const ratingDiff = toRating(remote.rating) !== toKitsuRating(local.rating);
  const notesDiff = (remote.notes || null) !== (local.notes || null);
  const rereadDiff = (remote.reconsumeCount ?? 0) !== local.rereadCount;
  const rereadingDiff = (remote.reconsuming ?? false) !== local.rereading;
  const privateDiff = (remote.private ?? false) !== local.private;

  const needsUpdate =
    readStatusDiff ||
    progressDiff ||
    ratingDiff ||
    notesDiff ||
    rereadDiff ||
    rereadingDiff ||
    privateDiff;

  if (needsUpdate) {
    const diffs = [];
    if (readStatusDiff)
      diffs.push(
        `readStatus: ${mapReadStatus(remote.status)} vs ${local.readStatus}`,
      );
    if (progressDiff)
      diffs.push(`progress: ${remote.progress} vs ${local.progress}`);
    if (ratingDiff)
      diffs.push(
        `rating: ${toRating(remote.rating)} vs ${toKitsuRating(local.rating)} (local raw: ${local.rating})`,
      );
    if (notesDiff)
      diffs.push(
        `notes: "${remote.notes || null}" vs "${local.notes || null}"`,
      );
    if (rereadDiff)
      diffs.push(
        `rereadCount: ${remote.reconsumeCount} vs ${local.rereadCount}`,
      );
    if (rereadingDiff)
      diffs.push(`rereading: ${remote.reconsuming} vs ${local.rereading}`);
    if (privateDiff)
      diffs.push(`private: ${remote.private} vs ${local.private}`);
    console.log(
      `[Kitsu Push] Manga needs update (${remote.title}): ${diffs.join(", ")}`,
    );
  }

  return needsUpdate;
}

// ────────────────────────────────────────────────────────────────────────────
// Batch mutations for Kitsu push
// ────────────────────────────────────────────────────────────────────────────

const KITSU_API_URL =
  process.env.KITSU_API_URL ?? "https://kitsu.io/api/graphql";
const KITSU_BATCH_SIZE = 10;

interface KitsuUpdateOp {
  alias: string;
  entryId: string;
  input: {
    notes: string;
    private: boolean;
    progress: number;
    rating: number | null;
    reconsumeCount: number;
    reconsuming: boolean;
    status: string;
  };
}

interface KitsuCreateOp {
  alias: string;
  mediaId: string;
  input: {
    mediaType: string;
    notes: string;
    private: boolean;
    progress: number;
    rating: number | null;
    reconsumeCount: number;
    reconsuming: boolean;
    status: string;
  };
}

interface KitsuDeleteOp {
  alias: string;
  entryId: string;
  title: string;
}

function toGraphQLValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    if (/^[A-Z_][A-Z0-9_]*$/.test(value)) {
      return value;
    }
    return JSON.stringify(value);
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map(toGraphQLValue).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([k, v]) => `${k}: ${toGraphQLValue(v)}`)
      .join(", ");
    return `{${entries}}`;
  }
  return String(value);
}

function buildKitsuUpdateBatch(ops: KitsuUpdateOp[]): string {
  const selections: string[] = [];

  for (const op of ops) {
    const inputStr = toGraphQLValue({
      id: op.entryId,
      ...op.input,
    });
    selections.push(
      `${op.alias}: libraryEntry { update(input: ${inputStr}) { libraryEntry { id } errors { message } } }`,
    );
  }

  return `mutation { ${selections.join(" ")} }`;
}

function buildKitsuCreateBatch(ops: KitsuCreateOp[]): string {
  const selections: string[] = [];

  for (const op of ops) {
    const inputStr = toGraphQLValue({
      mediaId: op.mediaId,
      ...op.input,
    });
    selections.push(
      `${op.alias}: libraryEntry { create(input: ${inputStr}) { libraryEntry { id } errors { message } } }`,
    );
  }

  return `mutation { ${selections.join(" ")} }`;
}

function buildKitsuDeleteBatch(ops: KitsuDeleteOp[]): string {
  const selections: string[] = [];

  for (const op of ops) {
    const inputStr = toGraphQLValue({ id: op.entryId });
    selections.push(
      `${op.alias}: libraryEntry { delete(input: ${inputStr}) { libraryEntry { id } } }`,
    );
  }

  return `mutation { ${selections.join(" ")} }`;
}

async function batchKitsuMutation(
  query: string,
): Promise<Record<string, unknown>> {
  const token = await ensureValidKitsuToken();
  const body = JSON.stringify({ query });
  const bodySize = Buffer.byteLength(body);
  console.log(
    `[Kitsu] Mutation: query ${query.length} chars, body ${bodySize} bytes`,
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: "https://kitsu.app/",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await kitsuFetch(KITSU_API_URL, {
    method: "POST",
    headers,
    body,
  });

  if (res.headers["cf-mitigated"] === "challenge") {
    console.error(`[Kitsu] Cloudflare challenge detected`);
    throw new Error("Kitsu blocked by Cloudflare challenge");
  }

  if (res.status < 200 || res.status >= 300) {
    const text = res.body || "(unreadable)";
    console.error(`[Kitsu] HTTP ${res.status}`);
    console.error(`[Kitsu] Query:\n${query}`);
    console.error(`[Kitsu] Response:\n${text}`);
    throw new Error(`Kitsu HTTP ${res.status}`);
  }

  const responseBody = JSON.parse(res.body) as {
    data?: Record<string, unknown>;
    errors?: { message: string }[];
  };
  if (responseBody.errors?.length) {
    console.error(`[Kitsu] GraphQL errors`);
    console.error(`[Kitsu] Query:\n${query}`);
    console.error(
      `[Kitsu] Errors:\n${JSON.stringify(responseBody.errors, null, 2)}`,
    );
    throw new Error(responseBody.errors.map((e) => e.message).join("; "));
  }
  return responseBody.data ?? {};
}

export async function pushKitsu(logId: string): Promise<void> {
  const errors: string[] = [];
  const deletions: string[] = [];
  let animeMatched = 0;
  let animeChanged = 0;
  let mangaMatched = 0;
  let mangaChanged = 0;

  try {
    const accessToken = await ensureValidKitsuToken();
    const tokenInfo = await getToken("KITSU");
    if (!accessToken || !tokenInfo?.username) {
      errors.push("Not logged in to Kitsu — cannot push");
    } else {
      const slug = tokenInfo.username;

      // ── ANIME ────────────────────────────────────────────────────────────────

      const remoteAnimeMap = await scanKitsuIds(
        slug,
        "ANIME" as GraphQLTypes["MediaTypeEnum"],
      );
      const animeEntries = await prisma.animeListEntry.findMany({
        include: { anime: true },
      });

      // Log anime entries with missing or potentially invalid episode counts
      const missingEpisodeCount = animeEntries.filter(
        (e) => !e.anime.episodeCount,
      );
      if (missingEpisodeCount.length > 0) {
        console.warn(
          `[Kitsu Push] Found ${missingEpisodeCount.length} anime entries with null episodeCount (cannot validate progress):`,
        );
        for (const entry of missingEpisodeCount.slice(0, 10)) {
          console.warn(
            `  - ${entry.id}: progress=${entry.progress}, title="${entry.anime.titleEn}"`,
          );
        }
      }

      const invalidProgressAnime = animeEntries.filter(
        (e) => e.anime.episodeCount && e.progress > e.anime.episodeCount,
      );
      if (invalidProgressAnime.length > 0) {
        console.warn(
          `[Kitsu Push] Found ${invalidProgressAnime.length} anime entries with progress > episodeCount:`,
        );
        for (const entry of invalidProgressAnime) {
          console.warn(
            `  - ${entry.id}: progress=${entry.progress}, episodes=${entry.anime.episodeCount}, title="${entry.anime.titleEn}"`,
          );
        }
      }

      const animeUpdateOps: KitsuUpdateOp[] = [];
      const animeCreateOps: KitsuCreateOp[] = [];
      const animeDeleteOps: KitsuDeleteOp[] = [];

      for (const entry of animeEntries) {
        // Validate entry before attempting sync
        const entryIssues = validateAnimeListEntry(entry);
        const mediaIssues = validateMediaRecord(entry.anime);
        if (entryIssues.length > 0 || mediaIssues.length > 0) {
          errors.push(
            `anime entry ${entry.id}: ${[...entryIssues, ...mediaIssues].join(", ")}`,
          );
          continue;
        }

        // Look up remote entry by kitsuId, fall back to malId
        let remote = entry.anime.kitsuId
          ? remoteAnimeMap.get(entry.anime.kitsuId)
          : null;
        if (!remote && entry.anime.malId) {
          // Try to find by malId
          for (const r of remoteAnimeMap.values()) {
            if (r.malId === entry.anime.malId) {
              remote = r;
              break;
            }
          }
        }

        if (remote) {
          animeMatched++;
          // Mark as seen so we don't delete it
          remoteAnimeMap.delete(remote.mediaId);

          // Use remote's episode count for validation (Kitsu is authoritative for their API)
          const remoteEpisodeCount = remote.episodeCount;
          const clampedProgress = remoteEpisodeCount
            ? Math.min(entry.progress, remoteEpisodeCount)
            : entry.progress;

          if (
            !kitsuAnimeNeedsUpdate(
              { ...entry, progress: clampedProgress },
              remote,
            )
          ) {
            // No update needed, skip this entry
            continue;
          }

          if (clampedProgress !== entry.progress) {
            const localCount = entry.anime.episodeCount;
            if (
              localCount &&
              remoteEpisodeCount &&
              localCount !== remoteEpisodeCount
            ) {
              console.warn(
                `[Kitsu Push] Episode count mismatch for ${entry.anime.titleEn}: local=${localCount}, Kitsu=${remoteEpisodeCount}. Clamping progress from ${entry.progress} to ${clampedProgress}`,
              );
            } else {
              console.warn(
                `[Kitsu Push] Clamping anime progress: ${entry.anime.titleEn} (${entry.id}) from ${entry.progress} to ${clampedProgress} (episodes: ${remoteEpisodeCount})`,
              );
            }
          }

          animeUpdateOps.push({
            alias: `u${animeUpdateOps.length}`,
            entryId: remote.entryId,
            input: {
              notes: entry.notes ?? "",
              private: entry.private,
              progress: clampedProgress,
              rating: toKitsuRating(entry.rating),
              reconsumeCount: entry.rewatchCount,
              reconsuming: entry.rewatching,
              status: reverseWatchStatus(entry.watchStatus),
            },
          });
        } else if (entry.anime.kitsuId) {
          let episodeCount = entry.anime.episodeCount;
          let _fetchedFromKitsu = false;

          console.log(
            `[Kitsu Push] Creating anime ${entry.anime.titleEn} (kitsuId=${entry.anime.kitsuId}): progress=${entry.progress}, local episodeCount=${episodeCount}`,
          );

          // Always fetch media details to validate before creating
          if (entry.progress > 0) {
            const mediaDetails = await fetchKitsuMediaDetails(
              entry.anime.kitsuId,
              "ANIME",
            );
            console.log(
              `[Kitsu Push] Fetched media details for kitsuId=${entry.anime.kitsuId}: ${JSON.stringify(mediaDetails)}`,
            );
            if (mediaDetails?.episodeCount != null) {
              const fetchedCount = mediaDetails.episodeCount;
              if (episodeCount && episodeCount !== fetchedCount) {
                console.warn(
                  `[Kitsu Push] Episode count mismatch for ${entry.anime.titleEn}: local=${episodeCount}, Kitsu=${fetchedCount}`,
                );
              }
              episodeCount = fetchedCount;
              _fetchedFromKitsu = true;
              // Update local database with the fetched episode count
              if (!entry.anime.episodeCount) {
                await prisma.anime.update({
                  where: { id: entry.anime.id },
                  data: { episodeCount },
                });
                console.log(
                  `[Kitsu Push] Stored fetched episodeCount=${episodeCount} for ${entry.anime.titleEn}`,
                );
              }
            } else {
              console.warn(
                `[Kitsu Push] Could not fetch episodeCount for ${entry.anime.titleEn} (kitsuId=${entry.anime.kitsuId})`,
              );
            }
          }

          const clampedProgress = episodeCount
            ? Math.min(entry.progress, episodeCount)
            : entry.progress;
          console.log(
            `[Kitsu Push] Final progress for ${entry.anime.titleEn}: ${entry.progress} -> ${clampedProgress} (episodeCount=${episodeCount})`,
          );
          if (clampedProgress !== entry.progress) {
            console.warn(
              `[Kitsu Push] Clamping anime progress on create: ${entry.anime.titleEn} (${entry.id}) from ${entry.progress} to ${clampedProgress}`,
            );
          }

          animeCreateOps.push({
            alias: `c${animeCreateOps.length}`,
            mediaId: entry.anime.kitsuId,
            input: {
              mediaType: "ANIME",
              notes: entry.notes ?? "",
              private: entry.private,
              progress: clampedProgress,
              rating: toKitsuRating(entry.rating),
              reconsumeCount: entry.rewatchCount,
              reconsuming: entry.rewatching,
              status: reverseWatchStatus(entry.watchStatus),
            },
          });
        }
      }

      for (const { entryId, title } of remoteAnimeMap.values()) {
        animeDeleteOps.push({
          alias: `d${animeDeleteOps.length}`,
          entryId,
          title,
        });
      }

      // Execute anime batches
      console.log(
        `[Kitsu Push] Anime: ${animeUpdateOps.length} updates, ${animeCreateOps.length} creates, ${animeDeleteOps.length} deletes`,
      );
      for (let i = 0; i < animeUpdateOps.length; i += KITSU_BATCH_SIZE) {
        const batchNum = i / KITSU_BATCH_SIZE + 1;
        const chunk = animeUpdateOps.slice(i, i + KITSU_BATCH_SIZE);
        console.log(
          `[Kitsu Push] Anime update batch ${batchNum} (${chunk.length} ops)...`,
        );
        const query = buildKitsuUpdateBatch(chunk);
        try {
          await batchKitsuMutation(query);
          console.log(`[Kitsu Push] Anime update batch ${batchNum} completed`);
          for (const _op of chunk) {
            animeChanged++;
          }
        } catch (e) {
          errors.push(
            `anime update batch ${batchNum}: ${extractErrorMessage(e)}`,
          );
        }
      }

      for (let i = 0; i < animeCreateOps.length; i += KITSU_BATCH_SIZE) {
        const batchNum = i / KITSU_BATCH_SIZE + 1;
        const chunk = animeCreateOps.slice(i, i + KITSU_BATCH_SIZE);
        console.log(
          `[Kitsu Push] Anime create batch ${batchNum} (${chunk.length} ops)...`,
        );
        const query = buildKitsuCreateBatch(chunk);
        try {
          await batchKitsuMutation(query);
          console.log(`[Kitsu Push] Anime create batch ${batchNum} completed`);
          for (const _op of chunk) {
            animeMatched++;
            animeChanged++;
          }
        } catch (e) {
          errors.push(
            `anime create batch ${batchNum}: ${extractErrorMessage(e)}`,
          );
        }
      }

      for (let i = 0; i < animeDeleteOps.length; i += KITSU_BATCH_SIZE) {
        const batchNum = i / KITSU_BATCH_SIZE + 1;
        const chunk = animeDeleteOps.slice(i, i + KITSU_BATCH_SIZE);
        console.log(
          `[Kitsu Push] Anime delete batch ${batchNum} (${chunk.length} ops)...`,
        );
        const query = buildKitsuDeleteBatch(chunk);
        try {
          await batchKitsuMutation(query);
          console.log(`[Kitsu Push] Anime delete batch ${batchNum} completed`);
          for (const op of chunk) {
            const msg = `anime "${op.title}" (Kitsu entry ${op.entryId})`;
            console.log(`[Kitsu Push] Deleted ${msg}`);
            deletions.push(msg);
            animeChanged++;
          }
        } catch (e) {
          errors.push(
            `anime delete batch ${batchNum}: ${extractErrorMessage(e)}`,
          );
        }
      }

      // ── MANGA ────────────────────────────────────────────────────────────────

      const remoteMangaMap = await scanKitsuIds(
        slug,
        "MANGA" as GraphQLTypes["MediaTypeEnum"],
      );
      const mangaEntries = await prisma.mangaListEntry.findMany({
        include: { manga: true },
      });

      // Log manga entries with missing or potentially invalid chapter counts
      const missingChapterCount = mangaEntries.filter(
        (e) => !e.manga.chapterCount,
      );
      if (missingChapterCount.length > 0) {
        console.warn(
          `[Kitsu Push] Found ${missingChapterCount.length} manga entries with null chapterCount (cannot validate progress):`,
        );
        for (const entry of missingChapterCount.slice(0, 10)) {
          console.warn(
            `  - ${entry.id}: progress=${entry.progress}, title="${entry.manga.titleEn}"`,
          );
        }
      }

      const invalidProgressManga = mangaEntries.filter(
        (e) => e.manga.chapterCount && e.progress > e.manga.chapterCount,
      );
      if (invalidProgressManga.length > 0) {
        console.warn(
          `[Kitsu Push] Found ${invalidProgressManga.length} manga entries with progress > chapterCount:`,
        );
        for (const entry of invalidProgressManga) {
          console.warn(
            `  - ${entry.id}: progress=${entry.progress}, chapters=${entry.manga.chapterCount}, title="${entry.manga.titleEn}"`,
          );
        }
      }

      const mangaUpdateOps: KitsuUpdateOp[] = [];
      const mangaCreateOps: KitsuCreateOp[] = [];
      const mangaDeleteOps: KitsuDeleteOp[] = [];

      for (const entry of mangaEntries) {
        // Validate entry before attempting sync
        const entryIssues = validateMangaListEntry(entry);
        const mediaIssues = validateMediaRecord(entry.manga);
        if (entryIssues.length > 0 || mediaIssues.length > 0) {
          errors.push(
            `manga entry ${entry.id}: ${[...entryIssues, ...mediaIssues].join(", ")}`,
          );
          continue;
        }

        // Look up remote entry by kitsuId, fall back to malId
        let remote = entry.manga.kitsuId
          ? remoteMangaMap.get(entry.manga.kitsuId)
          : null;
        if (!remote && entry.manga.malId) {
          // Try to find by malId
          for (const r of remoteMangaMap.values()) {
            if (r.malId === entry.manga.malId) {
              remote = r;
              break;
            }
          }
        }

        if (remote) {
          // Mark as seen so we don't delete it
          mangaMatched++;
          remoteMangaMap.delete(remote.mediaId);

          // Use remote's chapter count for validation (Kitsu is authoritative for their API)
          const remoteChapterCount = remote.chapterCount;
          const clampedProgress = remoteChapterCount
            ? Math.min(entry.progress, remoteChapterCount)
            : entry.progress;

          if (
            !kitsuMangaNeedsUpdate(
              { ...entry, progress: clampedProgress },
              remote,
            )
          ) {
            // No update needed, skip this entry
            continue;
          }

          if (clampedProgress !== entry.progress) {
            const localCount = entry.manga.chapterCount;
            if (
              localCount &&
              remoteChapterCount &&
              localCount !== remoteChapterCount
            ) {
              console.warn(
                `[Kitsu Push] Chapter count mismatch for ${entry.manga.titleEn}: local=${localCount}, Kitsu=${remoteChapterCount}. Clamping progress from ${entry.progress} to ${clampedProgress}`,
              );
            } else {
              console.warn(
                `[Kitsu Push] Clamping manga progress: ${entry.manga.titleEn} (${entry.id}) from ${entry.progress} to ${clampedProgress} (chapters: ${remoteChapterCount})`,
              );
            }
          }

          mangaUpdateOps.push({
            alias: `u${mangaUpdateOps.length}`,
            entryId: remote.entryId,
            input: {
              notes: entry.notes ?? "",
              private: entry.private,
              progress: clampedProgress,
              rating: toKitsuRating(entry.rating),
              reconsumeCount: entry.rereadCount,
              reconsuming: entry.rereading,
              status: reverseReadStatus(entry.readStatus),
            },
          });
        } else if (entry.manga.kitsuId) {
          let chapterCount = entry.manga.chapterCount;
          let fetchedFromKitsu = false;

          // If progress > 0 but no chapter count, fetch from Kitsu
          if (entry.progress > 0 && !chapterCount) {
            const mediaDetails = await fetchKitsuMediaDetails(
              entry.manga.kitsuId,
              "MANGA",
            );
            if (mediaDetails?.chapterCount != null) {
              chapterCount = mediaDetails.chapterCount;
              fetchedFromKitsu = true;
              // Update local database with the fetched chapter count
              await prisma.manga.update({
                where: { id: entry.manga.id },
                data: { chapterCount },
              });
              console.log(
                `[Kitsu Push] Fetched chapterCount=${chapterCount} for ${entry.manga.titleEn} (${entry.id})`,
              );
            }
          }

          const clampedProgress = chapterCount
            ? Math.min(entry.progress, chapterCount)
            : entry.progress;
          if (clampedProgress !== entry.progress) {
            if (
              entry.manga.chapterCount &&
              chapterCount &&
              entry.manga.chapterCount !== chapterCount
            ) {
              console.warn(
                `[Kitsu Push] Chapter count mismatch for ${entry.manga.titleEn}: local=${entry.manga.chapterCount}, Kitsu=${chapterCount}. Clamping progress from ${entry.progress} to ${clampedProgress}`,
              );
            } else if (fetchedFromKitsu) {
              console.log(
                `[Kitsu Push] Clamping manga progress on create: ${entry.manga.titleEn} (${entry.id}) from ${entry.progress} to ${clampedProgress} (Kitsu chapterCount: ${chapterCount})`,
              );
            } else {
              console.warn(
                `[Kitsu Push] Clamping manga progress on create: ${entry.manga.titleEn} (${entry.id}) from ${entry.progress} to ${clampedProgress} (chapters: ${chapterCount})`,
              );
            }
          }

          mangaCreateOps.push({
            alias: `c${mangaCreateOps.length}`,
            mediaId: entry.manga.kitsuId,
            input: {
              mediaType: "MANGA",
              notes: entry.notes ?? "",
              private: entry.private,
              progress: clampedProgress,
              rating: toKitsuRating(entry.rating),
              reconsumeCount: entry.rereadCount,
              reconsuming: entry.rereading,
              status: reverseReadStatus(entry.readStatus),
            },
          });
        }
      }

      for (const { entryId, title } of remoteMangaMap.values()) {
        mangaDeleteOps.push({
          alias: `d${mangaDeleteOps.length}`,
          entryId,
          title,
        });
      }

      // Execute manga batches
      console.log(
        `[Kitsu Push] Manga: ${mangaUpdateOps.length} updates, ${mangaCreateOps.length} creates, ${mangaDeleteOps.length} deletes`,
      );
      for (let i = 0; i < mangaUpdateOps.length; i += KITSU_BATCH_SIZE) {
        const batchNum = i / KITSU_BATCH_SIZE + 1;
        const chunk = mangaUpdateOps.slice(i, i + KITSU_BATCH_SIZE);
        console.log(
          `[Kitsu Push] Manga update batch ${batchNum} (${chunk.length} ops)...`,
        );
        const query = buildKitsuUpdateBatch(chunk);
        try {
          await batchKitsuMutation(query);
          console.log(`[Kitsu Push] Manga update batch ${batchNum} completed`);
          for (const _op of chunk) {
            mangaChanged++;
          }
        } catch (e) {
          errors.push(
            `manga update batch ${batchNum}: ${extractErrorMessage(e)}`,
          );
        }
      }

      for (let i = 0; i < mangaCreateOps.length; i += KITSU_BATCH_SIZE) {
        const batchNum = i / KITSU_BATCH_SIZE + 1;
        const chunk = mangaCreateOps.slice(i, i + KITSU_BATCH_SIZE);
        console.log(
          `[Kitsu Push] Manga create batch ${batchNum} (${chunk.length} ops)...`,
        );
        const query = buildKitsuCreateBatch(chunk);
        try {
          await batchKitsuMutation(query);
          console.log(`[Kitsu Push] Manga create batch ${batchNum} completed`);
          for (const _op of chunk) {
            mangaMatched++;
            mangaChanged++;
          }
        } catch (e) {
          errors.push(
            `manga create batch ${batchNum}: ${extractErrorMessage(e)}`,
          );
        }
      }

      for (let i = 0; i < mangaDeleteOps.length; i += KITSU_BATCH_SIZE) {
        const batchNum = i / KITSU_BATCH_SIZE + 1;
        const chunk = mangaDeleteOps.slice(i, i + KITSU_BATCH_SIZE);
        console.log(
          `[Kitsu Push] Manga delete batch ${batchNum} (${chunk.length} ops)...`,
        );
        const query = buildKitsuDeleteBatch(chunk);
        try {
          await batchKitsuMutation(query);
          console.log(`[Kitsu Push] Manga delete batch ${batchNum} completed`);
          for (const op of chunk) {
            const msg = `manga "${op.title}" (Kitsu entry ${op.entryId})`;
            console.log(`[Kitsu Push] Deleted ${msg}`);
            deletions.push(msg);
            mangaChanged++;
          }
        } catch (e) {
          errors.push(
            `manga delete batch ${batchNum}: ${extractErrorMessage(e)}`,
          );
        }
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("Unexpected error in pushKitsu:", err);
    errors.push(`Unexpected error: ${err}`);
  }

  const total = animeMatched + mangaMatched;
  const changed = animeChanged + mangaChanged;
  console.log(
    `[Kitsu Push] Anime: ${animeMatched} matched (${animeChanged} changed)`,
  );
  console.log(
    `[Kitsu Push] Manga: ${mangaMatched} matched (${mangaChanged} changed)`,
  );
  console.log(
    `[Kitsu Push] Matched ${total} entries (${changed} changed, ${deletions.length} deleted): ${animeMatched} anime, ${mangaMatched} manga`,
  );

  await prisma.syncLog.update({
    where: { id: logId },
    data: {
      status: errors.length ? "FAILED" : "COMPLETED",
      animeSynced: animeMatched,
      mangaSynced: mangaMatched,
      animeChanged,
      mangaChanged,
      errors,
      deletions,
      finishedAt: new Date(),
    },
  });
}
