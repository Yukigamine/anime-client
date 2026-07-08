import "server-only";
import type { Browser, LaunchOptions } from "puppeteer-core";

interface StealthResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function isLikelyCloudflareChallenge(result: StealthResponse): boolean {
  const lowerHeaders = Object.fromEntries(
    Object.entries(result.headers).map(([key, value]) => [
      key.toLowerCase(),
      value.toLowerCase(),
    ]),
  );

  const body = result.body.toLowerCase();

  if (lowerHeaders["cf-mitigated"] === "challenge") {
    return true;
  }

  if (
    (result.status === 403 || result.status === 503) &&
    (body.includes("cloudflare") ||
      body.includes("attention required") ||
      body.includes("cdn-cgi/challenge-platform") ||
      body.includes("cf-browser-verification"))
  ) {
    return true;
  }

  return false;
}

const isVercel = Boolean(process.env.VERCEL_ENV);

const deploymentHost =
  process.env.VERCEL_URL ?? process.env.VERCEL_BRANCH_URL ?? null;

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ??
  (deploymentHost ? `https://${deploymentHost}/chromium-pack.tar` : null);

let cachedExecutablePath: string | null = null;
let downloadPromise: Promise<string> | null = null;

async function getChromiumExecutablePath(): Promise<string> {
  if (!isVercel) {
    throw new Error("Chromium executable path helper called outside Vercel");
  }

  if (cachedExecutablePath) return cachedExecutablePath;

  if (!CHROMIUM_PACK_URL) {
    throw new Error(
      "Unable to resolve CHROMIUM_PACK_URL. Set CHROMIUM_PACK_URL or ensure VERCEL_URL is available.",
    );
  }

  if (!downloadPromise) {
    downloadPromise = (async () => {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
      cachedExecutablePath = executablePath;
      return executablePath;
    })().catch((error) => {
      downloadPromise = null;
      throw error;
    });
  }

  return downloadPromise;
}

async function launchBrowser(): Promise<Browser> {
  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = await import("puppeteer-core");
    const executablePath = await getChromiumExecutablePath();

    const launchOptions: LaunchOptions = {
      headless: true,
      args: chromium.args,
      executablePath,
    };

    return puppeteer.launch(launchOptions);
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

export async function kitsuFetch(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<StealthResponse> {
  console.log("[Kitsu Stealth] Launching browser...");
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: Math.floor(1024 + Math.random() * 100),
      height: Math.floor(768 + Math.random() * 100),
    });

    console.log("[Kitsu Stealth] Fetching:", url);

    // Make the request directly from the browser context — no preflight navigation
    // needed since stealth plugin handles TLS fingerprinting at the browser level
    const result = await page.evaluate(
      async (fetchUrl, fetchOptions) => {
        const res = await fetch(fetchUrl, {
          method: fetchOptions.method ?? "GET",
          headers: fetchOptions.headers ?? {},
          body: fetchOptions.body,
        });

        const responseHeaders: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          status: res.status,
          headers: responseHeaders,
          body: await res.text(),
        };
      },
      url,
      options,
    );

    if (isLikelyCloudflareChallenge(result)) {
      const preview = result.body.slice(0, 240).replace(/\s+/g, " ").trim();
      console.warn("[Kitsu Stealth] Cloudflare challenge detected", {
        status: result.status,
        cfMitigated: result.headers["cf-mitigated"] ?? null,
        server: result.headers.server ?? null,
        preview,
      });
      throw new Error("Kitsu request blocked by Cloudflare challenge");
    }

    console.log("[Kitsu Stealth] Response:", result.status);
    return result;
  } finally {
    await browser.close();
  }
}
