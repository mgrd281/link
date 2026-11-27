import { isBlockActive, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import { contactStatus } from "@linkyo/blocks/project";
import { DOCUMENT_SEGMENTS } from "@linkyo/blocks/rules";

import { isLetter } from "../directions/poster/laufbahn-content";
import { groupSections } from "../directions/poster/sections";

/**
 * What a Laufbahn page offers as documents (the Lebenslauf, the Anschreiben, both in one file), the
 * one predicate the page and the PDF routes share, and the small facts both read from a page: the
 * target position, the letter's subject, a figure split for display, the file names.
 *
 * Isomorphic and pure: no Node module, no React, no next-intl. The server fills `DocumentsView`
 * (./view.ts); the page renders it.
 */

export type DocumentKind = "cv" | "letter" | "application";
export type DocumentLocale = "de" | "en";

type Fact = NonNullable<BlockOf<"about">["facts"]>[number];
type Contact = BlockOf<"contact">;

/* ------------------------------------------------------------------------------------------------ */
/* Text as printed                                                                                   */
/* ------------------------------------------------------------------------------------------------ */

const NBSP = "\u00A0";

/**
 * The characters WinAnsiEncoding draws: ASCII, the Latin-1 block and the 27 characters of 0x80–0x9F
 * (€ ‚ ƒ „ … † ‡ ˆ ‰ Š ‹ Œ Ž ‘ ’ “ ” • – — ˜ ™ š › œ ž Ÿ). The soft hyphen is never drawn.
 */
const WIN_ANSI_HIGH = "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178";
const WIN_ANSI = new Set<number>([
  ...Array.from({ length: 0x7f - 0x20 }, (_, index) => 0x20 + index),
  ...Array.from({ length: 0x100 - 0xa0 }, (_, index) => 0xa0 + index).filter((code) => code !== 0xad),
  ...Array.from(WIN_ANSI_HIGH, (character) => character.codePointAt(0) ?? 0),
]);
const drawable = (character: string): boolean => WIN_ANSI.has(character.codePointAt(0) ?? 0);

/** Never letters: the soft hyphen, the joiners, variation selectors, the keycap mark and skin tones (by code point). */
const INVISIBLE_POINTS = new Set([0xad, 0x200c, 0x200d, 0x20e3]);
const invisible = (code: number): boolean => INVISIBLE_POINTS.has(code) || (code >= 0xfe00 && code <= 0xfe0f) || (code >= 0xe0100 && code <= 0xe01ef) || (code >= 0x1f3fb && code <= 0x1f3ff);
/** Emoji and other pictographs (decoration, not letters); © ® ™ are pictographs too, but WinAnsi draws them. */
const PICTOGRAPH = /\p{Extended_Pictographic}|\p{Regional_Indicator}/gu;

/**
 * Text as printed: NFC; soft hyphen, joiners, variation selectors and emoji removed (with the space
 * an emoji leaves); thin space as a space, narrow and figure spaces as NBSP; U+2010/U+2011 as "-".
 * Every letter stays: a letter WinAnsi cannot draw makes the text not printable (`isPrintable`).
 */
export function printable(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[^]/gu, (character) => (invisible(character.codePointAt(0) ?? 0) ? "" : character))
    .replace(PICTOGRAPH, (character) => (drawable(character) ? character : "\uE000"))
    .replace(/ *\uE000+ */gu, (run) => (run.startsWith(" ") && run.endsWith(" ") ? " " : ""))
    .replaceAll("\u2009", " ")
    .replace(/[\u202F\u2007]/gu, NBSP)
    .replace(/[\u2010\u2011]/gu, "-")
    .trim();
}

/** Line breaks and tabs are layout, not glyphs. */
const LAYOUT = new Set(["\n", "\r", "\t"]);

/** `printable(text)` is drawable with WinAnsiEncoding (Geist covers all of WinAnsi but U+00AD). */
export function isPrintable(text: string): boolean {
  return Array.from(printable(text)).every((character) => LAYOUT.has(character) || drawable(character));
}

/* ------------------------------------------------------------------------------------------------ */
/* The page's letter, target and subject                                                             */
/* ------------------------------------------------------------------------------------------------ */

/**
 * The page's cover letter exactly as the renderer finds it (renderer.tsx `letterOf`): active blocks
 * (`isBlockActive(block, now)`), `groupSections`, the first titled section whose text block `isLetter`.
 */
export function letterOf(page: Page, now: Date): BlockOf<"text"> | null {
  const blocks = page.blocks.filter((block) => isBlockActive(block, now));
  for (const section of groupSections(blocks)) {
    if (section.title === null) continue;
    for (const item of section.items) {
      if (item.kind === "block" && item.block.type === "text" && isLetter(section.title, item.block.text, page.profile.locale)) return item.block;
    }
  }
  return null;
}

/** One spelling for a fact's label: trimmed, lower case, NFC, without a trailing colon. */
const labelKey = (label: string): string => label.normalize("NFC").trim().toLowerCase().replace(/\s*:$/u, "").trim();

