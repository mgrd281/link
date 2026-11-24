import Stripe from "stripe";

import type { Locale } from "@/i18n/routing";

import { PRICES, type PriceId } from "../prices";
import { PaymentsNotConfigured, WebhookSignatureError, type CheckoutSession, type Payments, type PaymentsEvent, type SubscriptionState } from "../types";

import type { StripeSubscription } from "./subscription";

/**
 * The only file that talks to Stripe (the static guard enforces it). Every field it reads or writes
 * follows the API version stripe 23.2.0 pins (2026-11-18.endive, later than 2025-03-31.basil):
 * - a subscription's period end is `items.data[0].current_period_end` (no longer on the subscription);
 * - an invoice names its subscription and that subscription's metadata under
 *   `parent.subscription_details`, and its payment intent comes from its payments (`payments`, expanded);
 * - a Checkout Session takes `allowed_payment_method_types` (23.0.0 removed `payment_method_types`
 *   from `Checkout.SessionCreateParams`; the new field filters the dynamically eligible methods).
 * Each was checked against the package's own type definitions (resources/*.d.ts).
 *
 * Phase 1 never reaches Stripe: tests point the client at the local mock (`STRIPE_API_HOST` and
 * friends, loopback only and never on Vercel); without `STRIPE_SECRET_KEY` nothing is set up.
 */

/** How stripe-node is set up: the key, and (tests only) a local host to talk to instead of Stripe. */
export interface StripeSettings {
  secretKey: string;
  webhookSecret: string;
  host?: string | undefined;
  port?: number | undefined;
  protocol?: "http" | "https" | undefined;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * The settings from the environment. Throws `PaymentsNotConfigured` without a secret key, and a plain
 * error when a custom API host is not a loopback address or is set on Vercel (only tests use one).
 */
export function stripeSettingsFromEnv(env: Record<string, string | undefined> = process.env): StripeSettings {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!secretKey) throw new PaymentsNotConfigured("STRIPE_SECRET_KEY is not set");
  const host = env.STRIPE_API_HOST?.trim() ?? "";
  const settings: StripeSettings = { secretKey, webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() ?? "" };
  if (!host) return settings;
  if (env.VERCEL) throw new Error("STRIPE_API_HOST is for local tests only");
  if (!LOOPBACK.has(host)) throw new Error("STRIPE_API_HOST must be a loopback address");
  const port = Number(env.STRIPE_API_PORT ?? "");
  const protocol = env.STRIPE_API_PROTOCOL === "https" ? "https" : "http";
  return { ...settings, host, port: Number.isInteger(port) && port > 0 ? port : undefined, protocol };
}

const PRODUCT_NAMES: Record<PriceId, string> = {
  "service-start": "Linkyo Seitenservice Start",
  "service-premium": "Linkyo Seitenservice Premium",
  "pro-monthly": "Linkyo Pro",
};

/** Service: no SEPA (it confirms days later and can be disputed, while we deliver the next day). */
const SERVICE_METHODS: Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[] = ["card", "paypal"];
const PRO_METHODS: Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[] = ["card", "paypal", "sepa_debit"];

const iso = (seconds: number | null | undefined): string | null => (typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null);

const idOf = (value: string | { id: string } | null | undefined): string | null => (typeof value === "string" ? value : (value?.id ?? null));

const STATUSES = new Set(["active", "past_due", "canceled", "incomplete"]);

/** A subscription as the app sees it; the period end comes from its first item. */
export function subscriptionState(subscription: Stripe.Subscription): StripeSubscription {
  const item = subscription.items.data[0];
  const status = STATUSES.has(subscription.status) ? (subscription.status as SubscriptionState["status"]) : "other";
  const profileId = subscription.metadata.profile_id;
  return {
    id: subscription.id,
    status,
    stripeStatus: subscription.status,
    periodEnd: iso(item?.current_period_end) ?? new Date(0).toISOString(),
    billingAnchor: iso(subscription.billing_cycle_anchor),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: iso(subscription.cancel_at),
    customerId: idOf(subscription.customer) ?? "",
    profileId: typeof profileId === "string" && profileId !== "" ? profileId : null,
  };
}

export class StripePayments implements Payments {
  private readonly stripe: Stripe;

  constructor(private readonly settings: StripeSettings) {
    this.stripe = new Stripe(settings.secretKey, {
      // The version this SDK pins (its types describe exactly that version).
      apiVersion: Stripe.API_VERSION,
      maxNetworkRetries: 1,
      ...(settings.host ? { host: settings.host } : {}),
      ...(settings.port ? { port: settings.port } : {}),
      ...(settings.protocol ? { protocol: settings.protocol } : {}),
    });
  }

