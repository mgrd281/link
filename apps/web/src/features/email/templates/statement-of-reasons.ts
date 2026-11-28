import { isLegalPromise, LEGAL_PROMISE_MARKER } from "@/features/marketing/pages/review";
import type { Ground, Restriction } from "@/features/moderation/types";

import type { EmailMessage } from "../types";

import { greeting, renderEmail, shortDate, type EmailBlock, type EmailLocale, type EmailT } from "./render";

/** A legal promise still waiting for the lawyer carries the review marker, as on the website. */
export const reviewed = (text: string, key: string): string => (isLegalPromise("report", key) ? `${text} ${LEGAL_PROMISE_MARKER}` : text);

export interface StatementOfReasonsData {
  /** The account's own address (never one from a report). */
  to: string;
  locale: EmailLocale;
  /** The page's address ("linkyo.app/mila"). */
  page: string;
  action: Restriction;
  /** The hidden block's name (hide_block only). */
  blockLabel?: string | null | undefined;
  ground: Ground;
  /** The facts and circumstances, as the team wrote them. */
  reason: string;
  decidedAt: Date;
  /** When the report this answers came in; absent for the team's own finding. */
  reportedAt?: Date | null | undefined;
  /** The website's origin (the terms' address). */
  site: string;
  /** Where to object (the company's e-mail address). */
  contact: string;
}

/**
 * The statement of reasons (Art. 17 DSA) to the creator whose content the team restricted: what was
 * restricted, where and for how long (a); why, and whether a report led to it (b); that a person
 * decided (c); the ground, the law or our terms (d, e); and how to object (f). The reporter is never
 * named.
 */
export function statementOfReasons(data: StatementOfReasonsData, t: EmailT): EmailMessage {
  const { locale } = data;
  const block = data.blockLabel?.trim() ?? "";
  const values = { page: data.page, block: block === "" ? "–" : block, date: shortDate(data.decidedAt, locale) };
  const blocks: EmailBlock[] = [
    { kind: "text", text: greeting(t, null) },
    { kind: "text", text: t(`email.statement.what.${data.action}`, values) },
    { kind: "heading", text: t("email.statement.whyTitle") },
    {
      kind: "text",
      text: data.reportedAt ? t("email.statement.fromReport", { date: shortDate(data.reportedAt, locale) }) : t("email.statement.ownFinding"),
    },
    { kind: "quote", text: data.reason.trim() },
    {
      kind: "text",
      text: data.ground === "illegal" ? t("email.statement.groundIllegal") : t("email.statement.groundTerms", { terms: `${data.site}/${locale}/agb` }),
    },
    { kind: "text", text: t("email.statement.human") },
    { kind: "heading", text: t("email.statement.objectTitle") },
    { kind: "text", text: reviewed(t("email.statement.object", { email: data.contact }), "email.statement") },
  ];
  return renderEmail({ to: data.to, subject: t(`email.statement.subject.${data.action}`), locale, tag: "statement-of-reasons", t, blocks });
}
