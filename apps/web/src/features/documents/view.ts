import "server-only";

import type { Page } from "@linkyo/blocks";

import { paperLabels } from "./labels";
import { documentFilename, documentLinks, letterSubject, type DocumentCard, type DocumentKind, type DocumentLocale, type DocumentsView } from "./offer";

/**
 * What a page shows of its PDFs (the hero's download, the bar's pills, the Unterlagen cards, the
 * letter's subject): the addresses and file names, each document's page count and its first page in
 * miniature. Server only; the page renders the result (offer.ts types). Null when nothing is offered
 * (Arabic pages, other templates, nothing printable).
 */
export async function documentsView(
  page: Page,
  options: { base: string; signposted: boolean; now: Date; asOf: string | null; publicAddress: string | null },
): Promise<DocumentsView | null> {
  const links = documentLinks(page, options.base, options);
  const locale = page.profile.locale;
  if (!links || (locale !== "de" && locale !== "en")) return null;
  const labels = paperLabels(locale);
  const card = (kind: DocumentKind, href: string | null): DocumentCard | null =>
    href ? { kind, href, filename: documentFilename(kind, page.profile.displayName, locale satisfies DocumentLocale).ascii, pages: 1, miniature: null } : null;
  return Promise.resolve({
    cv: card("cv", links.cv),
    letter: card("letter", links.letter),
    application: card("application", links.application),
    ownCv: links.ownCv ? { href: links.ownCv, label: page.blocks.flatMap((block) => (block.type === "contact" ? (block.links ?? []) : [])).find((link) => link.url === links.ownCv)?.label ?? null } : null,
    asOf: options.asOf,
    subject: links.letter ? letterSubject(page, labels, options.now) : null,
  });
}
