import { Thunder } from "@/lib/zeus/kitsu";
import { assertNoCloudflareChallenge, kitsuFetch } from "./fetch";

const KITSU_GRAPHQL =
  process.env.NEXT_PUBLIC_KITSU_API_URL ?? "https://kitsu.app/api/graphql";

export const kitsuClient = Thunder(async (query, variables) => {
  const headers: Record<string, string> = {
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

  const result = await kitsuFetch(KITSU_GRAPHQL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  assertNoCloudflareChallenge(result);

  if (result.status < 200 || result.status >= 300) {
    const preview = result.body.substring(0, 500);
    const body = result.body;
    const isHtml = body.includes("<!DOCTYPE") || body.includes("<html");
    const isCloudflareChallenge =
      body.includes("Cloudflare") || body.includes("cf_clearance");
    console.error(`[Kitsu Error] ${result.status}`, {
      isHtmlResponse: isHtml,
      isCloudflareChallenge,
      cfRay: result.headers["cf-ray"] ?? null,
      responsePreview: preview,
    });
    throw new Error(`Kitsu GraphQL ${result.status}`);
  }

  const body = JSON.parse(result.body) as {
    data?: unknown;
    errors?: { message: string }[];
  };

  if (body.errors?.length) throw new Error(body.errors[0].message);
  if (!body.data) throw new Error("Kitsu GraphQL returned no data");

  return body.data;
});
