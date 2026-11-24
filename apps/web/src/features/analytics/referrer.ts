/**
 * Where a visit came from, as one of a few groups. The beacon sends only the referring page's host
 * name (never its path or query), and the server keeps only the group: "instagram", never the post.
 * The same list is in the migration (page_stats_record), which stores anything else as "other".
 */
export const REFERRER_GROUPS = ["instagram", "tiktok", "youtube", "facebook", "x", "linkedin", "search", "qr", "direct", "other"] as const;
export type ReferrerGroup = (typeof REFERRER_GROUPS)[number];

/** Host names by group: the host itself or any subdomain of it ("l.instagram.com", "m.youtube.com"). */
const HOSTS: readonly [ReferrerGroup, readonly string[]][] = [
  ["instagram", ["instagram.com"]],
  ["tiktok", ["tiktok.com"]],
  ["youtube", ["youtube.com", "youtu.be"]],
  ["facebook", ["facebook.com", "fb.com", "fb.me", "messenger.com"]],
  ["x", ["x.com", "twitter.com", "t.co"]],
  ["linkedin", ["linkedin.com", "lnkd.in"]],
  ["search", ["bing.com", "duckduckgo.com", "ecosia.org", "startpage.com", "qwant.com", "search.brave.com", "yandex.com", "yandex.ru", "baidu.com"]],
];

/** Search engines with a country domain of their own ("google.de", "google.co.uk", "de.search.yahoo.com"). */
const SEARCH = /^(?:[a-z0-9-]+\.)*(?:google|yahoo|yandex)\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

const within = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** A host name as sent by the beacon: lower case, no port, no trailing dot; "" when it is not one. */
export function cleanHost(value: unknown): string {
  if (typeof value !== "string") return "";
  const host = value.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes(".") ? host : "";
}

/**
 * The group of a visit: `referrer` is the referring host ("" when the browser sent none), `own` the
 * page's own host and `source` a marker the page address carried (`?src=qr`). null means a step inside
 * the same site (from the page to one of its projects): a view, but no new source.
 */
export function referrerGroup(referrer: string, own: string, source?: string | null): ReferrerGroup | null {
  if (source === "qr") return "qr";
  const host = cleanHost(referrer);
  // No referrer: typed in, a bookmark, or an app that does not pass one on (WhatsApp, Telegram, Mail).
  if (!host) return "direct";
  if (host === cleanHost(own)) return null;
  for (const [group, domains] of HOSTS) if (domains.some((domain) => within(host, domain))) return group;
  if (SEARCH.test(host)) return "search";
  return "other";
}
