const KITSU_GRAPHQL = "https://kitsu.app/api/graphql";

const USER_DETAILS_QUERY = `
query ($slug: String!) {
  findProfileBySlug(slug: $slug) {
    about
    avatarImage {
      original { url }
    }
    bannerImage {
      original { url }
    }
    birthday
    createdAt
    id
    location
    gender
    name
    slug
    siteLinks(first: 20) {
      nodes { url }
    }
    favorites(first: 100) {
      nodes {
        id
        item {
          __typename
          ...on Anime {
            id
            slug
            posterImage { original { url } }
            titles { canonical }
          }
          ...on Manga {
            id
            slug
            posterImage { original { url } }
            titles { canonical }
          }
          ...on Character {
            id
            slug
            image { original { url } }
            names { canonical }
          }
          ...on Person {
            id
            slug
            image { original { url } }
            names { canonical }
          }
        }
      }
    }
    stats {
      animeAmountConsumed {
        media
        time
        units
      }
      mangaAmountConsumed {
        media
        units
      }
    }
    waifu {
      id
      slug
      image { original { url } }
      names { canonical }
    }
    waifuOrHusbando
  }
}
`;

export interface KitsuFavoriteItem {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  type: "anime" | "manga" | "character" | "person";
}

export interface KitsuUserProfile {
  slug: string;
  name: string;
  about: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  birthday: string | null;
  createdAt: string;
  gender: string | null;
  location: string | null;
  website: string | null;
  waifu: {
    slug: string;
    name: string;
    imageUrl: string | null;
    label: string;
  } | null;
  stats: {
    animeTimeSecs: number | null;
    animeSeries: number | null;
    animeEpisodes: number | null;
    mangaSeries: number | null;
    mangaChapters: number | null;
  };
  favorites: {
    anime: KitsuFavoriteItem[];
    manga: KitsuFavoriteItem[];
    character: KitsuFavoriteItem[];
    person: KitsuFavoriteItem[];
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageUrl(item: any, isMedia: boolean): string | null {
  return isMedia
    ? (item.posterImage?.original?.url ?? null)
    : (item.image?.original?.url ?? null);
}

export async function getKitsuUserProfile(
  slug: string,
): Promise<KitsuUserProfile | null> {
  const res = await fetch(KITSU_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: USER_DETAILS_QUERY, variables: { slug } }),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`Kitsu GraphQL ${res.status}`);

  const json = (await res.json()) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { findProfileBySlug: any | null };
  };

  const base = json.data?.findProfileBySlug;
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

export function formatWatchTime(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days} day${days !== 1 ? "s" : ""}`;
  const years = Math.floor(days / 365);
  const rem = days % 365;
  return rem > 0
    ? `${years} yr${years !== 1 ? "s" : ""} ${rem} day${rem !== 1 ? "s" : ""}`
    : `${years} yr${years !== 1 ? "s" : ""}`;
}

export function formatProfileDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function daysAgo(iso: string): number {
  return Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function ageFromBirthday(iso: string): number {
  const bd = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  if (
    now.getMonth() < bd.getMonth() ||
    (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())
  )
    age--;
  return age;
}
