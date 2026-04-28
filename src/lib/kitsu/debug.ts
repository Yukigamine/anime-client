export function logKitsuRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
): void {
  const safeHeaders = { ...headers };
  delete safeHeaders.Authorization;
  console.log(`[Kitsu] ${method} ${url}`, { headers: safeHeaders });
}

export function logKitsuResponse(
  url: string,
  status: number,
  headers: Headers,
): void {
  const cfMitigated = headers.get("cf-mitigated");
  const contentType = headers.get("content-type");
  const cacheStatus = headers.get("cf-cache-status");
  const server = headers.get("server");

  console.log(`[Kitsu Response] ${status}`, {
    url,
    cfMitigated,
    contentType,
    cacheStatus,
    server,
    headers: {
      "cf-cache-status": cacheStatus,
      "cf-mitigated": cfMitigated,
      server,
    },
  });
}

export function logKitsuError(
  url: string,
  status: number,
  responseText: string,
  headers?: Headers,
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
    cloudflareHeaders: headers
      ? {
          "cf-mitigated": headers.get("cf-mitigated"),
          "cf-cache-status": headers.get("cf-cache-status"),
          "cf-ray": headers.get("cf-ray"),
          server: headers.get("server"),
          "set-cookie": headers.has("set-cookie") ? "[present]" : null,
        }
      : null,
  });
}
