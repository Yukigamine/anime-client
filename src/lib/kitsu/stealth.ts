import "server-only";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export interface StealthResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
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
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

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

    console.log("[Kitsu Stealth] Response:", result.status);
    return result;
  } finally {
    await browser.close();
  }
}
