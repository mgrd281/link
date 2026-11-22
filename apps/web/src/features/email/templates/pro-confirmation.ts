import { formatEuro, PRO_DRAFTS, type VatMode } from "@/features/payments/prices";

import type { EmailMessage } from "../types";

import { contractTexts, vatLine, whoWeAre } from "./order-confirmation";
import { clockTime, greeting, longDate, renderEmail, shortDate, type EmailBlock, type EmailLocale, type EmailT } from "./render";

export interface ProConfirmationData {
  to: string;
  name?: string | null | undefined;
  locale: EmailLocale;
  amountCents: number;
  vatMode: VatMode;
  orderedAt: Date;
  /** The next charge: the end of the first paid month. */
  nextChargeAt: Date;
  site: string;
  testMode?: boolean | undefined;
}

/**
 * The Pro confirmation: the same structure as the order confirmation, plus the billing cycle, the next
 * charge, the term and how to cancel ("Verträge hier kündigen", also without signing in).
 */
export function proConfirmation(data: ProConfirmationData, t: EmailT): EmailMessage {
  const { locale } = data;
  const methods = t("checkout.methods.pro");
  const blocks: EmailBlock[] = [
    { kind: "text", text: greeting(t, data.name) },
    { kind: "text", text: t("email.pro.intro") },
    ...whoWeAre(t),
    { kind: "heading", text: t("email.order.what") },
    { kind: "text", text: t("checkout.pro.line") },
    { kind: "text", text: t("checkout.pro.includes", { count: PRO_DRAFTS }) },
    {
      kind: "text",
      text: t("email.pro.billing", { price: formatEuro(data.amountCents, locale), vat: vatLine(t, data.amountCents, data.vatMode, locale), date: longDate(data.nextChargeAt, locale) }),
    },
    { kind: "text", text: t("email.order.method", { method: methods.slice(methods.indexOf(":") + 1).trim() }) },
    { kind: "text", text: t("email.order.at", { date: shortDate(data.orderedAt, locale), time: clockTime(data.orderedAt, locale) }) },
    { kind: "text", text: t("email.pro.term") },
    { kind: "button", label: t("email.pro.cancel"), href: `${data.site}/${locale}/kuendigen` },
    { kind: "text", text: t("email.order.warranty") },
    ...contractTexts(t, locale, data.site),
    { kind: "text", text: t("email.order.invoice") },
  ];
  return renderEmail({ to: data.to, subject: t("email.pro.subject"), locale, tag: "pro-confirmation", blocks, t, testMode: data.testMode ?? false });
}
