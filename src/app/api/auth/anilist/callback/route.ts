import { NextResponse } from "next/server";
import { exchangeAniListCode } from "@/lib/anilist/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url),
    );
  }

  try {
    await exchangeAniListCode(code);
    return NextResponse.redirect(new URL("/list/anime", request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
