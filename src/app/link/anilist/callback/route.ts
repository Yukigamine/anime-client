import { NextResponse } from "next/server";
import { exchangeAniListCode } from "@/lib/anilist/auth";
import { getToken } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/link?error=${encodeURIComponent(error)}`, request.url),
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
        const msg = `Logged in as "${stored.username}" but this app requires "${requiredUsername}".`;
        return NextResponse.redirect(
          new URL(`/link?error=${encodeURIComponent(msg)}`, request.url),
        );
      }
    }

    return NextResponse.redirect(new URL("/sync", request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(`/link?error=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
