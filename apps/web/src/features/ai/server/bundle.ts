import type { Detection, Platform } from "@linkyo/blocks";

import type { LinkMetadata } from "@/features/app/metadata";

import { replacePhones } from "../content-rules";
import type { AiSourceKind, AiSourceReason, AiSourceStatus } from "../events";

import { detectAddress, socialPlatformOf } from "./sources/classify";

/**
 * The source bundle: everything the code found about the owner, as the one list of links (`L1…L40`)
 * the AI may refer to, plus a little profile text. The model never sees an address it could copy:
 * e-mail and phone links appear only as their type, other links as host and path without the query,
 * and every free text is length-capped and has e-mail addresses and phone numbers replaced first.
 * The full addresses stay here, on the server, and code puts them on the page.
 */

export const MAX_LINKS = 40;
const BIO_MAX = 1000;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 300;
const LABEL_MAX = 80;
const PATH_MAX = 100;

export interface SourceProfile {
  displayName?: string | undefined;
  bio?: string | undefined;
  siteTitle?: string | undefined;
  siteDescription?: string | undefined;
}

/** What reading one source gave (the readers in `sources/` fill it; nothing of it is stored). */
export interface SourceResult {
  /** Event id ("S1"). */
  id: string;
  kind: AiSourceKind;
  label: string;
  status: AiSourceStatus;
  reason?: AiSourceReason | undefined;
  /** The source's own address as a link on the page (a website, a profile); absent for link-in-bio pages. */
  self?: { url: string; title?: string | undefined } | undefined;
  /** Links found in it (anchors, `sameAs`, `rel="me"`, a link-in-bio page's links). */
  links: { url: string; title?: string | undefined }[];
  profile?: SourceProfile | undefined;
}

export type BundleLinkType = "social" | "email" | "phone" | "music" | "video" | "app" | "repo" | "events" | "product" | "live" | "link";

export interface BundleLink {
  /** "L1" … "L40", in bundle order. */
  id: string;
  /** The full address for the page (never sent to the model). */
  url: string;
  detection: Detection;
  type: BundleLinkType;
  /** The social platform of a profile, else the detected platform (never "website"). */
  platform?: string | undefined;
  title?: string | undefined;
  author?: string | undefined;
  affiliateHint: boolean;
}

export interface SourceBundle {
  links: BundleLink[];
  profile: SourceProfile;
}

// ── Redaction ────────────────────────────────────────────────────────────────

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
/** The local mock picks its answer by a marker in the owner's text; markers pass unchanged. */
const MARKER = /\[\[fixture:[a-z0-9-]{1,40}(?:#[a-z0-9_-]{1,64})?\]\]/gi;

/**
 * Replaces every e-mail address with "[E-Mail]" and every phone-like run of 7 or more digits with
 * "[Telefon]", however its digits are separated ("0621 - 12 34 56", "040 / 12 34 56",
 * "+49 (0) 151 – 234 567 89"; `replacePhones` in content-rules.ts). Dates (2026-11-22, 22.11.2026),
 * opening hours, year ranges and prices (24,99) stay.
 */
export function redactContacts(text: string): string {
  // Markers are set aside (as private-use characters around an index) and put back after.
  const kept: string[] = [];
  const keep = (match: string) => `\ue000${String(kept.push(match) - 1)}\ue001`;
  const out = replacePhones(text.replace(/[\ue000\ue001]/g, "").replace(MARKER, keep).replace(EMAIL, "[E-Mail]"), () => "[Telefon]");
  return out.replace(/\ue000(\d+)\ue001/g, (_, index: string) => kept[Number(index)] ?? "");
}

/** Trimmed, whitespace collapsed, redacted and cut to `max` characters (with "…"). */
export function freeText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const clean = redactContacts(value.replace(/\s+/g, " ").trim());
  if (!clean) return undefined;
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

// ── Links ────────────────────────────────────────────────────────────────────

const AFFILIATE_PARAMS = /^(tag|ref|aff|affiliate|partner|coupon|code)$/i;

/** Does the address look like a paid or commission link (a partner tag, a discount code, Amazon)? */
export function affiliateHint(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "amzn.to" || host === "awin1.com" || /(^|\.)amazon\.[a-z.]+$/.test(host)) return true;
  return [...url.searchParams.keys()].some((key) => AFFILIATE_PARAMS.test(key));
}

const typeOf = (detection: Detection, social: Platform | null): BundleLinkType => {
  if (detection.platform === "email") return "email";
  if (detection.platform === "phone") return "phone";
  if (social) return "social";
  switch (detection.type) {
    case "music":
    case "video":
    case "app":
    case "repo":
    case "events":
    case "product":
    case "live":
      return detection.type;
    default:
      return "link";
  }
};

/** Same destination: host without www, path without trailing slash, the query, case-insensitive host. */
const linkKey = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") return url.toLowerCase();
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
  } catch {
    return url;
  }
};

