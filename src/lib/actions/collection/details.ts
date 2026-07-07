"use server";

import type { MangaSeriesDetail } from "@/lib/kitsu/cache";
import { getMangaSeriesDetail } from "@/lib/kitsu/cache";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";

export async function fetchMangaSeriesDetail(
  kitsuId: string,
): Promise<ActionResult<MangaSeriesDetail>> {
  await requireSession();
  try {
    const detail = await getMangaSeriesDetail(kitsuId);
    if (!detail) {
      return { ok: false, error: "Series not found" };
    }
    return { ok: true, data: detail };
  } catch (err) {
    console.error("[collection] fetchMangaSeriesDetail error:", err);
    return { ok: false, error: "Failed to fetch series details" };
  }
}
