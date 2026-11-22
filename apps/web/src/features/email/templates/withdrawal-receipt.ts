import type { EmailMessage } from "../types";

import { clockTime, greeting, renderEmail, shortDate, type EmailLocale, type EmailT } from "./render";

export interface WithdrawalReceiptData {
  to: string;
  locale: EmailLocale;
  /** What the person typed, word for word. */
  name: string;
  contract: string;
  email: string;
  /** The server's time of receipt. */
  receivedAt: Date;
}

/**
 * The receipt of a withdrawal (§ 356a BGB, r3 §10.5): the content of the declaration, the date and
 * time it arrived, and what happens next. Built only from what was typed and the server's time, so it
 * says nothing about whether a contract matched.
 */
export function withdrawalReceipt(data: WithdrawalReceiptData, t: EmailT): EmailMessage {
  const date = shortDate(data.receivedAt, data.locale);
  const time = clockTime(data.receivedAt, data.locale);
  return renderEmail({
    to: data.to,
    subject: t("email.withdrawal.subject", { date, time }),
    locale: data.locale,
    tag: "withdrawal-receipt",
    t,
    blocks: [
      { kind: "text", text: greeting(t, data.name) },
      { kind: "text", text: t("email.withdrawal.body", { date, time }) },
      { kind: "text", text: t("email.withdrawal.content", { name: data.name, contract: data.contract, email: data.email }) },
      { kind: "text", text: t("email.withdrawal.next") },
    ],
  });
}
