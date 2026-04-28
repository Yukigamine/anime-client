"use server";

import { redirect } from "next/navigation";
import type { SyncLog } from "@/generated/prisma/client";
import { pullAniList, pushAniList } from "@/lib/anilist/sync";
import { deleteToken, getAuthStatus, getToken } from "@/lib/auth";
import { invalidateListCache } from "@/lib/cache";
import { ensureValidKitsuToken, loginKitsu } from "@/lib/kitsu/auth";
import { pullKitsu, pushKitsu } from "@/lib/kitsu/sync";
import prisma from "@/lib/prisma";

export type AuthStatus = Record<
  "KITSU" | "ANILIST",
  { loggedIn: boolean; username: string | null }
>;
export type SyncStatusPayload = { logs: SyncLog[]; auth: AuthStatus };
export type ActionResult<T = void> =
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

export async function logoutProviderAction(
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
