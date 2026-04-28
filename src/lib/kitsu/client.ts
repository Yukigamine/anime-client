import { Thunder } from "@/lib/zeus/kitsu";

const KITSU_GRAPHQL =
  process.env.NEXT_PUBLIC_KITSU_API_URL ?? "https://kitsu.app/api/graphql";

export const kitsuClient = Thunder(async (query, variables) => {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Referer: "https://kitsu.app",
    Origin: "https://kitsu.app",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Ch-Ua":
      '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    DNT: "1",
    Connection: "keep-alive",
  };

  console.log(`[Kitsu] POST ${KITSU_GRAPHQL}`, { headers });

  const res = await fetch(KITSU_GRAPHQL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const cfMitigated = res.headers.get("cf-mitigated");
  const cacheStatus = res.headers.get("cf-cache-status");
  const cfRay = res.headers.get("cf-ray");
  console.log(`[Kitsu Response] ${res.status}`, {
    cfMitigated,
    cacheStatus,
    cfRay,
    contentType: res.headers.get("content-type"),
  });

  if (cfMitigated === "challenge") {
    throw new Error(
      "Cloudflare challenge detected — Kitsu API is blocking requests",
    );
  }

  if (!res.ok) {
    const text = await res.text();
    const preview = text.substring(0, 500);
    const isHtml = text.includes("<!DOCTYPE") || text.includes("<html");
    const isCloudflareChallenge =
      text.includes("Cloudflare") || text.includes("cf_clearance");
    console.error(`[Kitsu Error] ${res.status}`, {
      isHtmlResponse: isHtml,
      isCloudflareChallenge,
      cfRay,
      responsePreview: preview,
    });
    throw new Error(`Kitsu GraphQL ${res.status}`);
  }

  const body = (await res.json()) as {
    data?: unknown;
    errors?: { message: string }[];
  };

  if (body.errors?.length) throw new Error(body.errors[0].message);
  if (!body.data) throw new Error("Kitsu GraphQL returned no data");

  return body.data;
});
