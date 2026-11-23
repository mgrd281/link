/**
 * Finding tags in HTML we did not write, in time that grows with the length of the document and no
 * faster. A page may be a megabyte of `<a <a <a …` or `<!--<!--…`: a regular expression such as
 * `<a\b[^>]*>([\s\S]*?)<\/a>` looks for the end again from every opener and never finds it, which
 * blocks the server for minutes. Here every search only moves forward, and a missing `>` or closing
 * tag ends the scan (nothing after it can be complete either) instead of being looked for again.
 *
 * Pure (no imports), so the importer can use it too. Like the expressions it replaces, it does not
 * parse quotes: a tag ends at the first `>`.
 */

export interface FoundTag {
  /** Lower-case name; a comment is "!--". */
  name: string;
  /** Index of its "<". */
  start: number;
  /** Index after its ">" (after "-->" for a comment). */
  end: number;
}

const closers = new Map<string, RegExp>();

/** Only letters, digits and "-" reach a pattern (the names are ours; this keeps it that way). */
const plainName = (name: string) => name.toLowerCase().replace(/[^a-z0-9-]/g, "");

/**
 * Calls `visit` for every comment and every opening tag with one of `names`, left to right. `visit`
 * may return an index to go on from (to step over an element's content) or `false` to stop. Returns
 * where the scan ended: the document's length, or the index of the first thing left unread (a tag
 * without `>`, a comment without `-->`, or where `visit` stopped it).
 */
export function eachTag(html: string, names: readonly string[], visit: (tag: FoundTag) => number | false | undefined): number {
  // Its own expression per call: the position is kept in it.
  const opener = new RegExp(`<(?:!--|(${names.map(plainName).join("|")})(?=[\\s/>]))`, "gi");
  for (;;) {
    const match = opener.exec(html);
    if (!match) return html.length;
    const start = match.index;
    const name = match[1]?.toLowerCase() ?? "!--";
    const closeAt = name === "!--" ? html.indexOf("-->", start + 4) : html.indexOf(">", opener.lastIndex);
    if (closeAt < 0) return start;
    const end = closeAt + (name === "!--" ? 3 : 1);
    const next = visit({ name, start, end });
    if (next === false) return start;
    opener.lastIndex = Math.max(end, next ?? end);
  }
}

/** The next `</name>` at or after `from`: where it starts and where it ends, or null. */
export function closingTag(html: string, name: string, from: number): { start: number; end: number } | null {
  const key = plainName(name);
  let closer = closers.get(key);
  if (!closer) {
    closer = new RegExp(`</${key}(?=[\\s/>])`, "gi");
    closers.set(key, closer);
  }
  closer.lastIndex = from;
  const match = closer.exec(html);
  if (!match) return null;
  const end = html.indexOf(">", closer.lastIndex);
  return end < 0 ? null : { start: match.index, end: end + 1 };
}

const SPACE = new Set([" ", "\t", "\n", "\r", "\f"]);

/**
 * The attributes of one tag (`<meta name="description" content="…">`), names lower-cased; the first
 * of a repeated name counts, as in a browser. Read character by character, never by an expression
 * that could look twice at a megabyte-long tag.
 */
export function attributes(tag: string): Record<string, string> {
  const out = Object.create(null) as Record<string, string>;
  const length = tag.length;
  let at = 0;
  const skip = (stop: (character: string) => boolean) => {
    const from = at;
    while (at < length && !stop(tag[at] ?? "")) at += 1;
    return tag.slice(from, at);
  };
  const nameEnd = (character: string) => SPACE.has(character) || character === "=" || character === ">" || character === "/";
  if (tag.startsWith("<")) {
    at = 1;
    skip((character) => SPACE.has(character) || character === ">");
  }
  while (at < length) {
    skip((character) => !SPACE.has(character) && character !== "/");
    if (at >= length || tag[at] === ">") break;
    if (tag[at] === "=") {
      // A stray "=": not a name.
      at += 1;
      continue;
    }
    const name = skip(nameEnd).toLowerCase();
    skip((character) => !SPACE.has(character));
    let value = "";
    if (tag[at] === "=") {
      at += 1;
      skip((character) => !SPACE.has(character));
      const quote = tag[at];
      if (quote === '"' || quote === "'") {
        at += 1;
        const close = tag.indexOf(quote, at);
        value = tag.slice(at, close < 0 ? length : close);
        at = close < 0 ? length : close + 1;
      } else value = skip((character) => SPACE.has(character) || character === ">");
    }
    if (name && !(name in out)) out[name] = value;
  }
  return out;
}

