import "server-only";
import { ReadStatus, ShowStatus, WatchStatus } from "@/generated/prisma/client";
import { getToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  type GraphQLTypes,
  LibraryEntryStatusEnum,
  MappingExternalSiteEnum,
} from "@/lib/zeus/kitsu";
import { kitsuThunder, kitsuThunderAuth } from "./thunder";

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

// GraphQL rating is 0-20; DB stores 0-10
function toRating(rating: number | null | undefined): number | null {
  return rating != null ? rating / 2 : null;
}

function toKitsuRating(rating: number | null): number | null {
  return rating !== null ? Math.round(rating * 2) : null;
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
      let result;
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
  title: string;
  status: string | null | undefined;
  progress: number | null | undefined;
  rating: number | null | undefined;
  notes: string | null | undefined;
  reconsumeCount: number | null | undefined;
  reconsuming: boolean | null | undefined;
  private: boolean | null | undefined;
};

async function scanKitsuIds(
  slug: string,
  type: GraphQLTypes["MediaTypeEnum"],
): Promise<Map<string, KitsuRemoteEntry>> {
  const map = new Map<string, KitsuRemoteEntry>();
  let cursor: string | null = null;
  do {
    let result;
    try {
      result = await queryKitsuLibrary(slug, type, cursor ?? undefined);
    } catch {
      break;
    }
    const page = result.findProfileBySlug?.library?.all;
    if (!page) break;
    for (const node of page.nodes ?? []) {
      if (!node.id) continue;
      const titles = node.media?.titles;
      const title =
        titles?.translated ??
        titles?.canonical ??
        titles?.romanized ??
        String(node.id);
      map.set(node.id as string, {
        title: title as string,
        status: node.status as string | null | undefined,
        progress: node.progress,
        rating: node.rating,
        notes: node.notes,
        reconsumeCount: node.reconsumeCount,
        reconsuming: node.reconsuming,
        private: node.private,
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
  return (
    mapWatchStatus(remote.status) !== local.watchStatus ||
    (remote.progress ?? 0) !== local.progress ||
    toRating(remote.rating) !== local.rating ||
    (remote.notes || null) !== local.notes ||
    (remote.reconsumeCount ?? 0) !== local.rewatchCount ||
    (remote.reconsuming ?? false) !== local.rewatching ||
    (remote.private ?? false) !== local.private
  );
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
  return (
    mapReadStatus(remote.status) !== local.readStatus ||
    (remote.progress ?? 0) !== local.progress ||
    toRating(remote.rating) !== local.rating ||
    (remote.notes || null) !== local.notes ||
    (remote.reconsumeCount ?? 0) !== local.rereadCount ||
    (remote.reconsuming ?? false) !== local.rereading ||
    (remote.private ?? false) !== local.private
  );
}

export async function pushKitsu(logId: string): Promise<void> {
  const errors: string[] = [];
  const deletions: string[] = [];
  let animeSynced = 0;
  let animeChanged = 0;
  let mangaSynced = 0;
  let mangaChanged = 0;

  try {
    const tokenInfo = await getToken("KITSU");
    if (!tokenInfo?.accessToken || !tokenInfo.username) {
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

      for (const entry of animeEntries) {
        if (entry.kitsuEntryId) {
          const remote = remoteAnimeMap.get(entry.kitsuEntryId);
          remoteAnimeMap.delete(entry.kitsuEntryId);
          if (remote && !kitsuAnimeNeedsUpdate(entry, remote)) continue;
          try {
            await kitsuThunderAuth("mutation")({
              libraryEntry: {
                update: [
                  {
                    input: {
                      id: entry.kitsuEntryId,
                      notes: entry.notes ?? "",
                      private: entry.private,
                      progress: entry.progress,
                      rating: toKitsuRating(entry.rating),
                      reconsumeCount: entry.rewatchCount,
                      reconsuming: entry.rewatching,
                      status: reverseWatchStatus(entry.watchStatus),
                    },
                  },
                  { libraryEntry: { id: true } },
                ],
              },
            });
            animeSynced++;
            animeChanged++;
          } catch (e) {
            console.error(
              `Failed to push anime entry ${entry.kitsuEntryId}:`,
              e,
            );
            errors.push(
              `anime entry ${entry.kitsuEntryId}: ${extractErrorMessage(e)}`,
            );
          }
        } else if (entry.anime.kitsuId) {
          try {
            const res = await kitsuThunderAuth("mutation")({
              libraryEntry: {
                create: [
                  {
                    input: {
                      mediaId: entry.anime.kitsuId,
                      mediaType: "ANIME" as GraphQLTypes["MediaTypeEnum"],
                      status: reverseWatchStatus(entry.watchStatus),
                      notes: entry.notes ?? undefined,
                      private: entry.private,
                      progress: entry.progress,
                      rating: toKitsuRating(entry.rating) ?? undefined,
                      reconsumeCount: entry.rewatchCount,
                      reconsuming: entry.rewatching,
                    },
                  },
                  { libraryEntry: { id: true } },
                ],
              },
            });
            const newId = res.libraryEntry?.create?.libraryEntry?.id as
              | string
              | undefined;
            if (newId) {
              await prisma.animeListEntry.update({
                where: { id: entry.id },
                data: { kitsuEntryId: newId },
              });
            }
            animeSynced++;
            animeChanged++;
          } catch (e) {
            console.error(`Failed to create anime ${entry.anime.kitsuId}:`, e);
            errors.push(
              `create anime ${entry.anime.kitsuId}: ${extractErrorMessage(e)}`,
            );
          }
        }
      }

      for (const [entryId, { title }] of remoteAnimeMap) {
        try {
          await kitsuThunderAuth("mutation")({
            libraryEntry: {
              delete: [
                { input: { id: entryId } },
                { libraryEntry: { id: true } },
              ],
            },
          });
          const msg = `anime "${title}" (Kitsu entry ${entryId})`;
          console.log(`[Kitsu Push] Deleted ${msg}`);
          deletions.push(msg);
          animeChanged++;
        } catch (e) {
          errors.push(
            `delete anime entry ${entryId}: ${extractErrorMessage(e)}`,
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

      for (const entry of mangaEntries) {
        if (entry.kitsuEntryId) {
          const remote = remoteMangaMap.get(entry.kitsuEntryId);
          remoteMangaMap.delete(entry.kitsuEntryId);
          if (remote && !kitsuMangaNeedsUpdate(entry, remote)) continue;
          try {
            await kitsuThunderAuth("mutation")({
              libraryEntry: {
                update: [
                  {
                    input: {
                      id: entry.kitsuEntryId,
                      notes: entry.notes ?? "",
                      private: entry.private,
                      progress: entry.progress,
                      rating: toKitsuRating(entry.rating),
                      reconsumeCount: entry.rereadCount,
                      reconsuming: entry.rereading,
                      status: reverseReadStatus(entry.readStatus),
                    },
                  },
                  { libraryEntry: { id: true } },
                ],
              },
            });
            mangaSynced++;
            mangaChanged++;
          } catch (e) {
            console.error(
              `Failed to push manga entry ${entry.kitsuEntryId}:`,
              e,
            );
            errors.push(
              `manga entry ${entry.kitsuEntryId}: ${extractErrorMessage(e)}`,
            );
          }
        } else if (entry.manga.kitsuId) {
          try {
            const res = await kitsuThunderAuth("mutation")({
              libraryEntry: {
                create: [
                  {
                    input: {
                      mediaId: entry.manga.kitsuId,
                      mediaType: "MANGA" as GraphQLTypes["MediaTypeEnum"],
                      status: reverseReadStatus(entry.readStatus),
                      notes: entry.notes ?? undefined,
                      private: entry.private,
                      progress: entry.progress,
                      rating: toKitsuRating(entry.rating) ?? undefined,
                      reconsumeCount: entry.rereadCount,
                      reconsuming: entry.rereading,
                    },
                  },
                  { libraryEntry: { id: true } },
                ],
              },
            });
            const newId = res.libraryEntry?.create?.libraryEntry?.id as
              | string
              | undefined;
            if (newId) {
              await prisma.mangaListEntry.update({
                where: { id: entry.id },
                data: { kitsuEntryId: newId },
              });
            }
            mangaSynced++;
            mangaChanged++;
          } catch (e) {
            console.error(`Failed to create manga ${entry.manga.kitsuId}:`, e);
            errors.push(
              `create manga ${entry.manga.kitsuId}: ${extractErrorMessage(e)}`,
            );
          }
        }
      }

      for (const [entryId, { title }] of remoteMangaMap) {
        try {
          await kitsuThunderAuth("mutation")({
            libraryEntry: {
              delete: [
                { input: { id: entryId } },
                { libraryEntry: { id: true } },
              ],
            },
          });
          const msg = `manga "${title}" (Kitsu entry ${entryId})`;
          console.log(`[Kitsu Push] Deleted ${msg}`);
          deletions.push(msg);
          mangaChanged++;
        } catch (e) {
          errors.push(
            `delete manga entry ${entryId}: ${extractErrorMessage(e)}`,
          );
        }
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("Unexpected error in pushKitsu:", err);
    errors.push(`Unexpected error: ${err}`);
  }

  const total = animeSynced + mangaSynced;
  const changed = animeChanged + mangaChanged;
  console.log(
    `[Kitsu Push] Synced ${total} entries (${changed} changed, ${deletions.length} deleted): ${animeSynced} anime, ${mangaSynced} manga`,
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
