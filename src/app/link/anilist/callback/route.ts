import { NextResponse } from "next/server";
import { exchangeAniListCode } from "@/lib/anilist/auth";
import { getToken } from "@/lib/auth";

// Allowlist of safe error messages to surface to the user.
const SAFE_ERRORS = new Set(["access_denied", "missing_code"]);

function safeError(raw: string): string {
  if (SAFE_ERRORS.has(raw)) return raw;
  // Don't leak internal details; log server-side instead
  return "authentication_failed";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/link?error=${encodeURIComponent(safeError(error))}`,
        request.url,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/link?error=missing_code", request.url),
    );
  }

  try {
    await exchangeAniListCode(code);

    const requiredUsername = process.env.NEXT_PUBLIC_ANILIST_USERNAME;
    if (requiredUsername) {
      const stored = await getToken("ANILIST");
      if (
        stored?.username &&
        stored.username.toLowerCase() !== requiredUsername.toLowerCase()
      ) {
        console.warn(
          `[anilist/callback] Expected "${requiredUsername}" but got "${stored.username}"`,
        );
        return NextResponse.redirect(
          new URL(
            `/link?error=${encodeURIComponent("wrong_account")}`,
            request.url,
          ),
        );
      }
    }

    return NextResponse.redirect(new URL("/sync", request.url));
  } catch (err) {
    console.error("[anilist/callback] token exchange error:", err);
    return NextResponse.redirect(
      new URL("/link?error=authentication_failed", request.url),
    );
  }
}
