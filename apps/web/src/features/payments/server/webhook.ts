import { orderConfirmation } from "@/features/email/templates/order-confirmation";
import { proConfirmation } from "@/features/email/templates/pro-confirmation";
import type { EmailLocale, EmailT } from "@/features/email/templates/render";
import type { EmailMessage } from "@/features/email/types";
import type { Db } from "@/lib/supabase/server";

import { PRICES, VAT_MODE, type VatMode } from "../prices";
import type { PaymentsEvent } from "../types";

import type { ServerPayments, StripeSubscription, SubscriptionRead } from "./subscription";

/**
 * Stripe webhooks (plan §1.6.1). Idempotency is "processed", not "received": an event counts as a
 * duplicate only once its handler finished (`stripe_events.processed_at`); any failure leaves it
 * unprocessed and answers 500, so Stripe delivers it again and the handler runs again. Every handler
 * is idempotent on its own, so a repeat is harmless:
 * - a paid service order is created once per Checkout Session; its confirmation e-mail goes out
 *   while `confirmation_sent_at` is empty, and only after it went out does the order join the team's
 *   queue (`mark_confirmation_sent`, § 312f BGB);
 * - Pro's state comes from the subscription as Stripe has it **now**, read again for every
 *   `customer.subscription.created` / `.updated` and for a subscription checkout
 *   (`retrieveSubscription`), never from the snapshot inside the event: Stripe does not deliver in
 *   order and redelivers a failed event up to days later, so a stale snapshot would bring back a
 *   cancelled Pro or an old period end. `customer.subscription.deleted` is final at Stripe, so it is
 *   applied as it comes. A refunded entitlement stays refunded;
 * - invoices carry their account in the subscription's metadata;
 * - a refund Stripe reports (`charge.refunded`) carries no kind and the sum refunded so far.
 *   `record_refund` works out the rest: the refund of a withdrawal the team accepted ends the
 *   contract, any other full refund marks the order or invoice refunded, a partial one is only noted,
 *   and the kind the console records (before or after this event) is the one that stays.
 */

export type EntitlementStatus = "active" | "past_due" | "canceled";

export interface OrderForEmail {
  id: string;
  number: string;
  package: "start" | "premium";
  amountCents: number;
  vatMode: VatMode;
  earlyStart: boolean;
  earlyStartText: string | null;
  orderedAt: string;
  startAfter: string;
  promisedDueAt: string;
  customerEmail: string;
  customerName: string | null;
  locale: EmailLocale;
  confirmationSentAt: string | null;
}

export interface WebhookStore {
  /** Stores the event once; answers whether its handler already finished. */
  claim(id: string, type: string): Promise<"processed" | "pending">;
  markProcessed(id: string): Promise<void>;
  recordServiceOrder(input: { session: string; paymentIntent: string; amount: number; email: string; name: string | null; vat: VatMode }): Promise<{ id: string; number: string; created: boolean } | { error: string }>;
  order(id: string): Promise<OrderForEmail | null>;
  markConfirmationSent(id: string): Promise<void>;
  upsertProSubscription(input: { account: string; customer: string; subscription: string; next: EntitlementStatus; periodEnd: string; cancelAtEnd: boolean; cancelAt: string | null }): Promise<void>;
  /** Pro's confirmation e-mail has not gone out yet (and the entitlement exists). */
  proConfirmationPending(subscription: string): Promise<boolean>;
  markProConfirmationSent(subscription: string): Promise<boolean>;
  recordInvoice(input: { id: string; account: string; subscription: string; amount: number; state: "paid" | "failed"; paymentIntent: string | null }): Promise<void>;
  recordRefund(paymentIntent: string, kind: "voluntary" | "withdrawal" | "goodwill", amount: number | null): Promise<string>;
  accountEmail(profileId: string): Promise<string | null>;
}

export interface WebhookDeps {
  store: WebhookStore;
  payments: Pick<ServerPayments, "retrieveSubscription" | "invoicePaymentIntent">;
  send: (message: EmailMessage) => Promise<unknown>;
  translator: (locale: EmailLocale) => Promise<EmailT>;
  /** The website's origin for links in e-mails. */
  site: string;
  testMode: boolean;
  log?: (line: Record<string, unknown>) => void;
}

