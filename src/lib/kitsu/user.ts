import "server-only";
import { kitsuThunder } from "./thunder";
import type { KitsuFavoriteItem, KitsuUserProfile } from "./user-types";

function extractImageUrl(item: any, isMedia: boolean): string | null {
  return isMedia
    ? (item.posterImage?.original?.url ?? null)
    : (item.image?.original?.url ?? null);
}

export async function getKitsuUserProfile(
  slug: string,
): Promise<KitsuUserProfile | null> {
  const result = await kitsuThunder("query")({
    findProfileBySlug: [
      { slug },
      {
        about: true,
        avatarImage: { original: { url: true } },
        bannerImage: { original: { url: true } },
        birthday: true,
        createdAt: true,
        id: true,
        location: true,
        gender: true,
        name: true,
        slug: true,
        siteLinks: [{ first: 20 }, { nodes: { url: true } }],
        favorites: [
          { first: 100 },
          {
            nodes: {
              id: true,
              item: {
                __typename: true,
                "...on Anime": {
                  id: true,
                  slug: true,
                  posterImage: { original: { url: true } },
                  titles: { canonical: true },
                },
                "...on Manga": {
                  id: true,
                  slug: true,
                  posterImage: { original: { url: true } },
                  titles: { canonical: true },
                },
                "...on Character": {
                  id: true,
                  slug: true,
                  image: { original: { url: true } },
                  names: { canonical: true },
                },
                "...on Person": {
                  id: true,
                  slug: true,
                  image: { original: { url: true } },
                  names: { canonical: true },
                },
              },
            },
          },
        ],
        stats: {
          animeAmountConsumed: { media: true, time: true, units: true },
          mangaAmountConsumed: { media: true, units: true },
        },
        waifu: {
          id: true,
          slug: true,
          image: { original: { url: true } },
          names: { canonical: true },
        },
        waifuOrHusbando: true,
      },
    ],
  });
  const base = (result as any)?.findProfileBySlug;
  if (!base) return null;

  const favorites: KitsuUserProfile["favorites"] = {
    anime: [],
    manga: [],
    character: [],
    person: [],
  };

  for (const node of base.favorites?.nodes ?? []) {
    const item = node?.item;
    if (!item) continue;
    const rawType = (item.__typename as string).toLowerCase();
    if (
      rawType !== "anime" &&
      rawType !== "manga" &&
      rawType !== "character" &&
      rawType !== "person"
    )
      continue;
    const type = rawType as KitsuFavoriteItem["type"];
    const isMedia = type === "anime" || type === "manga";
    const name = isMedia
      ? (item.titles?.canonical ?? "Unknown")
      : (item.names?.canonical ?? "Unknown");

    favorites[type].push({
      id: node.id,
      slug: item.slug,
      name,
      imageUrl: extractImageUrl(item, isMedia),
      type,
    });
  }

  const waifuBase = base.waifu;
  const waifu = waifuBase
    ? {
        slug: waifuBase.slug,
        name: waifuBase.names?.canonical ?? "Unknown",
        imageUrl: waifuBase.image?.original?.url ?? null,
        label: (base.waifuOrHusbando as string | null) ?? "Waifu",
      }
    : null;

  return {
    slug: base.slug,
    name: base.name,
    about: (base.about as string | null) || null,
    avatarUrl: base.avatarImage?.original?.url ?? null,
    bannerUrl: base.bannerImage?.original?.url ?? null,
    birthday: (base.birthday as string | null) ?? null,
    createdAt: base.createdAt as string,
    gender: (base.gender as string | null) ?? null,
    location: (base.location as string | null) ?? null,
    website: base.siteLinks?.nodes?.[0]?.url ?? null,
    waifu,
    stats: {
      animeTimeSecs: base.stats?.animeAmountConsumed?.time ?? null,
      animeSeries: base.stats?.animeAmountConsumed?.media ?? null,
      animeEpisodes: base.stats?.animeAmountConsumed?.units ?? null,
      mangaSeries: base.stats?.mangaAmountConsumed?.media ?? null,
      mangaChapters: base.stats?.mangaAmountConsumed?.units ?? null,
    },
    favorites,
  };
}
