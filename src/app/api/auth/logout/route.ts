import { NextResponse } from "next/server";
import { deleteToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  try {
    if (provider === "KITSU") {
      await deleteToken("KITSU");
    } else if (provider === "ANILIST") {
      await deleteToken("ANILIST");
    } else {
      await Promise.all([deleteToken("KITSU"), deleteToken("ANILIST")]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
