import { NextResponse } from "next/server";
import { syncAniList } from "@/lib/anilist/sync";
import { invalidateListCache } from "@/lib/cache";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.SYNC_SECRET;
  if (secret) {
    const auth = request.headers.get("x-sync-secret");
    if (auth !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const username = process.env.ANILIST_USERNAME;
  if (!username) {
    return NextResponse.json(
      { error: "ANILIST_USERNAME not configured" },
      { status: 500 },
    );
  }

  try {
    const result = await syncAniList(username);
    await invalidateListCache();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
