import { NextResponse } from "next/server";
import { buildAniListAuthUrl } from "@/lib/anilist/auth";

export async function GET() {
  const url = buildAniListAuthUrl();
  return NextResponse.redirect(url);
}
