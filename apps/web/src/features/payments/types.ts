import type { Locale } from "@/i18n/routing";

/**
 * What the app needs from a payment provider. Only `features/payments/server/stripe-payments.ts`
 * talks to Stripe (the static guard enforces it); routes and tests use this interface. Field notes
 * follow Stripe API 2025-03-31.basil, which moved several fields off their old objects.
 */

/** An embedded checkout: the browser mounts the payment form with the client secret. */
export interface CheckoutSession {
  sessionId: string;
  clientSecret: string;
}

export interface SubscriptionState {
  id: string;
  status: "active" | "past_due" | "canceled" | "incomplete" | "other";
  /** ISO; read from items.data[0].current_period_end (moved off Subscription in 2025-03-31.basil). */
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  customerId: string;
  /** metadata.profile_id (set through subscription_data.metadata at checkout). */
  profileId: string | null;
}

export interface Payments {
  createServiceCheckout(input: { profileId: string; email: string; product: "service-start" | "service-premium"; locale: Locale; returnUrl: string }): Promise<CheckoutSession>;
  /** Sets subscription_data.metadata.profile_id, so every later event names the account. */
  createProCheckout(input: { profileId: string; email: string; locale: Locale; returnUrl: string }): Promise<CheckoutSession>;
  retrieveSubscription(subscriptionId: string): Promise<SubscriptionState>;
  /** From the invoice's payments (an invoice has no top-level payment_intent since basil). */
  invoicePaymentIntent(invoiceId: string): Promise<string | null>;
  refund(input: { paymentIntentId: string; amountCents?: number }): Promise<{ refundId: string; status: string }>;
  cancelAtPeriodEnd(subscriptionId: string): Promise<SubscriptionState>;
  /** Stripe cancel_at, proration_behavior "none". */
  cancelAt(subscriptionId: string, at: Date): Promise<SubscriptionState>;
  /** Clears cancel_at_period_end and cancel_at. */
  resume(subscriptionId: string): Promise<SubscriptionState>;
  /** subscriptions.cancel, no proration, no invoice_now. */
  cancelNow(subscriptionId: string): Promise<SubscriptionState>;
  /** Throws WebhookSignatureError when the signature does not match the raw body. */
  verifyWebhook(rawBody: string, signature: string | null): PaymentsEvent;
}

export interface PaymentsEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export class WebhookSignatureError extends Error {
  override name = "WebhookSignatureError";
}

/** No STRIPE_SECRET_KEY: the checkout API answers 503 notConfigured. */
export class PaymentsNotConfigured extends Error {
  override name = "PaymentsNotConfigured";
}