export interface WebhookResult {
  status: 200 | 500;
  result: string;
}

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" ? (value as Obj) : {});
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
/** An id, whether Stripe sent the id or the expanded object. */
const idOf = (value: unknown): string | null => str(value) ?? str(obj(value).id);
const isoFrom = (seconds: number | null): string | null => (seconds === null ? null : new Date(seconds * 1000).toISOString());
const asLocale = (value: unknown): EmailLocale => (value === "en" || value === "ar" ? value : "de");

/** A subscription object from an event or a read, as the app sees it (period end from the first item). */
export function subscriptionFromObject(subscription: Obj): StripeSubscription {
  const item = obj((obj(subscription.items).data as unknown[] | undefined)?.[0]);
  const status = str(subscription.status) ?? "other";
  return {
    id: str(subscription.id) ?? "",
    status: status === "active" || status === "past_due" || status === "canceled" || status === "incomplete" ? status : "other",
    stripeStatus: status,
    periodEnd: isoFrom(num(item.current_period_end)) ?? new Date(0).toISOString(),
    billingAnchor: isoFrom(num(subscription.billing_cycle_anchor)),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    cancelAt: isoFrom(num(subscription.cancel_at)),
    customerId: idOf(subscription.customer) ?? "",
    profileId: str(obj(subscription.metadata).profile_id),
  };
}

/** Stripe's status as an entitlement status; null for states that grant nothing yet (incomplete, paused). */
function entitlementStatus(status: string): EntitlementStatus | null {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return null;
}

async function applySubscription(state: SubscriptionRead, stripeStatus: string, deps: WebhookDeps, fallbackProfile: string | null): Promise<{ applied: boolean; reason: string }> {
  const next = entitlementStatus(stripeStatus);
  const account = state.profileId ?? fallbackProfile;
  if (!next) return { applied: false, reason: `ignored: ${stripeStatus}` };
  if (!account) return { applied: false, reason: "ignored: no profile_id" };
  await deps.store.upsertProSubscription({
    account,
    customer: state.customerId,
    subscription: state.id,
    next,
    periodEnd: state.periodEnd,
    cancelAtEnd: state.cancelAtPeriodEnd,
    cancelAt: state.cancelAt,
  });
  return { applied: true, reason: `pro ${next}` };
}

async function serviceOrderPaid(session: Obj, deps: WebhookDeps): Promise<string> {
  const sessionId = str(session.id);
  const paymentIntent = idOf(session.payment_intent);
  const details = obj(session.customer_details);
  const email = str(details.email) ?? str(session.customer_email);
  if (!sessionId || !paymentIntent || !email) throw new Error("checkout session without id, payment intent or e-mail");
  const made = await deps.store.recordServiceOrder({
    session: sessionId,
    paymentIntent,
    amount: num(session.amount_total) ?? PRICES["service-start"].amountCents,
    email,
    name: str(details.name),
    vat: VAT_MODE,
  });
  if ("error" in made) throw new Error(`record_service_order: ${made.error}`);
  const order = await deps.store.order(made.id);
  if (!order) throw new Error("order vanished");
  if (order.confirmationSentAt) return `order ${order.number} already confirmed`;
  const t = await deps.translator(order.locale);
  await deps.send(
    orderConfirmation(
      {
        to: order.customerEmail,
        name: order.customerName,
        locale: order.locale,
        number: order.number,
        package: order.package,
        amountCents: order.amountCents,
        vatMode: order.vatMode,
        orderedAt: new Date(order.orderedAt),
        dueAt: new Date(order.promisedDueAt),
        startAfter: new Date(order.startAfter),
        earlyStart: order.earlyStart,
        earlyStartText: order.earlyStartText,
        orderId: order.id,
        site: deps.site,
        testMode: deps.testMode,
      },
      t,
    ),
  );
  // Only now does the order join the team's queue.
  await deps.store.markConfirmationSent(order.id);
  return `order ${order.number} confirmed`;
}

