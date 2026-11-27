import type { Block, BlockOf, Page } from "@linkyo/blocks";
import { contactStatus } from "@linkyo/blocks/project";

import { isLetter } from "../directions/poster/laufbahn-content";
import { groupSections, paragraphs } from "../directions/poster/sections";

import { printable } from "./printable";

/**
 * What the documents print, read from a page: the only place that reads its blocks for paper
 * (ADR 0089). Every text is the owner's own, as printed (`printable`); nothing is
 * added. Missing data simply does not appear: no address, birth date, employer or date the page does
 * not hold. Pure and isomorphic: the page (offer.ts) and the server (layout, serve.ts) share it.
 */

export type Locale = Page["profile"]["locale"];
export interface Fact {
  label: string;
  value: string;
}

/** A contact line on paper: what is printed, and where it leads (a link annotation). */
export interface ContactLine {
  text: string;
  uri: string;
}

export interface TimelineItem {
  from: number;
  /** The last year, "now" for an ongoing step, or null for a single year. */
  to: number | "now" | null;
  role: string;
  org: string | null;
  note: string | null;
  url: string | null;
}

/** A run of a section: the CV's own title for the first (`title` null), the owner's title for later ones. */
export interface Group<T> {
  title: string | null;
  items: T[];
}

export interface DocumentInput {
  locale: Locale;
  name: string;
  role: string | null;
  /** The availability line while it shows (`contactStatus` at the request's time). */
  status: string | null;
  location: string | null;
  phone: ContactLine | null;
  email: ContactLine | null;
  /** The page's public address (public pages only): "linkyo.app/jonasbrandt". */
  online: ContactLine | null;
  stats: { value: string; label: string }[];
  /** The CV's "Profil": the about text's paragraphs, else the bio. */
  profile: string[];
  facts: Fact[];
  timeline: Group<TimelineItem>[];
  tools: Group<string>[];
  /** The cover letter's paragraphs (a line break inside a paragraph stays one). */
  letter: string[] | null;
  /** The fact naming the position applied for: the letter's subject. */
  target: Fact | null;
}

/** The same test as `isBlockActive` in @linkyo/blocks' schema file, without its Zod (this file ships to the page). */
export function isActive(block: Block, now: Date): boolean {
  if (!block.visible) return false;
  const from = block.schedule?.from ? new Date(block.schedule.from) : null;
  const until = block.schedule?.until ? new Date(block.schedule.until) : null;
  return (!from || from <= now) && (!until || until > now);
}

const activeBlocks = (page: Page, now: Date): Block[] => page.blocks.filter((block) => isActive(block, now));

/**
 * The page's cover letter exactly as the renderer finds it (renderer.tsx `letterOf`): of the active
 * blocks, grouped into sections, the first titled section whose text block is a letter.
 */
export function letterOf(page: Page, now: Date): BlockOf<"text"> | null {
  for (const section of groupSections(activeBlocks(page, now))) {
    if (section.title === null) continue;
    for (const item of section.items) {
      if (item.kind === "block" && item.block.type === "text" && isLetter(section.title, item.block.text, page.profile.locale)) return item.block;
    }
  }
  return null;
}

/** Fact labels that name the position applied for, and the employer, per language (compared trimmed, lower case, without a trailing colon). */
const TARGET_LABELS: Record<Locale, readonly string[]> = {
  de: ["bewerbung als", "bewerbung", "stelle", "position", "angestrebte stelle", "angestrebte position", "zielposition"],
  en: ["applying for", "application for", "position", "role applied for", "target role"],
  ar: ["التقديم على", "الوظيفة المطلوبة", "المنصب"],
};
const EMPLOYER_LABELS: Record<Locale, readonly string[]> = {
  de: ["für", "bei", "unternehmen", "arbeitgeber"],
  en: ["for", "at", "company", "employer"],
  ar: ["لدى", "الشركة", "جهة العمل"],
};

const labelKey = (label: string): string =>
  label
    .normalize("NFC")
    .trim()
    .replace(/\s*:$/u, "")
    .toLowerCase();

/** The facts of the page's about blocks, in page order (switched off and out-of-schedule blocks only when `now` is given). */
function aboutFacts(page: Page, now?: Date): Fact[] {
  return page.blocks
    .filter((block): block is BlockOf<"about"> => block.type === "about" && (now ? isActive(block, now) : block.visible))
    .flatMap((block) => block.facts ?? []);
}

/**
 * The facts the head shows and the letter's subject reads: the position applied for and the
 * employer, by their labels (an exact match: "Bewerbungsfrist" names no position). The first match
 * wins; an employer counts only beside a position.
 */
export function targetFacts(page: Page, now?: Date): { target: Fact | null; employer: Fact | null } {
  const facts = aboutFacts(page, now);
  const { locale } = page.profile;
  const target = facts.find((fact) => TARGET_LABELS[locale].includes(labelKey(fact.label))) ?? null;
  if (!target) return { target: null, employer: null };
  const employer = facts.find((fact) => fact !== target && EMPLOYER_LABELS[locale].includes(labelKey(fact.label))) ?? null;
  return { target, employer };
}

/** A URL's part after its scheme and before any query, decoded ("tel:+49%2030…" → "+49 30…"). */
function addressOf(url: string, scheme: string): string | null {
  if (!url.startsWith(scheme)) return null;
  const raw = url.slice(scheme.length).split("?")[0] ?? "";
  try {
    return decodeURIComponent(raw).trim() || null;
  } catch {
    return raw.trim() || null;
  }
}

/**
 * A phone number as printed: as the owner wrote it, except a German mobile number in E.164
 * (+4915…, +4916…, +4917…), which is grouped "+49 176 12345678" (formatting, not invention).
 */