/**
 * The bundle: the owner's sources first, in their order (each source's own address, then the links
 * found in it), then the pasted links in their order. A duplicate keeps its first place; at most 40.
 */
export function buildBundle(sources: readonly SourceResult[], pasted: readonly string[]): SourceBundle {
  const links: BundleLink[] = [];
  const seen = new Set<string>();
  const add = (address: string, title?: string) => {
    if (links.length >= MAX_LINKS) return;
    const detection = detectAddress(address);
    if (!detection) return;
    const key = linkKey(detection.url);
    if (seen.has(key)) return;
    seen.add(key);
    const web = detection.url.startsWith("https:");
    const social = web ? socialPlatformOf(detection) : null;
    const type = typeOf(detection, social);
    const platform = social ?? (detection.platform && detection.platform !== "website" ? detection.platform : undefined);
    const url = web ? new URL(detection.url) : null;
    links.push({
      id: `L${String(links.length + 1)}`,
      url: detection.url,
      detection,
      type,
      ...(platform ? { platform } : {}),
      ...(title?.trim() ? { title: title.trim() } : {}),
      affiliateHint: url ? affiliateHint(url) : false,
    });
  };
  for (const source of sources) {
    if (source.self) add(source.self.url, source.self.title);
    for (const link of source.links) add(link.url, link.title);
  }
  for (const text of pasted) for (const word of text.split(/[\s,]+/)) if (word) add(word);

  const profile: SourceProfile = {};
  const filled = (value: string | undefined) => {
    const text = value?.trim() ?? "";
    return text.length > 0 ? text : undefined;
  };
  for (const source of sources) {
    const found = source.profile;
    if (!found) continue;
    profile.displayName ??= filled(found.displayName);
    profile.bio ??= filled(found.bio);
    profile.siteTitle ??= filled(found.siteTitle);
    profile.siteDescription ??= filled(found.siteDescription);
  }
  return { links, profile: Object.fromEntries(Object.entries(profile).filter(([, value]) => value)) };
}

/** Titles and artists from the platforms (link metadata) fill in what the sources did not say. */
export function withMetadata(bundle: SourceBundle, metadata: ReadonlyMap<string, LinkMetadata>): SourceBundle {
  return {
    ...bundle,
    links: bundle.links.map((link) => {
      const meta = metadata.get(link.url);
      if (!meta) return link;
      return { ...link, ...(meta.title ? { title: meta.title } : {}), ...(meta.author ? { author: meta.author } : {}) };
    }),
  };
}

/** Counts for the progress line: all links, and how many are social profiles. */
export const bundleCounts = (bundle: SourceBundle) => ({ links: bundle.links.length, profiles: bundle.links.filter((link) => link.type === "social").length });

/** Does the bundle hold anything to build from (a link or some profile text)? */
export const bundleHasContent = (bundle: SourceBundle) => bundle.links.length > 0 || Object.values(bundle.profile).some(Boolean);

// ── What the model sees ──────────────────────────────────────────────────────

export type PromptLink = Record<string, string | boolean>;

const hostOf = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, "");

const decodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/** One link as the model sees it: an id, a type and words, never an address it could copy. */
export function promptLink(link: BundleLink): PromptLink {
  const out: PromptLink = { id: link.id, type: link.type };
  if (link.type === "email") return { ...out, label: "E-Mail" };
  if (link.type === "phone") return { ...out, label: "Phone" };
  if (link.platform) out.platform = link.platform;
  const url = new URL(link.url);
  const title = freeText(link.title, TITLE_MAX);
  const author = freeText(link.author, TITLE_MAX);
  if (link.type === "social") {
    out.label = freeText(link.detection.label, LABEL_MAX) ?? hostOf(url);
  } else if (link.type === "link") {
    out.host = hostOf(url);
    const path = freeText(decodePath(url.pathname.replace(/\/+$/, "")).slice(0, 400), PATH_MAX);
    if (path) out.path = path;
  } else if (!title) {
    out.label = freeText(hostOf(url), LABEL_MAX) ?? "";
  }
  if (title) out.title = title;
  if (author) out.author = author;
  if (link.affiliateHint) out.affiliateHint = true;
  return out;
}

/** The `<sources>` JSON: links and profile text, redacted and capped. */
export function promptSources(bundle: SourceBundle): { links: PromptLink[]; profile: Record<string, string> } {
  const profile: Record<string, string> = {};
  const set = (key: string, value: string | undefined, max: number) => {
    const text = freeText(value, max);
    if (text) profile[key] = text;
  };
  set("displayName", bundle.profile.displayName, 60);
  set("bio", bundle.profile.bio, BIO_MAX);
  set("siteTitle", bundle.profile.siteTitle, TITLE_MAX);
  set("siteDescription", bundle.profile.siteDescription, DESCRIPTION_MAX);
  return { links: bundle.links.map(promptLink), profile };
}

/** JSON with every object's keys sorted, so the same input always gives the same bytes. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner) ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : inner,
  );
}
