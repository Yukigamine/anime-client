"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteToken } from "@/lib/auth";
import { auth } from "@/lib/betterauth";
import { persistKitsuToken } from "@/lib/kitsu/auth";
import { getSession, requireSession } from "@/lib/session";
import type { ActionResult, SyncProvider } from "./types";

type SaveKitsuTokenInput = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn: number;
  fallbackUsername?: string | null;
};

export async function saveKitsuTokenAction(
  input: SaveKitsuTokenInput,
): Promise<ActionResult> {
  await requireSession();

  if (!input.accessToken || !Number.isFinite(input.expiresIn)) {
    return { ok: false, error: "Invalid token payload" };
  }

  const requiredUsername = process.env.NEXT_PUBLIC_KITSU_USERNAME;

  try {
    const { username } = await persistKitsuToken(input);

    if (
      requiredUsername &&
      username &&
      username.toLowerCase() !== requiredUsername.toLowerCase()
    ) {
      await deleteToken("KITSU");
      return {
        ok: false,
        error: `Authenticated as "${username}" but this app requires "${requiredUsername}".`,
      };
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
  provider: SyncProvider | "ALL",
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

export async function logoutAndRedirectAction(provider: SyncProvider) {
  await requireSession();
  await logoutProviderAction(provider);
  redirect("/link");
}

export async function logoutAppAction(): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (session) {
      await auth.api.signOut({ headers: await headers() });
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
