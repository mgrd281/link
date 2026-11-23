/**
 * The checkouts' small decisions, free of React and the browser so they can be tested: what the
 * payment slot shows, what a failed payment says, how long the done page waits for its order, and
 * which link leaves the checkout.
 */

/** The result of pressing "Zahlungspflichtig bestellen": paid, or not, with the payment provider's own words when it gave some. */
export interface PaymentResult {
  ok: boolean;
  /** Why it failed, as the provider says it to the customer ("Your card was declined."). */
  message?: string;
}

/** Stripe's answer to `confirm()` as a `PaymentResult` (a thrown error counts as failed). */
export function paymentResult(answer: { type: string; error?: { message?: string } | undefined } | null | undefined): PaymentResult {
  if (answer?.type === "success") return { ok: true };
  const message = answer?.error?.message?.trim();
  return message ? { ok: false, message } : { ok: false };
}

/** What the customer reads after a payment that did not go through: the provider's reason, else our own sentence. */
export function paymentFailedText(result: PaymentResult, fallback: string): string {
  const reason = result.message?.trim() ?? "";
  return reason === "" ? fallback : reason;
}

/** A Checkout Session as the page needs it, from the answer of `/api/checkout/*`; null when it could not be created. */
export function readSession(status: number, data: Record<string, unknown>): { sessionId: string; clientSecret: string } | null {
  return status === 200 && typeof data.sessionId === "string" && typeof data.clientSecret === "string" ? { sessionId: data.sessionId, clientSecret: data.clientSecret } : null;
}

export type SlotState = "notSetUp" | "failed" | "loading" | "form";

/**
 * What the payment slot shows: the note that payment is not set up (no publishable key), an error
 * (the session could not be created, or the payment form did not load), a skeleton while the
 * session is created, or the form. Never a skeleton that cannot end.
 */
export function slotState(input: { publishableKey: string; failed: boolean; clientSecret: string | null }): SlotState {
  if (!input.publishableKey) return "notSetUp";
  if (input.failed) return "failed";
  return input.clientSecret ? "form" : "loading";
}

/** The done page looks for its order every second at first ... */
export const QUICK_LOOKS = 20;
/** ... then says that it takes longer and keeps looking more slowly, for about five more minutes. */
export const SLOW_LOOKS = 60;

/** After `tries` looks without an order: is it time to say so? */
export function isLate(tries: number): boolean {
  return tries >= QUICK_LOOKS;
}

/** After `tries` looks without an order: milliseconds until the next look, or null to stop looking. */
export function nextLookDelay(tries: number): number | null {
  if (tries < QUICK_LOOKS) return 1000;
  return tries < QUICK_LOOKS + SLOW_LOOKS ? 5000 : null;
}

/** A checkout page ("/de/checkout/service", "/checkout/done"): the only pages that may hold Stripe.js. */
export function isCheckoutPath(pathname: string): boolean {
  return /^\/(?:[a-z]{2}\/)?checkout(?:\/|$)/.test(pathname);
}

/**
 * Whether following `href` from the page at `here` leads to another page of this site outside the
 * checkout. Such a link must be a full page load once Stripe.js is in the document (see
 * `StripeLeaveGuard`); other sites and the checkout's own pages need nothing.
 */
export function leavesCheckout(href: string, here: string): boolean {
  try {
    const from = new URL(here);
    const to = new URL(href, from);
    return to.origin === from.origin && !isCheckoutPath(to.pathname);
  } catch {
    return false;
  }
}
