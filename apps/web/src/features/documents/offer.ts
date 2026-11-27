import type { BlockOf, Page } from "@linkyo/blocks";
import { DOCUMENT_SEGMENTS } from "@linkyo/blocks/rules";

import { isWinAnsi } from "./font/winansi";
import { cvTexts, documentInput, isActive, letterOf, letterTexts, targetFacts } from "./input";
import { printable } from "./printable";

/**
 * Which PDFs a page offers, where they live and what they are called: the one predicate the page
 * and the routes share (ADR 0089). Pure and isomorphic (no node:*, no React, no
 * next-intl): the page imports it; view.ts and serve.ts fill in the rest on the server.
 */

export type DocumentKind = "cv" | "letter" | "application";
export type DocumentLocale = "de" | "en";

export { isPrintable, printable } from "./printable";
export { letterOf, targetFacts, type Fact } from "./input";

/**
 * The letter's subject: "Bewerbung als {value}" / "Application for {value}" from the fact naming the
 * position, else the bare template word; null on Arabic pages (no documents). Never from the tagline.
 * Without `now`, the facts of every switched-on about block count (the page's own reading).
 */
export function letterSubject(page: Page, words: { subjectFor: (value: string) => string; subjectBare: string }, now?: Date): string | null {
  if (page.profile.locale === "ar") return null;
  const { target } = targetFacts(page, now);
  const value = target ? printable(target.value) : "";
  return value === "" ? words.subjectBare : words.subjectFor(value);
}

/** One stat value split for display: a qualifier ("seit"), a number ("99,6") and a unit ("%"), or words. */
export type FigureParts = { kind: "number"; qualifier: string; number: string; unit: string } | { kind: "word"; text: string };

const FIGURE = /^(?<q>\P{Nd}*?)\s*(?<n>[+\-−]?\p{Nd}[\p{Nd}.,]*)\s*(?<u>%|\+|×|\p{L}[\p{L}.]{0,5})?$/u;
const QUALIFIER_MAX = 12;

/** "seit 2019" → seit · 2019; "99,6 %" → 99,6 · %; "12 Jahre" → 12 · Jahre; "SAP EWM" and "9 → 3" stay words. */
export function splitFigure(value: string): FigureParts {
  const text = value.trim();
  const match = FIGURE.exec(text);
  const qualifier = match?.groups?.q?.trim() ?? "";
  const number = match?.groups?.n;
  if (!match || number === undefined || qualifier.length > QUALIFIER_MAX) return { kind: "word", text };
  return { kind: "number", qualifier, number, unit: match.groups?.u ?? "" };
}

/** What a page offers: a generated CV, a generated letter, or the owner's own CV file instead of the generated one. */
export interface Eligibility {
  cv: boolean;
  letter: boolean;
  ownCv: { href: string; label: string | null } | null;
}

const NONE: Eligibility = { cv: false, letter: false, ownCv: null };
const printableAll = (texts: readonly string[]): boolean => texts.every(isWinAnsi);

/**
 * THE predicate, shared by the page and the routes. A German or English page of a signposted
 * template (Laufbahn) with a printable name offers its CV when it has a career, skills or an about
 * section, and its letter when it has a cover letter, each only when every text that document prints
 * can be printed. An owner's own CV file (a contact link of kind "cv") replaces the generated CV.
 */
export function documentEligibility(page: Page, options: { signposted: boolean; now: Date }): Eligibility {
  const { profile } = page;
  if (!options.signposted || (profile.locale !== "de" && profile.locale !== "en")) return NONE;
  const input = documentInput(page, { now: options.now });
  if (input.name === "" || !isWinAnsi(input.name)) return NONE;
  const blocks = page.blocks.filter((block) => isActive(block, options.now));
  const contact = blocks.find((block): block is BlockOf<"contact"> => block.type === "contact");
  const own = contact?.links?.find((link) => link.kind === "cv");
  const ownCv = own ? { href: own.url, label: own.label?.trim() ? own.label.trim() : null } : null;
  const career = input.timeline.some((group) => group.items.length > 0) || input.tools.some((group) => group.items.length > 0) || blocks.some((block) => block.type === "about");
  const cv = ownCv === null && career && printableAll(cvTexts(input));
  const letter = letterOf(page, options.now) !== null && input.letter !== null && input.letter.length > 0 && printableAll(letterTexts(input));
  return { cv, letter, ownCv };
}

/** The PDF addresses a page links to, under `base` ("/jonasbrandt" or "/de/p/jonas-brandt"). */
export interface DocumentLinks {
  cv: string | null;
  letter: string | null;
  application: string | null;
  ownCv: string | null;
}

/** The PDFs' addresses under `base` (no trailing slash), or null when the page offers nothing. */
export function documentLinks(page: Page, base: string, options: { signposted: boolean; now: Date }): DocumentLinks | null {
  const offer = documentEligibility(page, options);
  const root = base.replace(/\/+$/u, "");
  const at = (kind: DocumentKind) => `${root}/${DOCUMENT_SEGMENTS[kind]}`;
  const links: DocumentLinks = {
    cv: offer.cv ? at("cv") : null,
    letter: offer.letter ? at("letter") : null,
    application: offer.cv && offer.letter ? at("application") : null,
    ownCv: offer.ownCv?.href ?? null,
  };
  return links.cv || links.letter || links.ownCv ? links : null;
}

const FILE_WORDS: Record<DocumentLocale, Record<DocumentKind, string>> = {
  de: { cv: "Lebenslauf", letter: "Anschreiben", application: "Bewerbung" },
  en: { cv: "CV", letter: "Cover_letter", application: "Application" },
};
const ASCII_LETTERS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss", ẞ: "SS" };

/**
 * A PDF's file name: "Lebenslauf_Jonas_Brandt.pdf" (de), "CV_Jonas_Brandt.pdf" (en). `ascii` for the
 * plain `filename` (umlauts written out, other marks dropped), `utf8` with the name's own letters for
 * `filename*`.
 */
export function documentFilename(kind: DocumentKind, displayName: string, locale: DocumentLocale): { ascii: string; utf8: string } {
  const words = displayName.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
  const utf8Name = words.map((word) => word.replace(/[^\p{L}\p{N}_-]/gu, "")).filter(Boolean).join("_");
  const asciiName = words
    .map((word) =>
      word
        .replace(/[äöüÄÖÜßẞ]/gu, (letter) => ASCII_LETTERS[letter] ?? "")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^A-Za-z0-9_-]/gu, ""),
    )
    .filter(Boolean)
    .join("_");
  const prefix = FILE_WORDS[locale][kind];
  const file = (name: string) => `${name === "" ? prefix : `${prefix}_${name}`}.pdf`;
  return { ascii: file(asciiName), utf8: file(utf8Name) };
}

/* Types the page renders (isomorphic; filled by view.ts on the server). */

/** One greeked bar of a paper miniature, in millimetres on the A4 page (0.1 mm). No text, ever. */
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
  /** Null when not offered or replaced by the owner's own CV. */
  cv: DocumentCard | null;
  letter: DocumentCard | null;
  /** Only when the CV and the letter are both offered; its miniature is null. */
  application: DocumentCard | null;
  ownCv: { href: string; label: string | null } | null;
  /** ISO date of the last save (public pages), else null. */
  asOf: string | null;
  /** The letter's subject (`letterSubject`), for the page's letter tile. */
  subject: string | null;
}
