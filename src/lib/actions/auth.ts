"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteToken, getToken } from "@/lib/auth";
import { auth } from "@/lib/betterauth";
import { loginKitsu } from "@/lib/kitsu/auth";
import { getSession, requireSession } from "@/lib/session";
import type { ActionResult, SyncProvider } from "./types";

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