async function proCheckout(session: Obj, deps: WebhookDeps): Promise<string> {
  const subscriptionId = idOf(session.subscription);
  if (!subscriptionId) throw new Error("subscription checkout without a subscription");
  const metadata = obj(session.metadata);
  const state = await deps.payments.retrieveSubscription(subscriptionId);
  const { applied, reason } = await applySubscription(state, state.status, deps, str(metadata.profile_id));
  if (!applied || state.status !== "active") return reason;
  if (!(await deps.store.proConfirmationPending(subscriptionId))) return `${reason}, already confirmed`;
  const account = state.profileId ?? str(metadata.profile_id);
  const details = obj(session.customer_details);
  const to = str(details.email) ?? str(session.customer_email) ?? (account ? await deps.store.accountEmail(account) : null);
  if (!to) throw new Error("no address for the Pro confirmation");
  const locale = asLocale(metadata.locale);
  const t = await deps.translator(locale);
  await deps.send(
    proConfirmation(
      {
        to,
        name: str(details.name),
        locale,
        amountCents: num(session.amount_total) ?? PRICES["pro-monthly"].amountCents,
        vatMode: VAT_MODE,
        orderedAt: new Date(),
        nextChargeAt: new Date(state.periodEnd),
        site: deps.site,
        testMode: deps.testMode,
      },
      t,
    ),
  );
  await deps.store.markProConfirmationSent(subscriptionId);
  return `${reason}, confirmed`;
}

async function invoiceEvent(invoice: Obj, state: "paid" | "failed", deps: WebhookDeps): Promise<string> {
  const id = str(invoice.id);
  const details = obj(obj(invoice.parent).subscription_details);
  const subscription = idOf(details.subscription);
  const account = str(obj(details.metadata).profile_id);
  if (!id || !subscription || !account) return "ignored: not a Pro invoice";
  const amount = (state === "paid" ? num(invoice.amount_paid) : num(invoice.amount_due)) ?? 0;
  const paymentIntent = await deps.payments.invoicePaymentIntent(id);
  await deps.store.recordInvoice({ id, account, subscription, amount, state, paymentIntent });
  return `invoice ${state}`;
}

async function dispatch(event: PaymentsEvent, deps: WebhookDeps): Promise<string> {
  const object = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const mode = str(object.mode);
      if (mode === "subscription") return proCheckout(object, deps);
      if (mode !== "payment") return `ignored: mode ${String(mode)}`;
      // A completed session that is not paid yet (a delayed method) is confirmed by async_payment_succeeded.
      if (event.type === "checkout.session.completed" && object.payment_status !== "paid") return "ignored: not paid yet";
      return serviceOrderPaid(object, deps);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      // The event holds the subscription as it was when Stripe made it, and events arrive late and
      // out of order. What counts is the subscription now.
      const subscriptionId = str(object.id);
      if (!subscriptionId) return "ignored: no subscription id";
      const state = await deps.payments.retrieveSubscription(subscriptionId);
      return (await applySubscription(state, state.stripeStatus ?? state.status, deps, str(obj(object.metadata).profile_id))).reason;
    }
    case "customer.subscription.deleted":
      // Final at Stripe: nothing later can undo it.
      return (await applySubscription(subscriptionFromObject(object), "canceled", deps, null)).reason;
    case "invoice.paid":
      return invoiceEvent(object, "paid", deps);
    case "invoice.payment_failed":
      return invoiceEvent(object, "failed", deps);
    case "charge.refunded": {
      const paymentIntent = idOf(object.payment_intent);
      if (!paymentIntent) return "ignored: no payment intent";
      // Stripe names no kind, and this event may arrive before or after the console recorded its own
      // refund. "goodwill" is the weakest kind: record_refund reads it as the withdrawal's refund when
      // the team accepted one, never overwrites a kind the console wrote, and lets the console's later
      // call replace it. `amount_refunded` is the sum so far; a partial refund ends nothing.
      const result = await deps.store.recordRefund(paymentIntent, "goodwill", num(object.amount_refunded));
      return `refund ${result}`;
    }
    default:
      return "ignored";
  }
}

