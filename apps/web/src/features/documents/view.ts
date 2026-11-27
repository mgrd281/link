import "server-only";

import type { Page } from "@linkyo/blocks";

import { documentShape, onlineLine } from "./build";
import { paperLabels } from "./labels";
import { documentFilename, documentLinks, letterSubject, type DocumentCard, type DocumentKind, type DocumentsView } from "./offer";
import { photoCandidate } from "./photo";

/**
 * What a page shows of its PDFs (the hero's download, the bar's pills, the Unterlagen cards, the
 * letter's subject): the addresses and file names, each document's real page count and its first
 * page in miniature, from the same layout as the PDF. Server only; the page renders the result
 * (offer.ts types). Null when nothing is offered (Arabic pages, other templates, nothing printable).
 * The miniature holds numbers and tones only: no text and no contact data reach the page's HTML.
 * A failure here (a font that cannot be read, a layout that throws) offers no documents: the page
 * itself always renders.
 */
export async function documentsView(
  page: Page,
  options: { base: string; signposted: boolean; now: Date; asOf: string | null; publicAddress: string | null },
): Promise<DocumentsView | null> {
  try {
    return await view(page, options);
  } catch {
    return null;
  }
}

async function view(page: Page, options: { base: string; signposted: boolean; now: Date; asOf: string | null; publicAddress: string | null }): Promise<DocumentsView | null> {
  const links = documentLinks(page, options.base, options);
  const locale = page.profile.locale;
  if (!links || (locale !== "de" && locale !== "en")) return null;
  const asOf = options.asOf ? new Date(options.asOf) : null;
  const shapeOptions = { now: options.now, asOf: asOf && !Number.isNaN(asOf.getTime()) ? asOf : null, online: onlineLine(options.publicAddress), photo: photoCandidate(page, options.now) !== null };
  const card = async (kind: DocumentKind, href: string | null): Promise<DocumentCard | null> => {
    if (!href) return null;
    const shape = await documentShape(kind, page, shapeOptions);
    return { kind, href, filename: documentFilename(kind, page.profile.displayName, locale).ascii, pages: shape.pages, miniature: kind === "application" ? null : shape.miniature };
  };
  const [cv, letter, application] = await Promise.all([card("cv", links.cv), card("letter", links.letter), card("application", links.application)]);
  const own = links.ownCv;
  const ownLabel = own ? (page.blocks.flatMap((block) => (block.type === "contact" ? (block.links ?? []) : [])).find((link) => link.url === own)?.label?.trim() ?? null) : null;
  return {
    cv,
    letter,
    application,
    ownCv: own ? { href: own, label: ownLabel === "" ? null : ownLabel } : null,
    asOf: options.asOf,
    subject: links.letter ? letterSubject(page, paperLabels(locale), options.now) : null,
  };
}
