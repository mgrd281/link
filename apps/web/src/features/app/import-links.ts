import type { SocialPlatform } from "./kinds";

/**
 * Moving from another link-in-bio page: which pages we read, how links are found in them, and how
 * found links become profiles and links in the welcome flow. Pure functions; the fetch is in
 * /api/import-links, which only ever asks the hosts below (no other address can be fetched).
 */

/** Link-in-bio services we import from. Subdomain hosts (name.carrd.co) are listed by their base. */
export const IMPORT_HOSTS = [
  "linktr.ee",
  "beacons.ai",
  "bio.link",
  "lnk.bio",
  "solo.to",
  "taplink.cc",
  "campsite.bio",
  "wonderl.ink",
  "allmylinks.com",
  "hoo.be",
  "linkpop.com",
  "msha.ke",
  "snipfeed.co",
  "tap.bio",
  "flow.page",
  "linkin.bio",
  "stan.store",
] as const;
const SUBDOMAIN_HOSTS = ["carrd.co", "komi.io"] as const;

/** The page to import from, or null when it is not one of the services above (or has no name). */
export function importTarget(input: string): URL | null {
  const text = input.trim();
  if (!text || text.length > 300) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const listed = (IMPORT_HOSTS as readonly string[]).includes(host);
  const sub = SUBDOMAIN_HOSTS.some((base) => host.endsWith(`.${base}`) && host.split(".").length === base.split(".").length + 1);
  if (!listed && !sub) return null;
  if (listed && url.pathname.replace(/\/+$/, "") === "") return null;
  url.protocol = "https:";
  url.hostname = host;
  url.hash = "";
  return url;
}

/** May the importer follow a redirect to this address? Only to the same kind of page. */
export const allowedRedirect = (location: string, base: URL): URL | null => {
  try {
    return importTarget(new URL(location, base).toString());
  } catch {
    return null;
  }
};

export interface FoundLink {
  url: string;
  title: string;
}

const JUNK = /\/(privacy|terms|cookie|legal|imprint|impressum|signup|sign-up|register|login|log-in|report|help|support)(\/|$|\?)/i;
const STORES = /(apps\.apple\.com|play\.google\.com)\//i;
const MAX_LINKS = 40;

const decode = (text: string) =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Links in a link-in-bio page: from its embedded page data when there is some, else its anchors. */
export function extractLinks(html: string, page: URL): FoundLink[] {
  const found: FoundLink[] = [];
  const add = (url: unknown, title: unknown) => {
    if (typeof url !== "string") return;
    let parsed: URL;
    try {
      parsed = new URL(url, page);
    } catch {
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:" && parsed.protocol !== "mailto:") return;
    const host = parsed.hostname.replace(/^www\./, "");
    // The service's own pages (its home, sign-up, other profiles) are not the creator's links.
    if (host === page.hostname || host.endsWith(`.${page.hostname}`) || JUNK.test(parsed.pathname) || STORES.test(parsed.href)) return;
    found.push({ url: parsed.href, title: typeof title === "string" ? decode(title).slice(0, 120) : "" });
  };

  // Next.js pages (Linktree and others) carry their links as JSON.
  const data = /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (data) {
    try {
      const props = (JSON.parse(data) as { props?: { pageProps?: Record<string, unknown> } }).props?.pageProps ?? {};
      for (const key of ["links", "pinnedLinks", "socialLinks"]) {
        const list = props[key];
        if (Array.isArray(list)) for (const item of list as { url?: unknown; title?: unknown; type?: unknown }[]) add(item.url, item.title ?? item.type);
      }
    } catch {
      // Not the JSON we know: fall back to the anchors.
    }
  }
  if (!found.length) {
    for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) add(decode(match[1] ?? ""), match[2]);
  }

  const seen = new Set<string>();
  return found
    .filter((link) => {
      const key = link.url.replace(/\/+$/, "").replace(/^https?:\/\/(www\.)?/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_LINKS);
}

/** How a profile address gives away its platform and handle. */
const PROFILE: Record<SocialPlatform, RegExp> = {
  instagram: /^https?:\/\/(?:www\.)?instagram\.com\/([\w.]+)\/?(?:\?.*)?$/i,
  tiktok: /^https?:\/\/(?:www\.)?tiktok\.com\/@([\w.]+)\/?(?:\?.*)?$/i,
  youtube: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/@([\w.-]+)\/?(?:\?.*)?$/i,
  spotify: /^https?:\/\/open\.spotify\.com\/artist\/(\w+)\/?(?:\?.*)?$/i,
  x: /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/(\w+)\/?(?:\?.*)?$/i,
  threads: /^https?:\/\/(?:www\.)?threads\.(?:net|com)\/@([\w.]+)\/?(?:\?.*)?$/i,
  linkedin: /^https?:\/\/(?:[a-z]+\.)?linkedin\.com\/in\/([\w-]+)\/?(?:\?.*)?$/i,
  facebook: /^https?:\/\/(?:www\.|m\.)?facebook\.com\/([\w.]+)\/?(?:\?.*)?$/i,
  whatsapp: /^https?:\/\/wa\.me\/(\d+)\/?(?:\?.*)?$/i,
  github: /^https?:\/\/(?:www\.)?github\.com\/([\w-]+)\/?(?:\?.*)?$/i,
  twitch: /^https?:\/\/(?:www\.)?twitch\.tv\/(\w+)\/?(?:\?.*)?$/i,
  discord: /^https?:\/\/(?:www\.)?discord(?:\.gg|\.com\/invite)\/([\w-]+)\/?(?:\?.*)?$/i,
};

/** The platform and handle of a social profile address (instagram.com/name …), if it is one of these. */
export function socialProfile(url: string, platforms: readonly SocialPlatform[]): { platform: SocialPlatform; handle: string } | null {
  for (const platform of platforms) {
    const handle = PROFILE[platform].exec(url)?.[1];
    if (handle) return { platform, handle };
  }
  return null;
}

/**
 * Sorts imported links for the welcome flow: profiles on the platforms this page asks for go into
 * their fields (only where nothing was typed yet); everything else becomes a pasted link.
 */
export function sortImported(
  links: readonly FoundLink[],
  platforms: readonly SocialPlatform[],
  typed: Partial<Record<SocialPlatform, string>>,
): { handles: Partial<Record<SocialPlatform, string>>; links: string[] } {
  const handles: Partial<Record<SocialPlatform, string>> = {};
  const rest: string[] = [];
  for (const link of links) {
    const platform = platforms.find((candidate) => PROFILE[candidate].test(link.url) && !handles[candidate] && !typed[candidate]?.trim());
    const handle = platform ? PROFILE[platform].exec(link.url)?.[1] : undefined;
    if (platform && handle) handles[platform] = handle;
    else if (!link.url.startsWith("mailto:")) rest.push(link.url);
  }
  return { handles, links: rest };
}
