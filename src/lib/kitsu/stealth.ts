import "server-only";
import type { LaunchOptions } from "puppeteer-core";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getServerBaseUrl } from "@/lib/base-url";

type AddExtraInput = Parameters<typeof addExtra>[0];

function toAddExtraInput(
  puppeteerLib: Pick<
    AddExtraInput,
    "connect" | "defaultArgs" | "executablePath" | "launch"
  > & { createBrowserFetcher?: AddExtraInput["createBrowserFetcher"] },
): AddExtraInput {
  const { connect, defaultArgs, executablePath, launch } = puppeteerLib;

  const createBrowserFetcher: AddExtraInput["createBrowserFetcher"] =
    puppeteerLib.createBrowserFetcher ??
    (() => {
      throw new Error("createBrowserFetcher is not supported in Puppeteer v25");
    });

  return {
    connect,
    defaultArgs,
    executablePath,
    launch,
    createBrowserFetcher,
  };
}

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

function resolveChromiumPackUrl(): string | null {
  const baseUrl = getServerBaseUrl();
  if (baseUrl) {
    return `${baseUrl}/chromium-pack.tar`;
  }

  return null;
}

const CHROMIUM_PACK_URL = resolveChromiumPackUrl();

let cachedExecutablePath: string | null = null;
let downloadPromise: Promise<string> | null = null;

async function validateChromiumPackUrl(url: string): Promise<void> {
  const response = await fetch(url, {
    headers: { Range: "bytes=0-511" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Chromium pack URL returned HTTP ${response.status}: ${url}`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const magic = new TextDecoder().decode(bytes.slice(257, 262));

  if (magic === "ustar") {
    return;
  }

  const preview = new TextDecoder()
    .decode(bytes.slice(0, 160))
    .replace(/\s+/g, " ")
    .trim();

  throw new Error(
    `Chromium pack URL did not return a valid tar archive: ${url} (preview: ${preview || "<binary>"})`,
  );
}

async function getChromiumExecutablePath(): Promise<string> {
  if (!isVercel) {
    throw new Error("Chromium executable path helper called outside Vercel");
  }

  if (cachedExecutablePath) return cachedExecutablePath;

  if (!CHROMIUM_PACK_URL) {
    throw new Error(
      "Unable to resolve CHROMIUM_PACK_URL. Set CHROMIUM_PACK_URL or configure the shared app base URL envs.",
    );
  }

  if (!downloadPromise) {
    downloadPromise = (async () => {
      console.log(
        "[Kitsu Stealth] Resolving Chromium pack URL:",
        CHROMIUM_PACK_URL,
      );
      await validateChromiumPackUrl(CHROMIUM_PACK_URL);

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

async function launchBrowser() {
  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteerCore = await import("puppeteer-core");
    const puppeteer = addExtra(toAddExtraInput(puppeteerCore));
    puppeteer.use(StealthPlugin());
    const executablePath = await getChromiumExecutablePath();

    const launchOptions: LaunchOptions = {
      headless: true,
      args: chromium.args,
      executablePath,
    };

    return puppeteer.launch(launchOptions);
  }

  const puppeteerLib = await import("puppeteer");
  const puppeteer = addExtra(toAddExtraInput(puppeteerLib));
  puppeteer.use(StealthPlugin());
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
