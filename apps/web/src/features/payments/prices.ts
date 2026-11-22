/**
 * Every price Linkyo charges, in euro cents, gross (what the customer pays). The single source for
 * the service page, the checkouts, the Pro sheet, e-mails and the server that creates payments.
 *
 * No struck-through price anywhere: a lower "intro" price may only ever be shown with `introUntil`
 * (its end date) and `priceAfterCents` (the price after), and none exists today (prices.test.ts).
 */

/** How VAT is shown: 19 % included (default), or none as a small business (§ 19 UStG). Undecided. */
export type VatMode = "standard19" | "kleinunternehmer";
export const VAT_MODE: VatMode = "standard19";

export type PriceId = "service-start" | "service-premium" | "pro-monthly";

export interface Price {
  id: PriceId;
  amountCents: number;
  currency: "EUR";
  interval: "once" | "month";
  /** ISO date: the last day of an intro price. */
  introUntil?: string;
  /** The price after `introUntil`. */
  priceAfterCents?: number;
}

export const PRICES: Record<PriceId, Price> = {
  "service-start": { id: "service-start", amountCents: 2499, currency: "EUR", interval: "once" },
  "service-premium": { id: "service-premium", amountCents: 7999, currency: "EUR", interval: "once" },
  "pro-monthly": { id: "pro-monthly", amountCents: 800, currency: "EUR", interval: "month" },
};

/** Every price change, newest last (the basis for any "before" price, PAngV § 11). */
export const PRICE_CHANGELOG = [
  { at: "2026-11-22", id: "service-start", amountCents: 2499, note: "first price" },
  { at: "2026-11-22", id: "service-premium", amountCents: 7999, note: "first price" },
  { at: "2026-11-22", id: "pro-monthly", amountCents: 800, note: "first price" },
] as const satisfies readonly { at: string; id: PriceId; amountCents: number; note: string }[];

/** AI drafts a Pro account gets per calendar month (Europe/Berlin). */
export const PRO_DRAFTS = 5;
/** Revision rounds per service package, each within 14 days of delivery. */
export const REVISIONS = { start: 1, premium: 3 } as const;

/** The VAT contained in a gross amount: 19/119 of it, rounded to the cent; none for a small business. */
export function vatCents(amountCents: number, mode: VatMode = VAT_MODE): number {
  return mode === "standard19" ? Math.round((amountCents * 19) / 119) : 0;
}

/** "24,99 €" · "€24.99" · "24.99 €" (Western digits in every language). */
export function formatEuro(cents: number, locale: "de" | "en" | "ar"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", numberingSystem: "latn" }).format(cents / 100);
}
