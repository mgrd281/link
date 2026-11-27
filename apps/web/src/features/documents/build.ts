import "server-only";

import type { Page } from "@linkyo/blocks";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";

import { documentInput, type ContactLine, type DocumentInput } from "./input";
import { languageTag, paperLabels, type PaperLabels } from "./labels";
import { layoutCv } from "./layout/cv";
import { layoutLetter } from "./layout/letter";
import type { Metrics } from "./layout/measure";
import type { LaidDocument } from "./layout/types";
import { miniatureOf } from "./miniature-marks";
import type { DocumentKind, DocumentLocale, MiniatureMark } from "./offer";
import { loadFonts } from "./pdf/fonts";
import type { Jpeg } from "./pdf/jpeg";
import { renderPdf, type Palette } from "./pdf/render";

/**
 * From a page to its documents: what they print (input.ts), how they are set (layout/*) and the
 * PDF (pdf/render.ts). One layout feeds both the PDF and the page's miniature.
 */

export interface DocumentOptions {
  /** The request's time: the letter's date and what shows on the page right now. */
  now: Date;
  /** The page's last save (public pages): the CV's "Stand". */
  asOf: Date | null;
  /** The page's public address (public pages only). */
  online: ContactLine | null;
}

/** The paper's colours: the page's own palette in light mode (paper is white, even when the page is dark). */
export function paperPalette(theme: CreatorThemeConfig): Palette {
  const { palette } = resolveCreatorTheme({ ...theme, mode: "light" });
  return { ink: palette.fg, muted: palette.fgMuted, accent: palette.accentText, strong: palette.lineStrong };
}

/** The documents of a kind, laid out: the CV, the letter, or the letter (with its enclosure) followed by the CV. */
export function layoutKind(kind: DocumentKind, input: DocumentInput, context: { metrics: Metrics; labels: PaperLabels; now: Date; asOf: Date | null; photo: boolean }): LaidDocument[] {
  const cv = () => layoutCv(input, { metrics: context.metrics, labels: context.labels, photo: context.photo, asOf: context.asOf });
  const letter = (enclosure: boolean) => layoutLetter(input, { metrics: context.metrics, labels: context.labels, now: context.now, enclosure });
  if (kind === "cv") return [cv()];
  if (kind === "letter") return [letter(false)];
  return [letter(true), cv()];
}

/** A page's document as PDF bytes. The page must offer it (offer.ts `documentEligibility`). */
export async function renderDocument(kind: DocumentKind, page: Page, theme: CreatorThemeConfig, options: DocumentOptions & { photo: Jpeg | null }): Promise<Uint8Array> {
  const locale = page.profile.locale as DocumentLocale;
  const { fonts, metrics } = await loadFonts();
  const labels = paperLabels(locale);
  const input = documentInput(page, { now: options.now, online: options.online });
  const documents = layoutKind(kind, input, { metrics, labels, now: options.now, asOf: options.asOf, photo: options.photo !== null });
  const parts = kind === "application" ? (["letter", "cv"] as const) : ([kind] as const);
  return renderPdf({
    documents: documents.map((document, index) => ({ document, outline: labels.documents[parts[index] ?? "cv"] })),
    title: labels.title(kind, input.name),
    author: input.name,
    lang: languageTag(locale),
    outlines: kind === "application",
    palette: paperPalette(theme),
    fonts,
    metrics,
    photo: options.photo,
  });
}

/**
 * What the page shows of a document: its page count and its first page in miniature (no PDF is
 * written). The combined file counts its letter's and its CV's pages; its first page is the letter's.
 */
export async function documentShape(kind: DocumentKind, page: Page, options: DocumentOptions & { photo: boolean }): Promise<{ pages: number; miniature: MiniatureMark[] }> {
  const locale = page.profile.locale as DocumentLocale;
  const { metrics } = await loadFonts();
  const input = documentInput(page, { now: options.now, online: options.online });
  const documents = layoutKind(kind, input, { metrics, labels: paperLabels(locale), now: options.now, asOf: options.asOf, photo: options.photo });
  const first = documents[0];
  return { pages: documents.reduce((total, document) => total + document.pages.length, 0), miniature: first ? miniatureOf(first) : [] };
}

/** The page's public address as a contact line: "linkyo.app/jonasbrandt", leading to https (http only for a local address). */
export function onlineLine(address: string | null): ContactLine | null {
  if (!address) return null;
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?\//u.test(address);
  return { text: address, uri: `${local ? "http" : "https"}://${address}` };
}
