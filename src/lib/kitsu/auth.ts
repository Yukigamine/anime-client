import "server-only";
import { getToken, saveToken } from "@/lib/auth";
import { kitsuFetch } from "@/lib/kitsu/stealth";
import { Zeus } from "@/lib/zeus/kitsu";

const KITSU_GRAPHQL =
  process.env.KITSU_API_URL ?? "https://kitsu.app/api/graphql";
const KITSU_OAUTH =
  process.env.KITSU_OAUTH_URL ?? "https://kitsu.app/api/oauth/token";

interface KitsuTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

function logKitsuError(
  url: string,
  status: number,
  responseText: string,
): void {
  const preview = responseText.substring(0, 500);
  const isHtml =
    responseText.includes("<!DOCTYPE") || responseText.includes("<html");
  const isCloudflareChallenge =
    responseText.includes("Cloudflare") ||
    responseText.includes("cf_clearance");

  console.error(`[Kitsu Error] ${status} from ${url}`, {
    isHtmlResponse: isHtml,
    isCloudflareChallenge,
    responsePreview: preview,
    responseLength: responseText.length,
  });
}

function checkCloudflareChallenge(
  status: number,
  headers: Record<string, string>,
  body: string,
): void {
  const cfMitigated = headers["cf-mitigated"];
  if (cfMitigated === "challenge") {
    throw new Error(
      "Cloudflare challenge detected — Kitsu API is blocking requests",
    );
  }
  // Fallback: detect Cloudflare HTML even without the header
  if (
    status === 403 &&
    (body.includes("<!DOCTYPE") || body.includes("Cloudflare"))
  ) {
    throw new Error(`Cloudflare blocked request (${status})`);
  }
}

async function fetchCurrentProfile(
  accessToken: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  try {
    const query = Zeus("query", {
      currentProfile: { id: true, slug: true, name: true },
    });

    const res = await kitsuFetch(KITSU_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    });

    console.log(`[Kitsu] fetchCurrentProfile ${res.status}`, {
      cfMitigated: res.headers["cf-mitigated"],
    });

    checkCloudflareChallenge(res.status, res.headers, res.body);
    if (res.status < 200 || res.status >= 300) return null;

    const body = JSON.parse(res.body) as {
      data?: {
        currentProfile: { id: string; slug: string; name: string } | null;
      };
    };
    return body.data?.currentProfile ?? null;
  } catch (err) {
    console.error("[Kitsu] fetchCurrentProfile error:", err);
    return null;
  }
}

export async function loginKitsu(
  username: string,
  password: string,
  totp?: string,
): Promise<string> {
  const params: Record<string, string> = {
    grant_type: "password",
    username,
    password,
  };
  if (totp) params.totp = totp;

  console.log(`[Kitsu] loginKitsu → ${KITSU_OAUTH}`);

  const res = await kitsuFetch(KITSU_OAUTH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
    },
    body: new URLSearchParams(params).toString(),
  });

  console.log(`[Kitsu] loginKitsu ${res.status}`, {
    cfMitigated: res.headers["cf-mitigated"],
    contentType: res.headers["content-type"],
  });

  checkCloudflareChallenge(res.status, res.headers, res.body);

  if (res.status < 200 || res.status >= 300) {
    logKitsuError(KITSU_OAUTH, res.status, res.body);
    let errorMsg = `Kitsu login failed (${res.status})`;
    try {
      const data = JSON.parse(res.body);
      if (data.error) errorMsg = `${data.error} (${res.status})`;
    } catch {
      // Non-JSON response
    }
    throw new Error(errorMsg);
  }

  const data = JSON.parse(res.body) as KitsuTokenResponse;
  const profile = await fetchCurrentProfile(data.access_token);
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await saveToken("KITSU", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    providerUserId: profile?.id ?? null,
    username: profile?.slug ?? profile?.name ?? username,
  });

  return data.access_token;
}

async function refreshKitsuToken(refreshToken: string): Promise<string> {
  console.log(`[Kitsu] refreshKitsuToken → ${KITSU_OAUTH}`);

  const res = await kitsuFetch(KITSU_OAUTH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  console.log(`[Kitsu] refreshKitsuToken ${res.status}`, {
    cfMitigated: res.headers["cf-mitigated"],
  });

  checkCloudflareChallenge(res.status, res.headers, res.body);

  if (res.status < 200 || res.status >= 300) {
    logKitsuError(KITSU_OAUTH, res.status, res.body);
    throw new Error(`Kitsu token refresh failed (${res.status})`);
  }

  const data = JSON.parse(res.body) as KitsuTokenResponse;
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await saveToken("KITSU", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
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