const TARGET_LABELS = new Set(
  [
    // de
    "bewerbung als", "bewerbung", "stelle", "position", "angestrebte stelle", "angestrebte position", "zielposition",
    // en
    "applying for", "application for", "role applied for", "target role",
    // ar
    "التقديم على", "الوظيفة المطلوبة", "المنصب",
  ].map(labelKey),
);
const EMPLOYER_LABELS = new Set(["für", "bei", "unternehmen", "arbeitgeber", "for", "at", "company", "employer", "لدى", "الشركة", "جهة العمل"].map(labelKey));

const activeBlocks = (page: Page, now: Date): Block[] => page.blocks.filter((block) => isBlockActive(block, now));

/** Every fact of the page's shown about blocks, in page order (no clock: the same page gives the same facts). */
function factsOf(page: Page): Fact[] {
  return page.blocks.flatMap((block) => (block.type === "about" && block.visible ? (block.facts ?? []) : []));
}

/**
 * The facts the head shows and the subject reads: the position applied for and the employer, by
 * their labels (an exact match, never a prefix: "Bewerbungsfrist" is no target). First match wins;
 * an employer only beside a target.
 */
export function targetFacts(page: Page): { target: Fact | null; employer: Fact | null } {
  const facts = factsOf(page);
  const target = facts.find((fact) => TARGET_LABELS.has(labelKey(fact.label))) ?? null;
  const employer = target ? (facts.find((fact) => fact !== target && EMPLOYER_LABELS.has(labelKey(fact.label))) ?? null) : null;
  return { target, employer };
}

/**
 * "Bewerbung als {value}" / "Application for {value}" from the target fact, else the bare template
 * word; null on Arabic pages. Never from the tagline.
 */
export function letterSubject(page: Page, words: { subjectFor: (value: string) => string; subjectBare: string }): string | null {
  if (page.profile.locale === "ar") return null;
  const { target } = targetFacts(page);
  return target ? words.subjectFor(target.value.trim()) : words.subjectBare;
}

/* ------------------------------------------------------------------------------------------------ */
/* Figures                                                                                           */
/* ------------------------------------------------------------------------------------------------ */

/** One stat value split for display: a qualifier ("seit"), the number and its unit, or words. */
export type FigureParts = { kind: "number"; qualifier: string; number: string; unit: string } | { kind: "word"; text: string };

const FIGURE = /^(?<q>\P{Nd}*?)\s*(?<n>[+\-−]?\p{Nd}[\p{Nd}.,]*)\s*(?<u>%|\+|×|\p{L}[\p{L}.]{0,5})?$/u;
const QUALIFIER_MAX = 12;

export function splitFigure(value: string): FigureParts {
  const text = value.trim();
  const groups = FIGURE.exec(text)?.groups;
  const qualifier = groups?.q?.trim() ?? "";
  if (!groups?.n || qualifier.length > QUALIFIER_MAX) return { kind: "word", text };
  return { kind: "number", qualifier, number: groups.n, unit: groups.u ?? "" };
}

/* ------------------------------------------------------------------------------------------------ */
/* The predicate                                                                                     */
/* ------------------------------------------------------------------------------------------------ */

export interface Eligibility {
  cv: boolean;
  letter: boolean;
  ownCv: { href: string; label: string | null } | null;
}

const decode = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** The contact lines a document prints: the first `tel:` and `mailto:` of the contact block's primary and links. */
export function contactLines(contact: Contact | undefined): { phone: string | null; email: string | null } {
  const urls = contact ? [contact.primary.url, ...(contact.links ?? []).map((link) => link.url)] : [];
  const phone = urls.find((url) => url.toLowerCase().startsWith("tel:"));
  const email = urls.find((url) => url.toLowerCase().startsWith("mailto:"));
  return {
    phone: phone ? decode(phone.slice("tel:".length)).trim() || null : null,
    email: email ? decode(email.slice("mailto:".length).split("?")[0] ?? "").trim() || null : null,
  };
}

const OFFERED_LOCALES: readonly Page["profile"]["locale"][] = ["de", "en"];