/** Tags replaced by a space. A "<" with no ">" after it is text, and ends the search. */
export function stripTags(text: string): string {
  let at = text.indexOf("<");
  if (at < 0) return text;
  const out: string[] = [];
  let copied = 0;
  while (at >= 0) {
    const end = text.indexOf(">", at + 1);
    if (end < 0) break;
    out.push(text.slice(copied, at), " ");
    copied = end + 1;
    at = text.indexOf("<", copied);
  }
  out.push(text.slice(copied));
  return out.join("");
}

/** Is this `<script …>` tag a JSON data block (JSON-LD, or the page data some services embed)? */
export const isJsonScript = (tag: string): boolean => /^application\/(?:ld\+)?json/.test((attributes(tag).type ?? "").trim().toLowerCase());

const CODE = ["script", "style", "noscript", "template"] as const;

/**
 * The document without comments, scripts, styles, `<noscript>` and `<template>`, so a link inside
 * code is never read. JSON data blocks stay. Code that is never closed takes the rest of the
 * document with it (as in a browser), and so does a comment or tag that never ends.
 */
export function stripCode(html: string): string {
  const kept: string[] = [];
  let copied = 0;
  const stopped = eachTag(html, CODE, (tag) => {
    if (tag.name === "!--") {
      kept.push(html.slice(copied, tag.start), " ");
      copied = tag.end;
      return undefined;
    }
    const close = closingTag(html, tag.name, tag.end);
    if (!close) return false;
    if (tag.name === "script" && isJsonScript(html.slice(tag.start, tag.end))) return close.end;
    kept.push(html.slice(copied, tag.start), " ");
    copied = close.end;
    return close.end;
  });
  kept.push(html.slice(copied, Math.max(copied, stopped)));
  return kept.join("");
}

export interface FoundAnchor {
  /** The href as written (entities not decoded). */
  href: string;
  /** What is between `<a …>` and `</a>`, tags included. */
  inner: string;
}

/** How many tags of a page are looked at: a page with more is cut there. */
export const TAGS_MAX = 10_000;

export interface PageScan {
  /** Every `<meta>`'s attributes. */
  metas: Record<string, string>[];
  /** The first `<title>`'s content. */
  title: string;
  /** The content of every JSON-LD block. */
  jsonLd: string[];
  /** The content of the `__NEXT_DATA__` block (Next.js pages carry their data there). */
  nextData: string | null;
  /** `<a>` and `<link>` tags' attributes (for rel="me"). */
  refs: Record<string, string>[];
  /** `<a href>` … `</a>`, outermost only. */
  anchors: FoundAnchor[];
}

/** One pass over a document cleaned by `stripCode`: its metas, title, data blocks, links and anchors. */
export function scanPage(clean: string): PageScan {
  const scan: PageScan = { metas: [], title: "", jsonLd: [], nextData: null, refs: [], anchors: [] };
  let seen = 0;
  let titleRead = false;
  /** No `</a>` is left in the document. */
  let anchorsDone = false;
  let anchorUntil = 0;
  eachTag(clean, ["meta", "title", "script", "link", "a"], (tag) => {
    if (tag.name === "!--") return undefined;
    seen += 1;
    if (seen > TAGS_MAX) return false;
    if (tag.name === "title") {
      if (titleRead) return undefined;
      titleRead = true;
      const close = closingTag(clean, "title", tag.end);
      if (close) scan.title = clean.slice(tag.end, close.start);
      return close?.end;
    }
    const attrs = attributes(clean.slice(tag.start, tag.end));
    if (tag.name === "meta") {
      scan.metas.push(attrs);
      return undefined;
    }
    if (tag.name === "script") {
      // Only data blocks are left; what is inside one is data, not tags.
      const close = closingTag(clean, "script", tag.end);
      if (!close) return false;
      const content = clean.slice(tag.end, close.start);
      if ((attrs.type ?? "").trim().toLowerCase().startsWith("application/ld+json")) scan.jsonLd.push(content);
      else if (attrs.id === "__NEXT_DATA__") scan.nextData ??= content;
      return close.end;
    }
    scan.refs.push(attrs);
    if (tag.name === "a" && attrs.href && !anchorsDone && tag.start >= anchorUntil) {
      const close = closingTag(clean, "a", tag.end);
      if (!close) anchorsDone = true;
      else {
        scan.anchors.push({ href: attrs.href, inner: clean.slice(tag.end, close.start) });
        anchorUntil = close.end;
      }
    }
    return undefined;
  });
  return scan;
}
