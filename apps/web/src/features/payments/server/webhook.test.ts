import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { emailTranslator } from "@/features/email/templates/render";
import type { EmailMessage } from "@/features/email/types";
import de from "@/messages/de.json";

import { WebhookSignatureError, type PaymentsEvent } from "../types";

import { StripePayments } from "./stripe-payments";
import type { SubscriptionRead } from "./subscription";
import { handleStripeEvent, type EntitlementStatus, type OrderForEmail, type WebhookDeps, type WebhookStore } from "./webhook";

/**
 * The webhook handler against an in-memory store that follows the billing migration's rules
 * (idempotent order per session, `refunded` is final, invoices keyed by id). Events are signed like
 * Stripe signs them and checked by the real `verifyWebhook`.
 */

const SECRET = "whsec_unit_webhook";
const verifier = new StripePayments({ secretKey: "sk_test_unit", webhookSecret: SECRET });

/** Signs an event the way Stripe does and reads it back through `verifyWebhook`. */
function signed(id: string, type: string, object: Record<string, unknown>): PaymentsEvent {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  return verifier.verifyWebhook(payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }));
}

interface Entitlement {
  profile: string;
  status: EntitlementStatus | "refunded";
  periodEnd: string;
  confirmationSentAt: string | null;
}

function harness() {
  const log: string[] = [];
  const events = new Map<string, boolean>();
  const intents = new Map([
    ["cs_paid", { profile: "p-1", product: "service-start", consent: true, early: true }],
    ["cs_noconsent", { profile: "p-1", product: "service-start", consent: false, early: false }],
  ]);
  const orders = new Map<string, OrderForEmail>();
  const entitlements = new Map<string, Entitlement>();
  const invoices = new Map<string, { account: string; subscription: string; state: string; paymentIntent: string | null }>();
  const mails: EmailMessage[] = [];
  let failSends = 0;

  const store: WebhookStore = {
    claim: (id) => {
      if (!events.has(id)) events.set(id, false);
      return Promise.resolve(events.get(id) ? "processed" : "pending");
    },
    markProcessed: (id) => {
      events.set(id, true);
      return Promise.resolve();
    },
    recordServiceOrder: (input) => {
      log.push("record_service_order");
      const existing = [...orders.values()].find((order) => order.id === `o-${input.session}`);
      if (existing) return Promise.resolve({ id: existing.id, number: existing.number, created: false });
      const intent = intents.get(input.session);
      if (!intent) return Promise.resolve({ error: "notFound" });
      if (!intent.consent) return Promise.resolve({ error: "noConsent" });
      const order: OrderForEmail = {
        id: `o-${input.session}`,
        number: "LNK-2026-000001",
        package: "start",
        amountCents: input.amount,
        vatMode: input.vat,
        earlyStart: intent.early,
        earlyStartText: intent.early ? "Bitte fangt sofort an." : null,
        orderedAt: "2026-11-23T09:15:00.000Z",
        startAfter: "2026-11-23T09:15:00.000Z",
        promisedDueAt: "2026-11-24T17:00:00.000Z",
        customerEmail: input.email,
        customerName: input.name,
        locale: "de",
        confirmationSentAt: null,
      };
      orders.set(order.id, order);
      return Promise.resolve({ id: order.id, number: order.number, created: true });
    },
    order: (id) => Promise.resolve(orders.get(id) ?? null),
    markConfirmationSent: (id) => {
      log.push("mark_confirmation_sent");
      const order = orders.get(id);
      if (order && !order.confirmationSentAt) order.confirmationSentAt = new Date().toISOString();
      return Promise.resolve();
    },
    upsertProSubscription: (input) => {
      log.push(`upsert ${input.next}`);
      const current = entitlements.get(input.subscription);
      if (current?.status === "refunded") return Promise.resolve();
      entitlements.set(input.subscription, { profile: current?.profile ?? input.account, status: input.next, periodEnd: input.periodEnd, confirmationSentAt: current?.confirmationSentAt ?? null });
      return Promise.resolve();
    },
    proConfirmationPending: (subscription) => Promise.resolve(entitlements.get(subscription)?.confirmationSentAt === null),
    markProConfirmationSent: (subscription) => {
      const entitlement = entitlements.get(subscription);
      if (!entitlement || entitlement.confirmationSentAt) return Promise.resolve(false);
      entitlement.confirmationSentAt = new Date().toISOString();
      return Promise.resolve(true);
    },
    recordInvoice: (input) => {
      log.push(`invoice ${input.state}`);
      const current = invoices.get(input.id);
      invoices.set(input.id, { account: input.account, subscription: input.subscription, state: current?.state === "refunded" ? "refunded" : input.state, paymentIntent: current?.paymentIntent ?? input.paymentIntent });
      return Promise.resolve();
    },
    recordRefund: (paymentIntent, kind, amount) => {
      log.push(`refund ${paymentIntent} ${kind} ${String(amount)}`);
      return Promise.resolve("ok");
    },
    accountEmail: () => Promise.resolve("account@example.com"),
  };

  // The subscription as Stripe has it right now (what `retrieveSubscription` answers); tests change it.
  let atStripe: SubscriptionRead = {
    id: "sub_1",
    status: "active",
    periodEnd: "2026-12-23T09:15:00.000Z",
    cancelAtPeriodEnd: false,
    cancelAt: null,
    customerId: "cus_1",
    profileId: "p-2",
  };
  const reads: string[] = [];

  const deps: WebhookDeps = {
    store,
    payments: {
      retrieveSubscription: (id) => {
        reads.push(id);
        return Promise.resolve({ ...atStripe, id });
      },
      invoicePaymentIntent: (id) => Promise.resolve(`pi_${id}`),
    },
    send: (message) => {
      if (failSends > 0) {
        failSends -= 1;
        return Promise.reject(new Error("mail down"));
      }
      log.push(`mail ${message.tag}`);
      mails.push(message);
      return Promise.resolve({ id: "m" });
    },
    translator: () => Promise.resolve(emailTranslator("de", de)),
    site: "https://linkyo.app",
    testMode: true,
    log: () => undefined,
  };

  return {
    log,
    orders,
    entitlements,
    invoices,
    mails,
    deps,
    reads,
    /** Changes the subscription at Stripe (the next read sees it). */
    stripeNow: (change: Partial<SubscriptionRead>) => {
      atStripe = { ...atStripe, ...change };
    },
    failNextSends: (count: number) => {
      failSends = count;
    },
  };
}