/** THE predicate, shared by the page and the routes (all rules must hold, else false). */
export function documentEligibility(page: Page, options: { signposted: boolean; now: Date }): Eligibility {
  const none: Eligibility = { cv: false, letter: false, ownCv: null };
  const { profile } = page;
  if (!options.signposted || !OFFERED_LOCALES.includes(profile.locale)) return none;
  const name = profile.displayName.trim();
  if (!name || !isPrintable(name)) return none;

  const blocks = activeBlocks(page, options.now);
  const contact = blocks.find((block): block is Contact => block.type === "contact");
  const own = contact?.links?.find((link) => link.kind === "cv");
  const ownCv = own ? { href: own.url, label: own.label?.trim() ? own.label : null } : null;
  const { phone, email } = contactLines(contact);
  const lines = [phone, email].filter((line): line is string => line !== null);
  const printableAll = (texts: readonly (string | null | undefined)[]): boolean => texts.every((text) => !text || isPrintable(text));

  const about = blocks.filter((block): block is BlockOf<"about"> => block.type === "about");
  const timeline = blocks.filter((block): block is BlockOf<"timeline"> => block.type === "timeline");
  const tools = blocks.filter((block): block is BlockOf<"tools"> => block.type === "tools");
  const hasContent = about.length > 0 || timeline.some((block) => block.items.length > 0) || tools.some((block) => block.items.length > 0);
  const cvTexts = [
    name,
    profile.tagline,
    contact ? contactStatus(contact, options.now) : null,
    profile.location,
    ...(profile.stats ?? []).flatMap((stat) => [stat.value, stat.label]),
    ...about.flatMap((block) => [block.title, block.text, ...(block.facts ?? []).flatMap((fact) => [fact.label, fact.value])]),
    ...timeline.flatMap((block) => [block.title, ...block.items.flatMap((item) => [item.role, item.org, item.note])]),
    ...tools.flatMap((block) => [block.title, ...block.items]),
    ...lines,
  ];
  const cv = ownCv === null && hasContent && printableAll(cvTexts);

  const letterBlock = letterOf(page, options.now);
  const { target } = targetFacts(page);
  const letter = letterBlock !== null && printableAll([name, profile.tagline, profile.location, ...lines, target?.label, target?.value, letterBlock.text]);
  return { cv, letter, ownCv };
}

/* ------------------------------------------------------------------------------------------------ */
/* Addresses and file names                                                                          */
/* ------------------------------------------------------------------------------------------------ */

/** The PDF addresses under a page's base, or the owner's own CV; null when nothing is offered. */
export interface DocumentLinks {
  cv: string | null;
  letter: string | null;
  application: string | null;
  ownCv: string | null;
}

/**
 * The helper the page imports: PDF addresses under `base` ("/jonasbrandt" or "/de/p/jonas-brandt",
 * no trailing slash), or null when nothing is offered.
 */
export function documentLinks(page: Page, base: string, options: { signposted: boolean; now: Date }): DocumentLinks | null {
  const offer = documentEligibility(page, options);
  const root = base.replace(/\/+$/u, "");
  const at = (segment: string) => `${root}/${segment}`;
  const links: DocumentLinks = {
    cv: offer.cv ? at(DOCUMENT_SEGMENTS.cv) : null,
    letter: offer.letter ? at(DOCUMENT_SEGMENTS.letter) : null,
    application: offer.cv && offer.letter ? at(DOCUMENT_SEGMENTS.application) : null,
    ownCv: offer.ownCv?.href ?? null,
  };
  return links.cv || links.letter || links.application || links.ownCv ? links : null;
}

const FILE_WORDS: Record<DocumentLocale, Record<DocumentKind, string>> = {
  de: { cv: "Lebenslauf", letter: "Anschreiben", application: "Bewerbung" },
  en: { cv: "CV", letter: "Cover_letter", application: "Application" },
};
const ASCII_LETTERS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };

/**
 * Lebenslauf_/Anschreiben_/Bewerbung_ (de), CV_/Cover_letter_/Application_ (en) and the name's words
 * joined by "_". `ascii`: ä → ae, ö → oe, ü → ue, ß → ss, other marks stripped, only [A-Za-z0-9_-];
 * `utf8`: the same with the original letters (for `filename*`).
 */
export function documentFilename(kind: DocumentKind, displayName: string, locale: DocumentLocale): { ascii: string; utf8: string } {
  const words = displayName.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
  const utf8Name = words.map((word) => word.replace(/[^\p{L}\p{M}\p{N}_-]/gu, "")).filter(Boolean);
  const asciiName = utf8Name
    .map((word) =>
      word
        .replace(/[äöüÄÖÜß]/gu, (letter) => ASCII_LETTERS[letter] ?? letter)
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^A-Za-z0-9_-]/gu, ""),
    )
    .filter(Boolean);
  const prefix = FILE_WORDS[locale][kind];
  const file = (parts: string[]) => `${[prefix, ...parts].join("_")}.pdf`;
  return { ascii: file(asciiName), utf8: file(utf8Name.map((word) => word.normalize("NFC"))) };
}

/* ------------------------------------------------------------------------------------------------ */
/* What the page renders (filled by ./view.ts on the server)                                         */
/* ------------------------------------------------------------------------------------------------ */

/** One greeked mark of a document's first page, in mm on A4 (0 0 210 297): never any text. */
export interface MiniatureMark {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: "ink" | "accent" | "strong" | "muted";
}

export interface DocumentCard {
  kind: DocumentKind;
  href: string;
  filename: string;
  pages: number;
  miniature: readonly MiniatureMark[] | null;
}

export interface DocumentsView {
  /** Null when not eligible or replaced by the owner's own CV. */
  cv: DocumentCard | null;
  letter: DocumentCard | null;
  /** Only when the CV and the letter are both offered; its miniature is null. */
  application: DocumentCard | null;
  ownCv: { href: string; label: string | null } | null;
  /** ISO date of the last save (public pages), else null. */
  asOf: string | null;
  /** `letterSubject`, for the page's letter tile. */
  subject: string | null;
}
