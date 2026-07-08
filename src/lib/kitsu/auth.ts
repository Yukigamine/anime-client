import "server-only";
import { getToken, saveToken } from "@/lib/auth";
import { Zeus } from "@/lib/zeus/kitsu";

const KITSU_GRAPHQL =
  process.env.KITSU_API_URL ?? "https://kitsu.app/api/graphql";
const KITSU_TOKEN_URL =
  process.env.KITSU_OAUTH_URL ?? "https://kitsu.app/api/oauth/token";

interface KitsuTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function parseTokenResponse(res: Response): Promise<KitsuTokenResponse> {
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as {
        error?: string;
        error_description?: string;
      };
      if (data.error_description) errorMsg = data.error_description;
      else if (data.error) errorMsg = data.error;
    } catch {
      // Fallback for non-JSON responses.
    }
    throw new Error(`Kitsu token exchange failed: ${errorMsg}`);
  }

  return (await res.json()) as KitsuTokenResponse;
}

async function fetchCurrentProfile(
  accessToken: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  try {
    const query = Zeus("query", {
      currentProfile: { id: true, slug: true, name: true },
    });

    const res = await fetch(KITSU_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: {
        currentProfile: { id: string; slug: string; name: string } | null;
      };
    };
    return body.data?.currentProfile ?? null;
  } catch (err) {
    console.error("Failed to fetch Kitsu profile:", err);
    return null;
  }
}

type PersistKitsuTokenInput = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn: number;
  fallbackUsername?: string | null;
};

export async function persistKitsuToken({
  accessToken,
  refreshToken,
  expiresIn,
  fallbackUsername,
}: PersistKitsuTokenInput): Promise<{ username: string | null }> {
  const profile = await fetchCurrentProfile(accessToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const username = profile?.slug ?? profile?.name ?? fallbackUsername ?? null;

  await saveToken("KITSU", {
    accessToken,
    refreshToken: refreshToken ?? null,
    expiresAt,
    providerUserId: profile?.id ?? null,
    username,
  });

  return { username };
}

async function refreshKitsuToken(refreshToken: string): Promise<string> {
  const clientId = process.env.KITSU_CLIENT_ID ?? "";
  const clientSecret = process.env.KITSU_CLIENT_SECRET ?? "";

  const res = await fetch(KITSU_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(
      Object.fromEntries(
        [
          ["grant_type", "refresh_token"],
          ["refresh_token", refreshToken],
          ["client_id", clientId],
          ["client_secret", clientSecret],
        ].filter(([, value]) => value !== ""),
      ),
    ),
    cache: "no-store",
  });

  const data = await parseTokenResponse(res);
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await saveToken("KITSU", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt,
  });

  return data.access_token;
}

export async function ensureValidKitsuToken(): Promise<string | null> {
  const token = await getToken("KITSU");
  if (!token) return null;

  if (
    token.refreshToken &&
    token.expiresAt &&
    token.expiresAt < new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return await refreshKitsuToken(token.refreshToken);
  }

  return token.accessToken;
}
