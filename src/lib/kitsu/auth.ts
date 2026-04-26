import { saveToken } from "@/lib/auth";

const KITSU_OAUTH = "https://kitsu.io/api/oauth/token";
const KITSU_API = "https://kitsu.io/api/edge";

export interface KitsuTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function loginKitsu(
  username: string,
  password: string,
): Promise<string> {
  const clientId =
    process.env.KITSU_CLIENT_ID ??
    "dd031b32d2f56c990b1425efe6c42ad847e7be3fd1d1f097b730ac4e9f63de41";
  const clientSecret =
    process.env.KITSU_CLIENT_SECRET ??
    "54d7307928f63414defd96399fc31ba847961ceaecef3a5fd93144e960c0e151";

  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(KITSU_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kitsu login failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as KitsuTokenResponse;

  const userRes = await fetch(`${KITSU_API}/users?filter[self]=true`, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${data.access_token}`,
    },
  });
  const userData = userRes.ok
    ? ((await userRes.json()) as {
        data: { id: string; attributes: { name: string; slug: string } }[];
      })
    : null;

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await saveToken("KITSU", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    providerUserId: userData?.data[0]?.id ?? null,
    // slug is the identifier used in Kitsu URLs and GraphQL queries
    username:
      userData?.data[0]?.attributes?.slug ??
      userData?.data[0]?.attributes?.name ??
      username,
  });

  return data.access_token;
}

export async function refreshKitsuToken(refreshToken: string): Promise<string> {
  const clientId =
    process.env.KITSU_CLIENT_ID ??
    "dd031b32d2f56c990b1425efe6c42ad847e7be3fd1d1f097b730ac4e9f63de41";
  const clientSecret =
    process.env.KITSU_CLIENT_SECRET ??
    "54d7307928f63414defd96399fc31ba847961ceaecef3a5fd93144e960c0e151";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(KITSU_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Kitsu token refresh failed (${res.status})`);

  const data = (await res.json()) as KitsuTokenResponse;
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await saveToken("KITSU", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  });

  return data.access_token;
}
