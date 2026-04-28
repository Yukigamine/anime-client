import "server-only";
import { ensureValidKitsuToken } from "@/lib/kitsu/auth";
import { kitsuFetch } from "@/lib/kitsu/stealth";
import { Thunder } from "@/lib/zeus/kitsu";

const KITSU_GRAPHQL =
  process.env.KITSU_API_URL ?? "https://kitsu.app/api/graphql";

function createKitsuThunder(requireAuth: boolean) {
  return Thunder(async (query, variables) => {
    let token: string | null = null;

    if (requireAuth) {
      try {
        token = await ensureValidKitsuToken();
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        console.error("Failed to ensure valid Kitsu token:", err);
        throw e;
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://kitsu.app/",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await kitsuFetch(KITSU_GRAPHQL, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (res.headers["cf-mitigated"] === "challenge") {
        throw new Error("Kitsu GraphQL blocked by Cloudflare challenge");
      }

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Kitsu GraphQL ${res.status}`);
      }

      const responseBody = JSON.parse(res.body) as {
        data?: unknown;
        errors?: { message: string }[];
      };

      if (responseBody.errors?.length) {
        throw new Error(responseBody.errors[0].message);
      }
      if (!responseBody.data) {
        throw new Error("Kitsu GraphQL returned no data");
      }
      return responseBody.data;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error("Kitsu GraphQL error:", err);
      throw e;
    }
  });
}

export const kitsuThunder = createKitsuThunder(false);
export const kitsuThunderAuth = createKitsuThunder(true);