const paidSession = (session = "cs_paid") => ({
  id: session,
  object: "checkout.session",
  mode: "payment",
  payment_status: "paid",
  payment_intent: `pi_${session}`,
  amount_total: 2499,
  customer_email: "mila@example.com",
  customer_details: { email: "mila@example.com", name: "Mila Berg" },
  metadata: { profile_id: "p-1", product: "service-start", locale: "de" },
});

/** A subscription as an event carries it: a snapshot from when Stripe made the event. */
const subscriptionObject = (status = "active", periodEnd = "2026-12-23T09:15:00Z", metadata: Record<string, string> = { profile_id: "p-2", locale: "de" }) => ({
  id: "sub_1",
  object: "subscription",
  status,
  customer: "cus_1",
  cancel_at_period_end: false,
  cancel_at: null,
  metadata,
  items: { object: "list", data: [{ id: "si_1", current_period_end: Math.floor(Date.parse(periodEnd) / 1000) }] },
});

const invoiceObject = {
  id: "in_1",
  object: "invoice",
  amount_paid: 800,
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { profile_id: "p-2" } } },
};

describe("signatures", () => {
  it("accepts a correctly signed event and refuses a tampered one", () => {
    const payload = JSON.stringify({ id: "evt_sig", object: "event", type: "invoice.paid", data: { object: {} } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect(verifier.verifyWebhook(payload, header).id).toBe("evt_sig");
    expect(() => verifier.verifyWebhook(payload.replace("evt_sig", "evt_other"), header)).toThrow(WebhookSignatureError);
    expect(() => verifier.verifyWebhook(payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" }))).toThrow(WebhookSignatureError);
  });
});

describe("a paid service order", () => {
  it("creates the order, sends the confirmation, then queues the order (in that order)", async () => {
    const h = harness();
    expect(await handleStripeEvent(signed("evt_1", "checkout.session.completed", paidSession()), h.deps)).toEqual({ status: 200, result: "order LNK-2026-000001 confirmed" });
    expect(h.log).toEqual(["record_service_order", "mail order-confirmation", "mark_confirmation_sent"]);
    expect(h.mails[0]?.to).toBe("mila@example.com");
    expect(h.mails[0]?.text).toContain("Muster-Widerrufsformular");
  });

  it("a processed duplicate has no second effect", async () => {
    const h = harness();
    const event = signed("evt_2", "checkout.session.completed", paidSession());
    await handleStripeEvent(event, h.deps);
    expect(await handleStripeEvent(event, h.deps)).toEqual({ status: 200, result: "duplicate" });
    expect(h.mails).toHaveLength(1);
    expect(h.log.filter((line) => line === "record_service_order")).toHaveLength(1);
  });

  it("when the e-mail fails, the event stays unprocessed (500); the redelivery sends it and confirms once", async () => {
    const h = harness();
    const event = signed("evt_3", "checkout.session.completed", paidSession());
    h.failNextSends(1);
    expect((await handleStripeEvent(event, h.deps)).status).toBe(500);
    expect(h.orders.get("o-cs_paid")?.confirmationSentAt).toBeNull();
    expect((await handleStripeEvent(event, h.deps)).status).toBe(200);
    expect(h.mails).toHaveLength(1);
    expect(h.log.filter((line) => line === "mark_confirmation_sent")).toHaveLength(1);
    expect(h.orders.get("o-cs_paid")?.confirmationSentAt).not.toBeNull();
    // A third delivery of the same (now processed) event does nothing.
    expect((await handleStripeEvent(event, h.deps)).result).toBe("duplicate");
    expect(h.mails).toHaveLength(1);
  });

  it("an unpaid completed session is acknowledged and ignored; async_payment_succeeded takes the order", async () => {
    const h = harness();
    expect(await handleStripeEvent(signed("evt_4", "checkout.session.completed", { ...paidSession(), payment_status: "unpaid" }), h.deps)).toEqual({ status: 200, result: "ignored: not paid yet" });
    expect(h.orders.size).toBe(0);
    expect((await handleStripeEvent(signed("evt_5", "checkout.session.async_payment_succeeded", paidSession()), h.deps)).status).toBe(200);
    expect(h.orders.size).toBe(1);
  });

  it("without the customer's consent nothing is created and Stripe retries (500)", async () => {
    const h = harness();
    expect((await handleStripeEvent(signed("evt_6", "checkout.session.completed", paidSession("cs_noconsent")), h.deps)).status).toBe(500);
    expect(h.orders.size).toBe(0);
    expect(h.mails).toHaveLength(0);
  });
});

describe("Pro, in any order of events", () => {
  const proSession = {
    id: "cs_pro",
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    subscription: "sub_1",
    amount_total: 800,
    customer_email: "ben@example.com",
    metadata: { profile_id: "p-2", locale: "de" },
  };
  const all = [
    () => signed("evt_inv", "invoice.paid", invoiceObject),
    () => signed("evt_co", "checkout.session.completed", proSession),
    () => signed("evt_sub", "customer.subscription.created", subscriptionObject()),
  ];
  const orders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];

  it.each(orders)("events %i, %i, %i: invoice with its profile, entitlement active, one Pro e-mail", async (...indexes) => {
    const h = harness();
    for (const index of indexes) expect((await handleStripeEvent(all[index]!(), h.deps)).status).toBe(200);
    expect(h.invoices.get("in_1")).toEqual({ account: "p-2", subscription: "sub_1", state: "paid", paymentIntent: "pi_in_1" });
    expect(h.entitlements.get("sub_1")?.status).toBe("active");
    expect(h.entitlements.get("sub_1")?.periodEnd).toBe("2026-12-23T09:15:00.000Z");
    expect(h.mails.filter((mail) => mail.tag === "pro-confirmation").map((mail) => mail.to)).toEqual(["ben@example.com"]);
  });

  it("customer.subscription.updated after a team refund leaves the entitlement refunded", async () => {
    const h = harness();
    await handleStripeEvent(signed("evt_c", "customer.subscription.created", subscriptionObject()), h.deps);
    const entitlement = h.entitlements.get("sub_1");
    if (entitlement) entitlement.status = "refunded"; // update_pro_subscription(sub, 'refunded') by the team
    await handleStripeEvent(signed("evt_u", "customer.subscription.updated", subscriptionObject("active")), h.deps);
    expect(h.entitlements.get("sub_1")?.status).toBe("refunded");
  });

  it("customer.subscription.deleted cancels; an incomplete subscription grants nothing yet", async () => {
    const h = harness();
    h.stripeNow({ status: "incomplete" });
    expect((await handleStripeEvent(signed("evt_i", "customer.subscription.created", subscriptionObject("incomplete")), h.deps)).result).toBe("ignored: incomplete");
    expect(h.entitlements.size).toBe(0);
    h.stripeNow({ status: "active" });
    await handleStripeEvent(signed("evt_a", "customer.subscription.updated", subscriptionObject("active")), h.deps);
    await handleStripeEvent(signed("evt_d", "customer.subscription.deleted", subscriptionObject("active")), h.deps);
    expect(h.entitlements.get("sub_1")?.status).toBe("canceled");
  });

  it("a redelivered customer.subscription.updated never brings back a cancelled Pro", async () => {
    const h = harness();
    await handleStripeEvent(signed("evt_c", "customer.subscription.created", subscriptionObject()), h.deps);
    expect(h.entitlements.get("sub_1")?.status).toBe("active");
    // The team ends the subscription at once (an accepted extraordinary cancellation).
    h.stripeNow({ status: "canceled" });
    await handleStripeEvent(signed("evt_d", "customer.subscription.deleted", subscriptionObject("canceled")), h.deps);
    expect(h.entitlements.get("sub_1")?.status).toBe("canceled");
    // Stripe now redelivers an older event that failed once: its snapshot still says "active until 23 Dec".
    expect(await handleStripeEvent(signed("evt_stale", "customer.subscription.updated", subscriptionObject("active")), h.deps)).toEqual({ status: 200, result: "pro canceled" });
    expect(h.entitlements.get("sub_1")?.status).toBe("canceled");
    expect(h.reads).toContain("sub_1");
  });

  it("a stale customer.subscription.updated after a renewal keeps the current period end", async () => {
    const h = harness();
    h.stripeNow({ periodEnd: "2027-01-23T09:15:00.000Z" });
    await handleStripeEvent(signed("evt_renewed", "customer.subscription.updated", subscriptionObject("active", "2027-01-23T09:15:00Z")), h.deps);
    await handleStripeEvent(signed("evt_old", "customer.subscription.updated", subscriptionObject("active", "2026-12-23T09:15:00Z")), h.deps);
    expect(h.entitlements.get("sub_1")).toMatchObject({ status: "active", periodEnd: "2027-01-23T09:15:00.000Z" });
  });

  it("reads Stripe's own status word: unpaid is past due, a paused or unknown one changes nothing", async () => {
    const h = harness();
    await handleStripeEvent(signed("evt_c", "customer.subscription.created", subscriptionObject()), h.deps);
    h.stripeNow({ status: "other", stripeStatus: "unpaid" });
    expect((await handleStripeEvent(signed("evt_u1", "customer.subscription.updated", subscriptionObject("active")), h.deps)).result).toBe("pro past_due");
    expect(h.entitlements.get("sub_1")?.status).toBe("past_due");
    h.stripeNow({ status: "other", stripeStatus: "paused" });
    expect((await handleStripeEvent(signed("evt_u2", "customer.subscription.updated", subscriptionObject("active")), h.deps)).result).toBe("ignored: paused");
    expect(h.entitlements.get("sub_1")?.status).toBe("past_due");
  });

  it("names the account from the event when the subscription at Stripe carries no profile", async () => {
    const h = harness();
    h.stripeNow({ profileId: null });
    await handleStripeEvent(signed("evt_c", "customer.subscription.created", subscriptionObject("active", "2026-12-23T09:15:00Z", { profile_id: "p-9" })), h.deps);
    expect(h.entitlements.get("sub_1")?.profile).toBe("p-9");
    const none = harness();
    none.stripeNow({ profileId: null });
    expect((await handleStripeEvent(signed("evt_n", "customer.subscription.created", subscriptionObject("active", "2026-12-23T09:15:00Z", {})), none.deps)).result).toBe("ignored: no profile_id");
  });

  it("a subscription that cannot be read leaves the event unprocessed (500), so Stripe delivers it again", async () => {
    const h = harness();
    const failing: WebhookDeps = { ...h.deps, payments: { ...h.deps.payments, retrieveSubscription: () => Promise.reject(new Error("stripe down")) } };
    const event = signed("evt_down", "customer.subscription.updated", subscriptionObject());
    expect((await handleStripeEvent(event, failing)).status).toBe(500);
    expect(h.entitlements.size).toBe(0);
    expect(await handleStripeEvent(event, h.deps)).toEqual({ status: 200, result: "pro active" });
  });
});

describe("refunds and other events", () => {
  it("charge.refunded reports every refund without a kind and with the sum so far; record_refund decides what it means", async () => {
    const h = harness();
    // Whether the console recorded its refund before this event or will do so after it, the webhook
    // never claims a kind: "goodwill" neither overwrites the console's kind nor blocks it.
    await handleStripeEvent(signed("evt_r1", "charge.refunded", { id: "ch_1", object: "charge", payment_intent: "pi_console", amount_refunded: 2499 }), h.deps);
    await handleStripeEvent(signed("evt_r2", "charge.refunded", { id: "ch_2", object: "charge", payment_intent: "pi_dashboard", amount_refunded: 500 }), h.deps);
    expect(h.log).toEqual(["refund pi_console goodwill 2499", "refund pi_dashboard goodwill 500"]);
    expect("refundKind" in h.deps.store).toBe(false);
  });

  it("a charge.refunded without a payment intent is ignored", async () => {
    const h = harness();
    expect(await handleStripeEvent(signed("evt_r3", "charge.refunded", { id: "ch_3", object: "charge", amount_refunded: 100 }), h.deps)).toEqual({ status: 200, result: "ignored: no payment intent" });
    expect(h.log).toEqual([]);
  });

  it("acknowledges events it does not handle", async () => {
    const h = harness();
    expect(await handleStripeEvent(signed("evt_x", "payment_intent.created", { id: "pi_1" }), h.deps)).toEqual({ status: 200, result: "ignored" });
  });
});
