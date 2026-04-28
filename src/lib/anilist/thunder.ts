import "server-only";
import { getToken } from "@/lib/auth";
import { Thunder } from "@/lib/zeus/anilist";

const ANILIST_GRAPHQL =
  process.env.ANILIST_API_URL ?? "https://graphql.anilist.co";

export const anilistThunder = Thunder(async (query, variables) => {
  const tokenInfo = await getToken("ANILIST");
  const token = tokenInfo?.accessToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 0 },
    } as RequestInit);

    if (res.status === 429) {
      const raw = res.headers.get("Retry-After");
      const parsed = raw != null ? parseInt(raw, 10) : Number.NaN;
      const wait = Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
      console.warn(
        `[AniList] Rate limited — waiting ${wait}s (attempt ${attempt}/${MAX_RETRIES})`,
      );
      if (attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }

    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);

    const body = (await res.json()) as {
      data?: unknown;
      errors?: { message: string }[];
    };
    if (body.errors?.length)
      throw new Error(body.errors.map((e) => e.message).join("; "));
    if (!body.data) throw new Error("AniList GraphQL returned no data");
    return body.data;
  }

  throw new Error("AniList rate limit: exceeded retry limit");
});
