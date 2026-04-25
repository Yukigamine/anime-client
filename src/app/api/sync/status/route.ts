import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [logs, auth] = await Promise.all([
    prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    getAuthStatus(),
  ]);

  return NextResponse.json({ logs, auth });
}
