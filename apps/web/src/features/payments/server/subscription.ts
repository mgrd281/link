import type { Payments, SubscriptionState } from "../types";

/**
 * A subscription as this server reads it from Stripe: the app-wide `SubscriptionState` plus the two
 * things only the server needs.
 */
export interface StripeSubscription extends SubscriptionState {
  /**
   * Stripe's own status word. `status` folds everything but four states into "other"; the webhook
   * also has to tell "trialing", "unpaid" and "incomplete_expired" apart.
   */
  stripeStatus: string;
  /**
   * ISO; `billing_cycle_anchor`. Monthly periods end on the anchor's day of the month, or on the last
   * day of a shorter month, so after a short month the period end alone no longer shows the day
   * (anchored on the 31st: 28 Feb, then 31 Mar).
   */
  billingAnchor: string | null;
}

/** What a subscription read answers: the Stripe client fills both fields, a simple stand-in need not. */
export type SubscriptionRead = SubscriptionState & Partial<Pick<StripeSubscription, "stripeStatus" | "billingAnchor">>;

/** `Payments`, with subscription reads that may carry the server's fields. Every `Payments` fits. */
export type ServerPayments = Omit<Payments, "retrieveSubscription"> & { retrieveSubscription(subscriptionId: string): Promise<SubscriptionRead> };
