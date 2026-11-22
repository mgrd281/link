import { extractLinks, type FoundLink } from "@/features/app/import-links";

/**
 * What a personal website says about its owner, read from its HTML without running anything: the
 * title, the description (meta or Open Graph), the person or organisation in its JSON-LD (name,
 * description, `sameAs` profiles), `rel="me"` links and the links to other sites. No picture is
 * downloaded and no script is executed; only `https:` and `mailto:` links are kept.
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
  return text
    .replace(/<[^>]*>/g, " ")
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

/** The attributes of one tag (`<meta name="description" content="…">`), names lower-cased. */
export function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    const name = match[1]?.toLowerCase();
    if (name) out[name] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return out;
}

const PERSON_TYPES = new Set(["person", "organization", "musicgroup", "localbusiness", "corporation", "performinggroup", "store"]);

interface Entity {
  name?: string;
  description?: string;
  sameAs: string[];
}

/** Person and Organization entities in JSON-LD (also inside @graph and a ProfilePage's mainEntity). */
function entities(value: unknown, out: Entity[], depth = 0): void {
  if (depth > 6 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) entities(item, out, depth + 1);
    return;
  }
  const record = value as Record<string, unknown>;
  const types = (Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]]).filter((type): type is string => typeof type === "string").map((type) => type.toLowerCase());
  if (types.some((type) => PERSON_TYPES.has(type))) {
    const sameAs = (Array.isArray(record.sameAs) ? record.sameAs : [record.sameAs]).filter((url): url is string => typeof url === "string");
    out.push({
      ...(typeof record.name === "string" ? { name: record.name } : {}),
      ...(typeof record.description === "string" ? { description: record.description } : {}),
      sameAs,
    });
  }
  for (const key of ["@graph", "mainEntity", "author", "founder"]) entities(record[key], out, depth + 1);
}

const httpsOrMail = (url: string, base: URL): string | null => {
  try {
    const parsed = new URL(url, base);
    return parsed.protocol === "https:" || parsed.protocol === "mailto:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

export function readPage(html: string, base: URL): PageFacts {
  // Scripts and styles are dropped (JSON data blocks are kept: JSON-LD, and the page data some
  // link-in-bio services embed), so a link inside code is never read.
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b(?![^>]*\btype\s*=\s*["']?application\/(?:ld\+)?json)[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<(style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");

  const metas = [...clean.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributes(match[0]));
  const meta = (key: string) => metas.find((attrs) => (attrs.name ?? attrs.property)?.toLowerCase() === key)?.content;
  const title = decodeText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(clean)?.[1] ?? "") || decodeText(meta("og:title") ?? "");
  const description = decodeText(meta("description") ?? "") || decodeText(meta("og:description") ?? "");

  const found: Entity[] = [];
  for (const match of clean.matchAll(/<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      entities(JSON.parse(match[1] ?? "") as unknown, found);
    } catch {
      // Broken JSON-LD: ignored.
    }
  }
  const person = found[0];

  const relMe: string[] = [];
  for (const match of clean.matchAll(/<(?:a|link)\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (!attrs.href || !(attrs.rel ?? "").toLowerCase().split(/\s+/).includes("me")) continue;
    const url = httpsOrMail(decodeText(attrs.href), base);
    if (url) relMe.push(url);
  }

  const sameAs = found.flatMap((entity) => entity.sameAs).flatMap((url) => httpsOrMail(url, base) ?? []);
  const links = extractLinks(clean, base).filter((link) => /^(https:|mailto:)/i.test(link.url));

  return {
    title: cap(title, 120),
    description: cap(description, 300),
    name: cap(person?.name ? decodeText(person.name) : undefined, 60),
    bio: cap(person?.description ? decodeText(person.description) : undefined, 1000),
    sameAs: [...new Set(sameAs)],
    relMe: [...new Set(relMe)],
    links,
  };
}