export function phoneText(number: string): string {
  const mobile = /^\+49(1[5-7]\d)(\d{4,})$/u.exec(number);
  return mobile ? `+49 ${mobile[1] ?? ""} ${mobile[2] ?? ""}` : number;
}

/** The first `tel:` and the first `mailto:` of the contact block (its primary action, then its links). Nothing else is printed. */
export function contactLines(contact: BlockOf<"contact"> | undefined): { phone: ContactLine | null; email: ContactLine | null } {
  const urls = contact ? [contact.primary.url, ...(contact.links ?? []).map((link) => link.url)] : [];
  const phoneUrl = urls.find((url) => url.startsWith("tel:"));
  const emailUrl = urls.find((url) => url.startsWith("mailto:"));
  const phone = phoneUrl ? addressOf(phoneUrl, "tel:") : null;
  const email = emailUrl ? addressOf(emailUrl, "mailto:") : null;
  return {
    phone: phone ? { text: printable(phoneText(phone)), uri: `tel:${phone.replace(/[^+\d]/gu, "")}` } : null,
    email: email ? { text: printable(email), uri: `mailto:${email}` } : null,
  };
}

/** A text as printed, or null when nothing is left of it. */
const text = (value: string | undefined | null): string | null => {
  const printed = value ? printable(value) : "";
  return printed === "" ? null : printed;
};

/**
 * Runs of one kind of block (timelines, tools) in page order: the first under the CV's own title,
 * each later one under its own title (the block's, or its section's); an untitled later run joins the
 * run before it.
 */
function groups<I>(blocks: readonly Block[], read: (block: Block) => { title: string | undefined; items: I[] } | null): Group<I>[] {
  const runs: Group<I>[] = [];
  for (const section of groupSections(blocks)) {
    for (const item of section.items) {
      const found = item.kind === "block" ? read(item.block) : null;
      if (!found) continue;
      const list = found.items;
      if (list.length === 0) continue;
      const title = runs.length === 0 ? null : text(found.title ?? section.title);
      const last = runs.at(-1);
      if (last && title === null) last.items.push(...list);
      else runs.push({ title, items: list });
    }
  }
  return runs;
}

/** Everything a page's documents print, read at `now` (the status line and scheduled blocks depend on it). */
export function documentInput(page: Page, options: { now: Date; online?: ContactLine | null }): DocumentInput {
  const { profile } = page;
  const blocks = activeBlocks(page, options.now);
  const contact = blocks.find((block): block is BlockOf<"contact"> => block.type === "contact");
  const about = blocks.find((block): block is BlockOf<"about"> => block.type === "about");
  const aboutText = about ? paragraphs(about.text).flatMap((paragraph) => text(paragraph) ?? []) : [];
  const bio = text(profile.bio);
  const letter = letterOf(page, options.now);
  const facts = aboutFacts(page, options.now).flatMap((fact) => {
    const [label, value] = [text(fact.label), text(fact.value)];
    return label && value ? [{ label, value }] : [];
  });
  const { target } = targetFacts(page, options.now);
  const targetValue = target ? text(target.value) : null;
  const targetLabel = target ? text(target.label) : null;
  return {
    locale: profile.locale,
    name: printable(profile.displayName),
    role: text(profile.tagline),
    status: contact ? text(contactStatus(contact, options.now)) : null,
    location: text(profile.location),
    ...contactLines(contact),
    online: options.online ?? null,
    stats: (profile.stats ?? []).flatMap((stat) => {
      const [value, label] = [text(stat.value), text(stat.label)];
      return value && label ? [{ value, label }] : [];
    }),
    profile: aboutText.length > 0 ? aboutText : bio ? [bio] : [],
    facts,
    timeline: groups(blocks, (block) =>
      block.type === "timeline"
        ? {
            title: block.title,
            items: block.items.flatMap((item): TimelineItem[] => {
              const role = text(item.role);
              if (!role) return [];
              const to = item.years.to === undefined || item.years.to === item.years.from ? null : item.years.to;
              return [{ from: item.years.from, to, role, org: text(item.org), note: text(item.note), url: item.url ?? null }];
            }),
          }
        : null,
    ),
    tools: groups(blocks, (block) => (block.type === "tools" ? { title: block.title, items: block.items.flatMap((item) => text(item) ?? []) } : null)),
    letter: letter ? paragraphs(letter.text).flatMap((paragraph) => text(paragraph) ?? []) : null,
    target: targetValue && targetLabel ? { label: targetLabel, value: targetValue } : null,
  };
}

/** Every text the CV prints (template words aside), for the printable check. */
export function cvTexts(input: DocumentInput): string[] {
  return [
    input.name,
    input.role,
    input.status,
    input.location,
    input.phone?.text,
    input.email?.text,
    input.online?.text,
    ...input.stats.flatMap((stat) => [stat.value, stat.label]),
    ...input.profile,
    ...input.facts.flatMap((fact) => [fact.label, fact.value]),
    ...input.timeline.flatMap((group) => [group.title, ...group.items.flatMap((item) => [item.role, item.org, item.note])]),
    ...input.tools.flatMap((group) => [group.title, ...group.items]),
  ].filter((value): value is string => typeof value === "string");
}

/** Every text the cover letter prints (template words aside), for the printable check. */
export function letterTexts(input: DocumentInput): string[] {
  return [input.name, input.role, input.location, input.phone?.text, input.email?.text, input.online?.text, input.target?.value, ...(input.letter ?? [])].filter(
    (value): value is string => typeof value === "string",
  );
}
