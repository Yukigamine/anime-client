import { NextResponse } from "next/server";
import { pullAniList, pushAniList } from "@/lib/anilist/sync";
import { invalidateListCache } from "@/lib/cache";
import { prisma } from "@/lib/db";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function checkSecret(request: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true;
  return request.headers.get("x-sync-secret") === secret;
}

export async function POST(request: Request) {
  if (!checkSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const direction = (searchParams.get("direction") ?? "pull").toUpperCase();

  if (direction !== "PULL" && direction !== "PUSH") {
    return NextResponse.json(
      { error: "direction must be pull or push" },
      { status: 400 },
    );
  }

  const log = await prisma.syncLog.create({
    data: {
      provider: "ANILIST",
      direction: direction as "PULL" | "PUSH",
      status: "RUNNING",
    },
  });

  try {
    if (direction === "PULL") {
      await pullAniList(log.id);
    } else {
      await pushAniList(log.id);
    }
    await invalidateListCache();
    const updated = await prisma.syncLog.findUnique({ where: { id: log.id } });
    return NextResponse.json({ ok: true, log: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errors: [message],
        finishedAt: new Date(),
      },
    });
    return NextResponse.json(
      { error: message, logId: log.id },
      { status: 500 },
    );
  }
}
