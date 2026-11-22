import { formatEuro } from "@/features/payments/prices";

import type { EmailMessage } from "../types";

import { greeting, renderEmail, type EmailLocale, type EmailT } from "./render";

export interface RefundIssuedData {
  to: string;
  locale: EmailLocale;
  name?: string | null | undefined;
  number: string;
  amountCents: number;
  testMode?: boolean | undefined;
}

/** The team refunded an order (the voluntary money-back): how much, and that banks take a few days. */
export function refundIssued(data: RefundIssuedData, t: EmailT): EmailMessage {
  return renderEmail({
    to: data.to,
    subject: t("email.refund.subject", { number: data.number }),
    locale: data.locale,
    tag: "refund-issued",
    t,
    testMode: data.testMode === true,
    blocks: [
      { kind: "text", text: greeting(t, data.name) },
      { kind: "text", text: t("email.refund.body", { price: formatEuro(data.amountCents, data.locale) }) },
    ],
  });
}
