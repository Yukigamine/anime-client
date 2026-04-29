"use server";

import { redirect } from "next/navigation";
import type { SyncLog } from "@/generated/prisma/client";
import { pullAniList, pushAniList } from "@/lib/anilist/sync";
import { deleteToken, getAuthStatus, getToken } from "@/lib/auth";
import { invalidateListCache } from "@/lib/cache";
import { ensureValidKitsuToken, loginKitsu } from "@/lib/kitsu/auth";
import { pullKitsu, pushKitsu } from "@/lib/kitsu/sync";
import prisma from "@/lib/prisma";
import {
  validateAnimeListEntry,
  validateMangaListEntry,
  validateMediaRecord,
} from "@/lib/validation";

type AuthStatus = Record<
  "KITSU" | "ANILIST",
  { loggedIn: boolean; username: string | null }
>;
export type SyncStatusPayload = { logs: SyncLog[]; auth: AuthStatus };
type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function loginKitsuAction(
  formData: FormData,
): Promise<ActionResult> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { ok: false, error: "Username and password are required" };
  }

  const requiredUsername = process.env.NEXT_PUBLIC_KITSU_USERNAME;
  if (
    requiredUsername &&
    username.toLowerCase() !== requiredUsername.toLowerCase()
  ) {
    return {
      ok: false,
      error: `This app is configured for "${requiredUsername}". Sign in with that account.`,
    };
  }

  try {
    await loginKitsu(username, password);

    if (requiredUsername) {
      const stored = await getToken("KITSU");
      if (
        stored?.username &&
        stored.username.toLowerCase() !== requiredUsername.toLowerCase()
      ) {
        return {
          ok: false,
          error: `Authenticated as "${stored.username}" but this app requires "${requiredUsername}".`,
        };
      }
    }

    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function logoutProviderAction(
  provider: "KITSU" | "ANILIST" | "ALL",
): Promise<ActionResult> {
  try {
    if (provider === "ALL") {
      await Promise.all([deleteToken("KITSU"), deleteToken("ANILIST")]);
    } else {
      await deleteToken(provider);
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Form-action variant — binds provider and redirects back to /link
export async function logoutAndRedirectAction(provider: "KITSU" | "ANILIST") {
  await logoutProviderAction(provider);
  redirect("/link");
}

export async function triggerSyncAction(
  provider: "KITSU" | "ANILIST",
  direction: "PULL" | "PUSH",
): Promise<ActionResult<{ logId: string }>> {
  if (provider === "KITSU") {
    const token = await ensureValidKitsuToken();
    if (!token) return { ok: false, error: "Not logged in to Kitsu" };
  }

  await prisma.syncLog.updateMany({
    where: { provider, direction, status: "RUNNING" },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });

  const log = await prisma.syncLog.create({
    data: { provider, direction, status: "RUNNING" },
  });

  try {
    if (provider === "KITSU") {
      direction === "PULL" ? await pullKitsu(log.id) : await pushKitsu(log.id);
    } else {
      direction === "PULL"
        ? await pullAniList(log.id)
        : await pushAniList(log.id);
    }
    await invalidateListCache();
    return { ok: true, data: { logId: log.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errors: [message], finishedAt: new Date() },
    });
    return { ok: false, error: message };
  }
}

export async function getSyncStatusAction(): Promise<SyncStatusPayload> {
  const [logs, auth] = await Promise.all([
    prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    getAuthStatus(),
  ]);
  return { logs, auth };
}

type InvalidEntry = {
  id: string;
  title: string | null;
  issues: string[];
  progress?: number;
  progressLimit?: number | null;
};

export type InvalidEntriesResult = {
  invalidAnime: InvalidEntry[];
  invalidManga: InvalidEntry[];
};

export async function findInvalidEntriesAction(): Promise<InvalidEntriesResult> {
  const [animeEntries, mangaEntries] = await Promise.all([
    prisma.animeListEntry.findMany({ include: { anime: true } }),
    prisma.mangaListEntry.findMany({ include: { manga: true } }),
  ]);

  const invalidAnime: InvalidEntry[] = [];
  for (const entry of animeEntries) {
    const entryIssues = validateAnimeListEntry(entry);
    const mediaIssues = validateMediaRecord(entry.anime);
    // Also check if progress exceeds episode count
    if (entry.anime.episodeCount && entry.progress > entry.anime.episodeCount) {
      entryIssues.push("progress exceeds episode count");
    }
    if (entryIssues.length > 0 || mediaIssues.length > 0) {
      invalidAnime.push({
        id: entry.id,
        title: entry.anime.titleEn,
        issues: [...entryIssues, ...mediaIssues],
        progress: entry.progress,
        progressLimit: entry.anime.episodeCount,
      });
    }
  }

  const invalidManga: InvalidEntry[] = [];
  for (const entry of mangaEntries) {
    const entryIssues = validateMangaListEntry(entry);
    const mediaIssues = validateMediaRecord(entry.manga);
    // Also check if progress exceeds chapter count
    if (entry.manga.chapterCount && entry.progress > entry.manga.chapterCount) {
      entryIssues.push("progress exceeds chapter count");
    }
    if (entryIssues.length > 0 || mediaIssues.length > 0) {
      invalidManga.push({
        id: entry.id,
        title: entry.manga.titleEn,
        issues: [...entryIssues, ...mediaIssues],
        progress: entry.progress,
        progressLimit: entry.manga.chapterCount,
      });
    }
  }

  return { invalidAnime, invalidManga };
}

export async function deleteInvalidEntriesAction(
  animeIds: string[],
  mangaIds: string[],
): Promise<ActionResult> {
  try {
    await Promise.all([
      animeIds.length > 0
        ? prisma.animeListEntry.deleteMany({ where: { id: { in: animeIds } } })
        : Promise.resolve(),
      mangaIds.length > 0
        ? prisma.mangaListEntry.deleteMany({ where: { id: { in: mangaIds } } })
        : Promise.resolve(),
    ]);
    await invalidateListCache();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function normalizeInvalidRatingsAction(): Promise<
  ActionResult<{ animeFixed: number; mangaFixed: number }>
> {
  try {
    let animeFixed = 0;
    let mangaFixed = 0;

    // Normalize anime ratings: clamp to 2-20 range (Kitsu minimum is 2)
    const animeEntries = await prisma.animeListEntry.findMany({
      where: {
        OR: [{ rating: { lt: 2 } }, { rating: { gt: 20 } }],
      },
    });

    for (const entry of animeEntries) {
      if (entry.rating !== null) {
        const clamped = Math.max(2, Math.min(20, entry.rating));
        if (clamped !== entry.rating) {
          await prisma.animeListEntry.update({
            where: { id: entry.id },
            data: { rating: clamped },
          });
          animeFixed++;
        }
      }
    }

    // Normalize manga ratings: clamp to 2-20 range
    const mangaEntries = await prisma.mangaListEntry.findMany({
      where: {
        OR: [{ rating: { lt: 2 } }, { rating: { gt: 20 } }],
      },
    });

    for (const entry of mangaEntries) {
      if (entry.rating !== null) {
        const clamped = Math.max(2, Math.min(20, entry.rating));
        if (clamped !== entry.rating) {
          await prisma.mangaListEntry.update({
            where: { id: entry.id },
            data: { rating: clamped },
          });
          mangaFixed++;
        }
      }
    }

    if (animeFixed > 0 || mangaFixed > 0) {
      await invalidateListCache();
    }

    return { ok: true, data: { animeFixed, mangaFixed } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
