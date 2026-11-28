import type { Decision } from "@/features/moderation/types";

import type { EmailMessage } from "../types";

import { clockTime, greeting, renderEmail, shortDate, type EmailLocale, type EmailT } from "./render";
import { reviewed } from "./statement-of-reasons";

/** The first eight characters of a report's id: enough to find it again, short enough to read out. */
export const reportReference = (id: string): string => id.replace(/-/g, "").slice(0, 8).toUpperCase();

export interface ReportReceiptData {
  /** The address the reporter typed. */
  to: string;
  locale: EmailLocale;
  name?: string | null | undefined;
  /** The page's address as reported. */
  page: string;
  id: string;
  receivedAt: Date;
}

/** Art. 16(4) DSA: the report arrived (when, about which page, its number) and what happens next. */
export function reportReceipt(data: ReportReceiptData, t: EmailT): EmailMessage {
  const { locale } = data;
  const when = { date: shortDate(data.receivedAt, locale), time: clockTime(data.receivedAt, locale) };
  return renderEmail({
    to: data.to,
    subject: t("email.report.receiptSubject", { reference: reportReference(data.id) }),
    locale,
    tag: "report-receipt",
    t,
    blocks: [
      { kind: "text", text: greeting(t, data.name) },
      { kind: "text", text: t("email.report.received", { page: data.page, reference: reportReference(data.id), ...when }) },
      { kind: "text", text: reviewed(t("email.report.next"), "email.receipt") },
    ],
  });
}

export interface ReportDecisionData {
  to: string;
  locale: EmailLocale;
  name?: string | null | undefined;
  page: string;
  id: string;
  receivedAt: Date;
  decision: Decision;
  /** The team's words to the reporter (a dismissal only: a restriction's reason is the creator's). */
  reason?: string | null | undefined;
  /** Where to object. */
  contact: string;
}

/** Art. 16(5) DSA: what the team decided about the report, that a person decided, and how to object. */
export function reportDecision(data: ReportDecisionData, t: EmailT): EmailMessage {
  const { locale } = data;
  return renderEmail({
    to: data.to,
    subject: t("email.report.decisionSubject", { reference: reportReference(data.id), date: shortDate(data.receivedAt, locale) }),
    locale,
    tag: "report-decision",
    t,
    blocks: [
      { kind: "text", text: greeting(t, data.name) },
      { kind: "text", text: t(`email.report.decided.${data.decision}`, { page: data.page }) },
      ...(data.decision === "dismiss" && data.reason?.trim() ? [{ kind: "quote" as const, text: data.reason.trim() }] : []),
      { kind: "text", text: t("email.report.human") },
      { kind: "text", text: reviewed(t("email.report.object", { email: data.contact }), "email.decision") },
    ],
  });
}
