import type { EmailMessage } from "../types";

import { cancellationReceiptParts, type CancellationReceiptData } from "./cancellation-receipt";
import { greeting, longDate, renderEmail, shortDate, type EmailBlock, type EmailLocale, type EmailT } from "./render";

export interface CancellationConfirmationData {
  /** The account's own address (never a typed one). */
  to: string;
  locale: EmailLocale;
  name?: string | null | undefined;
  receivedAt: Date;
  /** When Pro ends; null for an extraordinary cancellation the team still reviews. */
  endsAt: Date | null;
}

/**
 * To the matched account's own address only: the exact end date (or that the extraordinary
 * cancellation is being reviewed), and what to do when the account holder did not cancel.
 */
export function cancellationConfirmation(data: CancellationConfirmationData, t: EmailT): EmailMessage {
  return renderEmail({
    to: data.to,
    subject: t("email.cancellation.confirmSubject", { date: shortDate(data.receivedAt, data.locale) }),
    locale: data.locale,
    tag: "cancellation-confirmation",
    t,
    blocks: [{ kind: "text", text: greeting(t, data.name) }, ...accountBlocks(data.endsAt, data.locale, t)],
  });
}

function accountBlocks(endsAt: Date | null, locale: EmailLocale, t: EmailT): EmailBlock[] {
  return [
    { kind: "text", text: endsAt ? t("email.cancellation.ends", { date: longDate(endsAt, locale) }) : t("email.cancellation.extraordinaryReview") },
    { kind: "text", text: t("email.cancellation.notYou") },
  ];
}

/**
 * One e-mail when the confirmation address typed into the form is the account's own address: the
 * receipt (content, date and time, the rule) followed by the account's exact end date.
 */
export function cancellationCombined(receipt: CancellationReceiptData, account: { endsAt: Date | null }, t: EmailT): EmailMessage {
  const { subject, blocks } = cancellationReceiptParts(receipt, t);
  return renderEmail({
    to: receipt.to,
    subject,
    locale: receipt.locale,
    tag: "cancellation-confirmation",
    t,
    blocks: [{ kind: "text", text: greeting(t, receipt.name) }, ...blocks, ...accountBlocks(account.endsAt, receipt.locale, t)],
  });
}
