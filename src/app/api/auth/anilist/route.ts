import { NextResponse } from "next/server";
import { buildAniListAuthUrl } from "@/lib/anilist/auth";

// GET /api/auth/anilist  →  redirect to AniList OAuth consent page
export async function GET() {
  const url = buildAniListAuthUrl();
  return NextResponse.redirect(url);
}
