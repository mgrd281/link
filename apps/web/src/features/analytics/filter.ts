/**
 * Which requests to /api/collect are never counted. Pure functions of the request's headers, so the
 * route and its tests share them. A request that fails any of them answers 204 like every other, and
 * nothing is stored.
 */

/**
 * Crawlers, link-preview fetchers, uptime monitors, headless browsers and HTTP libraries. Real people
 * in an app's own browser stay counted: Instagram's and Facebook's in-app browsers say "Instagram" and
 * "FBAN", LinkedIn's "LinkedInApp", TikTok's "BytedanceWebview", none of which is listed here.
 */
const BOT =
  /bot[/;)+-]|\bbot\b|crawl|spider|slurp|mediapartners|facebookexternalhit|facebookcatalog|embedly|quora link preview|outbrain|pinterest\/|vkshare|w3c_validator|whatsapp|skypeuripreview|nuzzel|baiduspider|bingpreview|petalbot|semrush|ahrefs|headless|phantomjs|lighthouse|pingdom|uptime|statuscake|gtmetrix|pagespeed|google-inspectiontool|\bpreview\b|monitor|curl\/|wget|python-|aiohttp|httpx|axios|node-fetch|undici|go-http-client|java\/|okhttp|libwww|scrapy|postman|insomnia/i;

/** A user agent that is no person's browser, or none at all. */
export function isBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  if (ua.length < 12) return true;
  // Every browser people use names itself "Mozilla/5.0 (…)"; scripts and fetchers mostly do not.
  if (!ua.startsWith("Mozilla/")) return true;
  return BOT.test(ua);
}

/** The visitor asked not to be tracked: Global Privacy Control (`Sec-GPC: 1`) or Do Not Track (`DNT: 1`). */
export function optedOut(headers: Headers): boolean {
  return headers.get("sec-gpc")?.trim() === "1" || headers.get("dnt")?.trim() === "1";
}

/** A prefetch or prerender the visitor may never look at (`Sec-Purpose` / `Purpose`). */
export function isPrefetch(headers: Headers): boolean {
  return /prefetch|prerender/i.test(`${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""} ${headers.get("x-purpose") ?? ""}`);
}

/**
 * Sent by one of our own pages: the browser says the request is same-origin (`Sec-Fetch-Site`) and,
 * when it names an origin, it is this host. A request that names neither (a script) is no page view.
 */
export function fromOwnPage(headers: Headers, host: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return false;
  const origin = headers.get("origin");
  // Browsers without fetch metadata (older Safari) still name the page's origin on a POST.
  if (!origin || origin === "null") return site === "same-origin";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
