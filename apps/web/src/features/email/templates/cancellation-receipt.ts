import type { EmailMessage } from "../types";

import { calendarDay, clockTime, greeting, renderEmail, shortDate, type EmailBlock, type EmailLocale, type EmailT } from "./render";

export interface CancellationReceiptData {
  to: string;
  locale: EmailLocale;
  kind: "ordinary" | "extraordinary";
  /** "Cancel as of" (YYYY-MM-DD), or null for the earliest possible date. */
  wantedDate: string | null;
  name: string;
  accountEmail: string;
  receivedAt: Date;
}

/** The receipt's subject and paragraphs: the content, the date and time received, and the rule. */
export function cancellationReceiptParts(data: CancellationReceiptData, t: EmailT): { subject: string; blocks: EmailBlock[] } {
  const date = shortDate(data.receivedAt, data.locale);
  const time = clockTime(data.receivedAt, data.locale);
  const kind = t(data.kind === "ordinary" ? "legal.cancel.kindOrdinary" : "legal.cancel.kindExtraordinary");
  const when = data.kind === "extraordinary" || data.wantedDate === null ? t("legal.cancel.whenNext") : calendarDay(data.wantedDate, data.locale);
  const ends =
    data.kind === "extraordinary"
      ? t("email.cancellation.extraordinary")
      : data.wantedDate === null
        ? t("email.cancellation.endsRule")
        : t("email.cancellation.endsRuleDate", { date: calendarDay(data.wantedDate, data.locale) });
  return {
    subject: t("email.cancellation.subject", { date, time }),
    blocks: [
      { kind: "text", text: t("email.cancellation.body", { date, time }) },
      {
        kind: "text",
        text: t("email.cancellation.content", { kind, contract: t("legal.cancel.contractPro"), when, name: data.name, accountEmail: data.accountEmail }),
      },
      { kind: "text", text: ends },
    ],
  };
}

/**
 * The receipt to the address typed into the cancellation form (§ 312k Abs. 4 BGB, r3 §10.6): the
 * content, the date and time received, and when Pro ends **as a rule**. It never states anything
 * about the account (whether one matched, its end date): that goes only to the account's own address
 * (cancellation-confirmation.ts), so a typed address learns nothing (GDPR Art. 5(1)(f)).
 */
export function cancellationReceipt(data: CancellationReceiptData, t: EmailT): EmailMessage {
  const { subject, blocks } = cancellationReceiptParts(data, t);
  return renderEmail({
    to: data.to,
    subject,
    locale: data.locale,
    tag: "cancellation-receipt",
    t,
    blocks: [{ kind: "text", text: greeting(t, data.name) }, ...blocks],
  });
}
