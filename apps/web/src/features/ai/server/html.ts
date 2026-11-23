import type { FoundLink } from "@/features/app/import-links";

import { scanPage, stripCode, stripTags, type PageScan } from "./html-scan";

/**
 * What a personal website says about its owner, read from its HTML without running anything: the
 * title, the description (meta or Open Graph), the person or organisation in its JSON-LD (name,
 * description, `sameAs` profiles), `rel="me"` links and the links to other sites. No picture is
 * downloaded and no script is executed; only `https:` and `mailto:` links are kept.
 *
 * The page is whatever a stranger's server sends (up to 1 MiB): everything here reads it in one
 * direction, in time that grows with its length (see html-scan.ts), and what it keeps is capped.
 */

export interface PageFacts {
  title?: string | undefined;
  description?: string | undefined;
  /** JSON-LD Person / Organization. */
  name?: string | undefined;
  bio?: string | undefined;
  sameAs: string[];
  relMe: string[];
  /** Links to other sites (the site's own pages are left out). */
  links: FoundLink[];
}

/** The named entities pages use for text (others are left as written). */
const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  eacute: "é",
  egrave: "è",
};

/** HTML entities decoded, tags removed, whitespace collapsed. */
export function decodeText(text: string): string {
  return stripTags(text)
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#")) {
        const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[entity] ?? ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const cap = (text: string | undefined, max: number): string | undefined => {
  if (!text) return undefined;
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};

const PERSON_TYPES = new Set(["person", "organization", "musicgroup", "localbusiness", "corporation", "performinggroup", "store"]);

interface Entity {
  name?: string;
  description?: string;
  sameAs: string[];
}

/** How many people or organisations of a page are read, and how many profile links are kept. */
const ENTITIES_MAX = 20;
const PROFILE_LINKS_MAX = 40;

/** Person and Organization entities in JSON-LD (also inside @graph and a ProfilePage's mainEntity). */
function entities(value: unknown, out: Entity[], depth = 0): void {
  if (depth > 6 || out.length >= ENTITIES_MAX || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) {
      if (out.length >= ENTITIES_MAX) return;
      entities(item, out, depth + 1);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  const types = (Array.isArray(record["@type"]) ? record["@type"].slice(0, 8) : [record["@type"]]).filter((type): type is string => typeof type === "string").map((type) => type.toLowerCase());
  if (types.some((type) => PERSON_TYPES.has(type))) {
    const sameAs = (Array.isArray(record.sameAs) ? record.sameAs.slice(0, PROFILE_LINKS_MAX) : [record.sameAs]).filter((url): url is string => typeof url === "string");
    out.push({
      ...(typeof record.name === "string" ? { name: record.name } : {}),
      ...(typeof record.description === "string" ? { description: record.description } : {}),
      sameAs,
    });
  }
  for (const key of ["@graph", "mainEntity", "author", "founder"]) entities(record[key], out, depth + 1);
}

/** No address we keep is longer (the fetcher refuses longer ones too). */
const URL_MAX = 2_048;

const httpsOrMail = (url: string, base: URL): string | null => {
  if (url.length > URL_MAX) return null;
  try {
    const parsed = new URL(url, base);
    return parsed.protocol === "https:" || parsed.protocol === "mailto:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

// ── Links ────────────────────────────────────────────────────────────────────

// The importer's rules (features/app/import-links.ts `extractLinks`), on the linear scanner.
const JUNK = /\/(privacy|terms|cookie|legal|imprint|impressum|signup|sign-up|register|login|log-in|report|help|support)(\/|$|\?)/i;
const STORES = /(apps\.apple\.com|play\.google\.com)\//i;
const LINKS_MAX = 40;
/** How many candidates are weighed for those links. */
const CANDIDATES_MAX = 2_000;

/** The address without its scheme, "www." and trailing slashes, lower-cased: two spellings of one link. */
const linkKey = (url: string): string => {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end -= 1;
  return url
    .slice(0, end)
    .replace(/^https?:\/\/(www\.)?/, "")
    .toLowerCase();
};

function collectLinks(scan: PageScan, page: URL): FoundLink[] {
  const found: FoundLink[] = [];
  const seen = new Set<string>();
  let weighed = 0;
  /** False once enough links are found or enough candidates were weighed. */
  const add = (url: unknown, title: unknown): boolean => {
    weighed += 1;
    if (weighed > CANDIDATES_MAX) return false;
    if (typeof url !== "string" || url.length > URL_MAX) return true;
    let parsed: URL;
    try {
      parsed = new URL(url, page);
    } catch {
      return true;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:" && parsed.protocol !== "mailto:") return true;
    const host = parsed.hostname.replace(/^www\./, "");
    // The service's own pages (its home, sign-up, other profiles) are not the creator's links.
    if (host === page.hostname || host.endsWith(`.${page.hostname}`) || JUNK.test(parsed.pathname) || STORES.test(parsed.href)) return true;
    if (parsed.href.length > URL_MAX) return true;
    const key = linkKey(parsed.href);
    if (seen.has(key)) return true;
    seen.add(key);
    found.push({ url: parsed.href, title: typeof title === "string" ? decodeText(title).slice(0, 120) : "" });
    return found.length < LINKS_MAX;
  };

  // Next.js pages (Linktree and others) carry their links as JSON.
  if (scan.nextData) {
    try {
      const props = (JSON.parse(scan.nextData) as { props?: { pageProps?: Record<string, unknown> } }).props?.pageProps ?? {};
      for (const key of ["links", "pinnedLinks", "socialLinks"]) {
        const list = props[key];
        if (!Array.isArray(list)) continue;
        for (const item of list as ({ url?: unknown; title?: unknown; type?: unknown } | null)[]) {
          if (item && typeof item === "object" && !add(item.url, item.title ?? item.type)) return found;
        }
      }
    } catch {
      // Not the JSON we know: fall back to the anchors.
    }
  }
  if (!found.length) {
    for (const anchor of scan.anchors) if (!add(decodeText(anchor.href), anchor.inner)) break;
  }
  return found;
}

/**
 * Links in a page: from its embedded page data when there is some, else its anchors, at most 40.
 * The page's own site, legal and sign-up pages and app-store links are left out. The same answer as
 * the importer's `extractLinks`, but comments and code are removed first and nothing is read twice.
 */
export function pageLinks(html: string, page: URL): FoundLink[] {
  return collectLinks(scanPage(stripCode(html)), page);
}

export function readPage(html: string, base: URL): PageFacts {
  // Scripts and styles are dropped (JSON data blocks are kept: JSON-LD, and the page data some
  // link-in-bio services embed), so a link inside code is never read.
  const scan = scanPage(stripCode(html));

  const meta = (key: string) => scan.metas.find((attrs) => (attrs.name ?? attrs.property)?.toLowerCase() === key)?.content;
  const title = decodeText(scan.title) || decodeText(meta("og:title") ?? "");
  const description = decodeText(meta("description") ?? "") || decodeText(meta("og:description") ?? "");

  const found: Entity[] = [];
  for (const block of scan.jsonLd) {
    if (found.length >= ENTITIES_MAX) break;
    try {
      entities(JSON.parse(block) as unknown, found);
    } catch {
      // Broken JSON-LD: ignored.
    }
  }
  const person = found[0];

  const relMe = new Set<string>();
  for (const attrs of scan.refs) {
    if (relMe.size >= PROFILE_LINKS_MAX) break;
    if (!attrs.href || !(attrs.rel ?? "").toLowerCase().split(/\s+/).includes("me")) continue;
    const url = httpsOrMail(decodeText(attrs.href), base);
    if (url) relMe.add(url);
  }

  const sameAs = new Set<string>();
  for (const url of found.flatMap((entity) => entity.sameAs)) {
    if (sameAs.size >= PROFILE_LINKS_MAX) break;
    const kept = httpsOrMail(url, base);
    if (kept) sameAs.add(kept);
  }
  const links = collectLinks(scan, base).filter((link) => /^(https:|mailto:)/i.test(link.url));

  return {
    title: cap(title, 120),
    description: cap(description, 300),
    name: cap(person?.name ? decodeText(person.name) : undefined, 60),
    bio: cap(person?.description ? decodeText(person.description) : undefined, 1000),
    sameAs: [...sameAs],
    relMe: [...relMe],
    links,
  };
}