  private session(session: Stripe.Checkout.Session): CheckoutSession {
    if (!session.client_secret) throw new Error("Stripe returned a session without a client secret");
    return { sessionId: session.id, clientSecret: session.client_secret };
  }

  async createServiceCheckout(input: { profileId: string; email: string; product: "service-start" | "service-premium"; locale: Locale; returnUrl: string }): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "elements",
      customer_email: input.email,
      line_items: [
        {
          quantity: 1,
          price_data: { currency: "eur", unit_amount: PRICES[input.product].amountCents, product_data: { name: PRODUCT_NAMES[input.product] } },
        },
      ],
      allowed_payment_method_types: SERVICE_METHODS,
      invoice_creation: { enabled: true },
      metadata: { profile_id: input.profileId, product: input.product, locale: input.locale },
      return_url: input.returnUrl,
    });
    return this.session(session);
  }

  async createProCheckout(input: { profileId: string; email: string; locale: Locale; returnUrl: string }): Promise<CheckoutSession> {
    const metadata = { profile_id: input.profileId, locale: input.locale };
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "elements",
      customer_email: input.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: PRICES["pro-monthly"].amountCents,
            recurring: { interval: "month" },
            product_data: { name: PRODUCT_NAMES["pro-monthly"] },
          },
        },
      ],
      allowed_payment_method_types: PRO_METHODS,
      // Every later subscription and invoice event names the account through these.
      metadata: { ...metadata, product: "pro-monthly" },
      subscription_data: { metadata },
      return_url: input.returnUrl,
    });
    return this.session(session);
  }

  async retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return subscriptionState(await this.stripe.subscriptions.retrieve(subscriptionId));
  }

  async invoicePaymentIntent(invoiceId: string): Promise<string | null> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId, { expand: ["payments"] });
    const payments = invoice.payments?.data ?? [];
    const paid = payments.find((payment) => payment.status === "paid") ?? payments[0];
    return idOf(paid?.payment.payment_intent);
  }

  /**
   * One refund per decision: the idempotency key is the caller's (`key`, e.g. one per withdrawal), or
   * derived from the payment intent and the amount, so a retried request (a double click, a route that
   * runs again after a failure) never refunds twice. Stripe keeps keys for 24 hours; after that only
   * our own records stop a repeat (the routes check them before they call this).
   */
  async refund(input: { paymentIntentId: string; amountCents?: number; key?: string }): Promise<{ refundId: string; status: string }> {
    const amount = input.amountCents === undefined ? "full" : String(input.amountCents);
    const refund = await this.stripe.refunds.create(
      { payment_intent: input.paymentIntentId, ...(input.amountCents === undefined ? {} : { amount: input.amountCents }) },
      { idempotencyKey: input.key ?? `linkyo-refund-${input.paymentIntentId}-${amount}` },
    );
    return { refundId: refund.id, status: refund.status ?? "pending" };
  }

  async cancelAtPeriodEnd(subscriptionId: string): Promise<SubscriptionState> {
    return subscriptionState(await this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true }));
  }

  async cancelAt(subscriptionId: string, at: Date): Promise<SubscriptionState> {
    return subscriptionState(
      await this.stripe.subscriptions.update(subscriptionId, { cancel_at: Math.floor(at.getTime() / 1000), proration_behavior: "none" }),
    );
  }

  async resume(subscriptionId: string): Promise<SubscriptionState> {
    // An empty string unsets cancel_at (`Emptyable` in the types).
    return subscriptionState(await this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false, cancel_at: "" }));
  }

  /**
   * Ends the subscription now. Asked again when a later step of a team decision failed (or after
   * Stripe ended it itself), it answers the ended subscription: Stripe refuses to cancel a canceled
   * subscription ("No such subscription"), and that refusal would block every retry for good.
   */
  async cancelNow(subscriptionId: string): Promise<SubscriptionState> {
    const current = await this.stripe.subscriptions.retrieve(subscriptionId);
    if (current.status === "canceled") return subscriptionState(current);
    return subscriptionState(await this.stripe.subscriptions.cancel(subscriptionId, { prorate: false, invoice_now: false }));
  }

  async createPortalSession(input: { customerId: string; returnUrl: string; locale: "de" | "en" | "auto" }): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({ customer: input.customerId, return_url: input.returnUrl, locale: input.locale });
    return session.url;
  }

  verifyWebhook(rawBody: string, signature: string | null): PaymentsEvent {
    if (!this.settings.webhookSecret) throw new PaymentsNotConfigured("STRIPE_WEBHOOK_SECRET is not set");
    if (!signature) throw new WebhookSignatureError("No Stripe-Signature header");
    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.settings.webhookSecret);
      return { id: event.id, type: event.type, data: { object: event.data.object as unknown as Record<string, unknown> } };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) throw new WebhookSignatureError(error.message);
      throw error;
    }
  }
}
