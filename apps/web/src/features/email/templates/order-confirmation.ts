import { COMPANY } from "@/features/legal/company";
import { agb, widerrufsbelehrung } from "@/features/legal/texts";
import { briefingByFor } from "@/features/payments/delivery";
import { formatEuro, vatCents, type VatMode } from "@/features/payments/prices";

import type { EmailMessage } from "../types";

import { clockTime, deadline, greeting, longDate, renderEmail, shortDate, type EmailBlock, type EmailLocale, type EmailT } from "./render";

export interface OrderConfirmationData {
  to: string;
  name?: string | null | undefined;
  locale: EmailLocale;
  number: string;
  package: "start" | "premium";
  amountCents: number;
  vatMode: VatMode;
  orderedAt: Date;
  /** The promised ready date (fixed at consent). */
  dueAt: Date;
  /** When the work may start: the order time with an early start, else after the withdrawal period. */
  startAfter: Date;
  earlyStart: boolean;
  /** The exact checkbox text the customer agreed to (early start only). */
  earlyStartText?: string | null | undefined;
  /** The order's id, for the briefing link. */
  orderId: string;
  /** The website's origin, e.g. "https://linkyo.app". */
  site: string;
  testMode?: boolean | undefined;
}

/** The VAT line: "inkl. 3,99 € MwSt." or the small-business note. */
export function vatLine(t: EmailT, amountCents: number, mode: VatMode, locale: EmailLocale): string {
  return mode === "standard19" ? t("checkout.vat.standard19", { vat: formatEuro(vatCents(amountCents, mode), locale) }) : t("checkout.vat.kleinunternehmer");
}

/** Who we are (Art. 246a § 1 Abs. 1 Nr. 2–3 EGBGB): name, representative, address and how to reach us. */
export function whoWeAre(t: EmailT): EmailBlock[] {
  return [
    { kind: "heading", text: t("email.order.who") },
    { kind: "lines", lines: [COMPANY.name, COMPANY.representative, COMPANY.address, COMPANY.email, COMPANY.phone] },
  ];
}

/** The statutory withdrawal texts in full, the online withdrawal button, then the AGB in full. */
export function contractTexts(t: EmailT, locale: EmailLocale, site: string): EmailBlock[] {
  return [
    { kind: "heading", text: t("email.order.withdrawal") },
    // The Widerrufsbelehrung ends with the Muster-Widerrufsformular (its own section, features/legal/texts.ts).
    { kind: "legal", doc: widerrufsbelehrung(site) },
    { kind: "button", label: t("email.order.withdrawButton"), href: `${site}/${locale}/widerruf` },
    { kind: "heading", text: t("email.order.terms") },
    { kind: "legal", doc: agb() },
  ];
}

/**
 * The order confirmation (§ 312f BGB, a durable medium, sent before any work starts), in the order of
 * r3 §10.4: who we are; what was ordered (package, contents, total with VAT, payment method, when);
 * the ready date; the early-start record; our promise; the statutory warranty; the
 * Widerrufsbelehrung, the Muster-Widerrufsformular and the "Vertrag widerrufen" button; the AGB in
 * full; the invoice note; the briefing link.
 */
export function orderConfirmation(data: OrderConfirmationData, t: EmailT): EmailMessage {
  const { locale } = data;
  const packageName = t(`orders.package.${data.package}`);
  const features = t.raw(`service.${data.package}.features`) as string[];
  const price = formatEuro(data.amountCents, locale);
  const methods = t("checkout.methods.service");
  const agreed = data.earlyStartText?.trim();
  const blocks: EmailBlock[] = [
    { kind: "text", text: greeting(t, data.name) },
    { kind: "text", text: t("email.order.intro") },
    ...whoWeAre(t),
    { kind: "heading", text: t("email.order.what") },
    { kind: "text", text: `${t("checkout.service.line", { package: packageName })} · ${data.number}` },
    { kind: "list", items: features.map((feature) => feature.replace(/\*$/, "")) },
    { kind: "text", text: t("email.order.total", { price, vat: vatLine(t, data.amountCents, data.vatMode, locale) }) },
    // The offered methods (the confirmation is written before we know which one the bank used).
    { kind: "text", text: t("email.order.method", { method: methods.slice(methods.indexOf(":") + 1).trim() }) },
    { kind: "text", text: t("email.order.at", { date: shortDate(data.orderedAt, locale), time: clockTime(data.orderedAt, locale) }) },
    {
      kind: "text",
      text: t("email.order.due", { date: longDate(data.dueAt, locale), time: clockTime(data.dueAt, locale), briefingBy: deadline(briefingByFor(data.dueAt), locale) }),
    },
    ...(data.earlyStart
      ? ([
          { kind: "text", text: t("email.order.earlyYes") },
          { kind: "quote", text: agreed === undefined || agreed === "" ? t("checkout.early.label") : agreed },
        ] satisfies EmailBlock[])
      : ([{ kind: "text", text: t("email.order.earlyNo", { date: longDate(data.startAfter, locale) }) }] satisfies EmailBlock[])),
    { kind: "heading", text: t("email.order.promise") },
    { kind: "text", text: t("service.conditions.revisions") },
    { kind: "text", text: t("service.conditions.refund", { email: COMPANY.email }) },
    { kind: "text", text: t("service.conditions.who") },
    { kind: "text", text: t("email.order.warranty") },
    ...contractTexts(t, locale, data.site),
    { kind: "text", text: t("email.order.invoice") },
    { kind: "heading", text: t("email.order.next") },
    { kind: "button", label: t("email.order.briefingButton"), href: `${data.site}/${locale}/app/orders/${data.orderId}` },
  ];
  return renderEmail({
    to: data.to,
    subject: t("email.order.subject", { package: packageName, number: data.number }),
    locale,
    tag: "order-confirmation",
    blocks,
    t,
    testMode: data.testMode ?? false,
  });
}
