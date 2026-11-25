import { infoPageMarkers } from "../marketing/pages/review";

import { agb, datenschutz, impressum, widerrufsbelehrung, type LegalDoc } from "./texts";

/**
 * Every bracketed text left in the legal documents: company data still missing (`COMPANY`) or a note
 * for the lawyer (`REVIEW`). Empty once the texts are final.
 */
export function reviewMarkers(docs: readonly LegalDoc[]): string[] {
  const found = new Set<string>();
  for (const doc of docs) {
    for (const block of doc) {
      const texts = block.kind === "list" ? block.items : block.kind === "lines" ? block.lines : [block.text];
      for (const text of texts) for (const marker of text.match(/\[[^\]]*\]/g) ?? []) found.add(marker);
    }
  }
  return [...found];
}

/**
 * All of Linkyo's legal documents, as the pages render them (the site address does not change any marker).
 * The privacy statement counts in its fullest form, with the statistics section, so a launch build still
 * fails while that section holds a review marker, whether or not the counting runs at that moment.
 */
export function legalDocs(): LegalDoc[] {
  return [impressum(), datenschutz({ statistics: true }), agb(), widerrufsbelehrung("https://linkyo.app")];
}

/**
 * Every review marker a launch must not leave behind: the legal documents' own, and the one shown
 * after each legal promise on the informational pages (Sicherheit & Datenschutz;
 * features/marketing/pages/review.ts), once each.
 */
export function launchMarkers(): string[] {
  return [...new Set([...reviewMarkers(legalDocs()), ...infoPageMarkers()])];
}

/**
 * The legal pages are drafts (and show the "Entwurf" banner) until the company data is real, a lawyer
 * has reviewed them (LEGAL_REVIEWED=1) and no bracketed marker is left.
 */
export function legalIsDraft({ legalReady, reviewed, markers }: { legalReady: boolean; reviewed: string | undefined; markers: readonly string[] }): boolean {
  return !legalReady || reviewed !== "1" || markers.length > 0;
}

/**
 * The build gate for going public. `next.config.ts` calls this at build time with NEXT_PUBLIC_PAYMENTS,
 * `legalReady` (company.ts), LEGAL_REVIEWED, EMAIL_TRANSPORT and LAUNCH.
 *
 * - Launch (`LAUNCH=1`): the legal pages must be final. A build fails while the texts still hold a
 *   bracketed marker or the "Entwurf" banner would still show (missing company data, no review),
 *   and while an informational page still marks a legal promise for the lawyer (`launchMarkers`).
 * - Live payments: real company data, a lawyer's review and a transport that really delivers e-mail,
 *   so a build that would take real money with placeholder legal texts, or without sending the order
 *   confirmation, the withdrawal information and the receipts the law asks for (§ 312f, § 356a,
 *   § 312k BGB), fails. The transport must be "tem" (LIVE_EMAIL_TRANSPORT in features/email/send.ts,
 *   which checks the same again at run time): unset, "console" and "capture" send nothing.
 *
 * Preview and demo builds (no LAUNCH, payments off or test) pass with drafts. Pure apart from reading
 * the texts; nothing of it reaches the browser.
 */
export function assertLiveReady({
  payments,
  legalReady,
  reviewed,
  emailTransport,
  launch,
  markers = launchMarkers(),
}: {
  payments: string | undefined;
  legalReady: boolean;
  reviewed: string | undefined;
  emailTransport: string | undefined;
  launch?: string | undefined;
  /** The markers left in the legal texts and on the informational pages; read from them unless given (tests). */
  markers?: readonly string[];
}): void {
  if (launch === "1" && legalIsDraft({ legalReady, reviewed, markers })) {
    const left = markers.length > 0 ? ` (${String(markers.length)} marker(s) left, e.g. ${markers[0] ?? ""})` : "";
    throw new Error(`LAUNCH=1 needs final legal texts: real company data, LEGAL_REVIEWED=1 and no [ ] marker${left}`);
  }
  if (payments !== "live") return;
  if (!legalReady || reviewed !== "1") {
    throw new Error("NEXT_PUBLIC_PAYMENTS=live needs the real company data and LEGAL_REVIEWED=1");
  }
  if (emailTransport !== "tem") {
    throw new Error("NEXT_PUBLIC_PAYMENTS=live needs EMAIL_TRANSPORT=tem: contract e-mails must really go out");
  }
}
