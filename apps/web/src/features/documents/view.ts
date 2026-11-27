import type { Page } from "@linkyo/blocks";
import { getTranslations } from "next-intl/server";

import { documentEligibility, documentFilename, documentLinks, letterSubject, type DocumentCard, type DocumentKind, type DocumentLocale, type DocumentsView } from "./offer";

/**
 * What a Laufbahn page shows of its documents, computed on the server for each render: the cards
 * (address, file name, page count, the first page's miniature), the owner's own CV, the date of the
 * last save and the letter's subject. Null when nothing is offered (an Arabic page, another template,
 * a page without a career or a letter).
 *
 * The contract's first step (C1): real addresses, file names and subject; one page each and no
 * miniature until the PDF layout lands (then the real page counts and the first page's marks).
 */
export async function documentsView(
  page: Page,
  options: { base: string; signposted: boolean; now: Date; asOf: string | null; publicAddress: string | null },
): Promise<DocumentsView | null> {
  const links = documentLinks(page, options.base, options);
  if (!links) return null;
  const locale: DocumentLocale = page.profile.locale === "en" ? "en" : "de";
  const t = await getTranslations({ locale, namespace: "documents.paper" });
  const offer = documentEligibility(page, options);
  const card = (kind: DocumentKind, href: string | null, pages: number): DocumentCard | null =>
    href ? { kind, href, filename: documentFilename(kind, page.profile.displayName, locale).ascii, pages, miniature: null } : null;
  const cv = card("cv", links.cv, 1);
  const letter = card("letter", links.letter, 1);
  return {
    cv,
    letter,
    application: card("application", links.application, (cv?.pages ?? 0) + (letter?.pages ?? 0)),
    ownCv: offer.ownCv,
    asOf: options.asOf,
    subject: letter ? letterSubject(page, { subjectFor: (value) => t("subjectFor", { value }), subjectBare: t("subjectBare") }) : null,
  };
}