export async function handleStripeEvent(event: PaymentsEvent, deps: WebhookDeps): Promise<WebhookResult> {
  const log = deps.log ?? ((line: Record<string, unknown>) => console.warn(JSON.stringify(line)));
  try {
    if ((await deps.store.claim(event.id, event.type)) === "processed") return { status: 200, result: "duplicate" };
    const result = await dispatch(event, deps);
    await deps.store.markProcessed(event.id);
    return { status: 200, result };
  } catch (error) {
    // Unprocessed: Stripe delivers it again, and the handler runs again.
    log({ evt: "stripe_webhook_failed", type: event.type, id: event.id, error: error instanceof Error ? error.message : String(error) });
    return { status: 500, result: "failed" };
  }
}

// ─── The store on Supabase (service client) ─────────────────────────────────────────────────

async function run<T>(call: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

export function supabaseWebhookStore(db: Db): WebhookStore {
  return {
    async claim(id, type) {
      await run(db.from("stripe_events").upsert({ id, type }, { onConflict: "id", ignoreDuplicates: true }), "stripe_events insert");
      const row = await run(db.from("stripe_events").select("processed_at").eq("id", id).single(), "stripe_events read");
      return row?.processed_at ? "processed" : "pending";
    },
    async markProcessed(id) {
      await run(db.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", id), "stripe_events processed");
    },
    async recordServiceOrder(input) {
      const result = obj(
        await run(
          db.rpc("record_service_order", {
            session: input.session,
            payment_intent: input.paymentIntent,
            amount: input.amount,
            email: input.email,
            ...(input.name ? { name: input.name } : {}),
            vat: input.vat,
          }),
          "record_service_order",
        ),
      );
      const error = str(result.error);
      if (error) return { error };
      return { id: String(result.id), number: String(result.number), created: result.created === true };
    },
    async order(id) {
      const row = await run(
        db
          .from("orders")
          .select("id, number, package, amount_cents, vat_mode, early_start, early_start_text, ordered_at, start_after, promised_due_at, customer_email, customer_name, locale, confirmation_sent_at")
          .eq("id", id)
          .maybeSingle(),
        "orders read",
      );
      if (!row) return null;
      return {
        id: row.id,
        number: row.number,
        package: row.package,
        amountCents: row.amount_cents,
        vatMode: row.vat_mode === "kleinunternehmer" ? "kleinunternehmer" : "standard19",
        earlyStart: row.early_start,
        earlyStartText: row.early_start_text,
        orderedAt: row.ordered_at,
        startAfter: row.start_after,
        promisedDueAt: row.promised_due_at,
        customerEmail: row.customer_email,
        customerName: row.customer_name,
        locale: asLocale(row.locale),
        confirmationSentAt: row.confirmation_sent_at,
      };
    },
    async markConfirmationSent(id) {
      await run(db.rpc("mark_confirmation_sent", { target: id }), "mark_confirmation_sent");
    },
    async upsertProSubscription(input) {
      await run(
        db.rpc("upsert_pro_subscription", {
          account: input.account,
          customer: input.customer,
          subscription: input.subscription,
          next: input.next,
          period_end: input.periodEnd,
          cancel_at_end: input.cancelAtEnd,
          ...(input.cancelAt ? { cancel_at: input.cancelAt } : {}),
        }),
        "upsert_pro_subscription",
      );
    },
    async proConfirmationPending(subscription) {
      const row = await run(db.from("entitlements").select("confirmation_sent_at").eq("stripe_subscription_id", subscription).maybeSingle(), "entitlements read");
      return row !== null && row.confirmation_sent_at === null;
    },
    async markProConfirmationSent(subscription) {
      return (await run(db.rpc("mark_pro_confirmation_sent", { subscription }), "mark_pro_confirmation_sent")) === true;
    },
    async recordInvoice(input) {
      await run(
        db.rpc("record_invoice", {
          id: input.id,
          account: input.account,
          subscription: input.subscription,
          amount: input.amount,
          state: input.state,
          ...(input.paymentIntent ? { payment_intent: input.paymentIntent } : {}),
        }),
        "record_invoice",
      );
    },
    async recordRefund(paymentIntent, kind, amount) {
      return (await run(db.rpc("record_refund", { payment_intent: paymentIntent, kind, ...(amount === null ? {} : { amount }) }), "record_refund")) ?? "notFound";
    },
    async accountEmail(profileId) {
      const { data, error } = await db.auth.admin.getUserById(profileId);
      if (error) return null;
      return data.user.email ?? null;
    },
  };
}
