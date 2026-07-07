import "server-only";
import {
  ANIME_SERIES_KEY,
  computeSeriesTTL,
  getCached,
  MANGA_SERIES_KEY,
  setCached,
} from "@/lib/cache";
import { kitsuThunder } from "@/lib/kitsu/thunder";

export type AnimeSeriesDetail = {
  kitsuId: string;
  titleEn: string | null;
  titleRomaji: string | null;
  episodeCount: number | null;
  posterUrl: string | null;
  updatedAt: string;
};

export async function getAnimeSeriesDetail(
  kitsuId: string,
): Promise<AnimeSeriesDetail | null> {
  const cacheKey = `${ANIME_SERIES_KEY}:${kitsuId}`;

  const cached = await getCached<AnimeSeriesDetail>(cacheKey);
  if (cached) {
    const remainingTTL = computeSeriesTTL(new Date(cached.updatedAt));
    if (remainingTTL > 0) return cached;
    console.warn(
      `[cache] Anime ${kitsuId} stale beyond 7d cutoff - falling back to live fetch`,
    );
  }

  try {
    const result = await kitsuThunder("query")({
      findAnimeBySlug: [
        { slug: kitsuId },
        {
          id: true,
          titles: { canonical: true, romanized: true },
          episodeCount: true,
          updatedAt: true,
          posterImage: { original: { url: true } },
        },
      ],
    });

    const anime = result.findAnimeBySlug;
    if (!anime) return null;

    const detail: AnimeSeriesDetail = {
      kitsuId,
      titleEn: anime.titles?.canonical ?? null,
      titleRomaji: anime.titles?.romanized ?? null,
      episodeCount: anime.episodeCount ?? null,
      posterUrl: anime.posterImage?.original?.url ?? null,
      updatedAt: String(anime.updatedAt),
    };

    await setCached(
      cacheKey,
      detail,
      computeSeriesTTL(new Date(detail.updatedAt)),
    );
    return detail;
  } catch (err) {
    console.error(`[cache] Failed to fetch anime series ${kitsuId}:`, err);
    return null;
  }
}

export type MangaSeriesDetail = {
  kitsuId: string;
  titleEn: string | null;
  titleRomaji: string | null;
  totalChapters: number | null;
  totalVolumes: number | null;
  totalsFromKitsu: boolean;
  posterUrl: string | null;
  updatedAt: string;
};

export async function getMangaSeriesDetail(
  kitsuId: string,
): Promise<MangaSeriesDetail | null> {
  const cacheKey = `${MANGA_SERIES_KEY}:${kitsuId}`;

  const cached = await getCached<MangaSeriesDetail>(cacheKey);
  if (cached) {
    const remainingTTL = computeSeriesTTL(new Date(cached.updatedAt));
    if (remainingTTL > 0) return cached;
    console.warn(
      `[cache] Manga ${kitsuId} stale beyond 7d cutoff - falling back to live fetch`,
    );
  }

  try {
    const result = await kitsuThunder("query")({
      findMangaBySlug: [
        { slug: kitsuId },
        {
          id: true,
          titles: { canonical: true, romanized: true },
          chapterCount: true,
          chapterCountGuess: true,
          volumeCount: true,
          updatedAt: true,
          posterImage: { original: { url: true } },
        },
      ],
    });

    const manga = result.findMangaBySlug;
    if (!manga) return null;

    const totalChapters = manga.chapterCount ?? manga.chapterCountGuess ?? null;
    const totalVolumes = manga.volumeCount ?? null;

    const detail: MangaSeriesDetail = {
      kitsuId,
      titleEn: manga.titles?.canonical ?? null,
      titleRomaji: manga.titles?.romanized ?? null,
      totalChapters,
      totalVolumes,
      totalsFromKitsu: totalChapters !== null || totalVolumes !== null,
      posterUrl: manga.posterImage?.original?.url ?? null,
      updatedAt: String(manga.updatedAt),
    };

    await setCached(
      cacheKey,
      detail,
      computeSeriesTTL(new Date(detail.updatedAt)),
    );
    return detail;
  } catch (err) {
    console.error(`[cache] Failed to fetch manga series ${kitsuId}:`, err);
    return null;
  }
}
