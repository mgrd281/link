import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handle, requests } from "../../../../e2e/mocks/stripe.handler.mjs";
import { PaymentsNotConfigured, WebhookSignatureError } from "../types";

import { StripePayments, stripeSettingsFromEnv } from "./stripe-payments";

/**
 * stripe-node against the local Stripe mock (e2e/mocks/stripe.handler.mjs) on an ephemeral loopback
 * port: what we send is checked on the wire, and what we read comes in the current API shapes.
 */

let server: Server;
let payments: StripePayments;
const SECRET = "whsec_unit_test";

interface Recorded {
  method: string;
  path: string;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
}
const recorded = () => requests as Recorded[];
const last = (method: string, path: string) => recorded().filter((entry) => entry.method === method && entry.path === path).at(-1);

beforeAll(async () => {
  server = createServer((req, res) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  payments = new StripePayments(
    stripeSettingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_unit", STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_API_HOST: "127.0.0.1", STRIPE_API_PORT: String(port), STRIPE_API_PROTOCOL: "http" }),
  );
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  requests.length = 0;
});

async function register(kind: "subscriptions" | "invoices", id: string, data: Record<string, unknown>) {
  const { port } = server.address() as AddressInfo;
  await fetch(`http://127.0.0.1:${String(port)}/__${kind}/${id}`, { method: "POST", body: JSON.stringify(data) });
}

describe("settings", () => {
  it("needs a secret key", () => {
    expect(() => stripeSettingsFromEnv({})).toThrow(PaymentsNotConfigured);
  });

  it("accepts a custom API host only on loopback and never on Vercel", () => {
    expect(() => stripeSettingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_API_HOST: "api.example.com" })).toThrow(/loopback/);
    expect(() => stripeSettingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_API_HOST: "127.0.0.1", VERCEL: "1" })).toThrow(/local tests/);
    expect(stripeSettingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_API_HOST: "localhost", STRIPE_API_PORT: "1234" })).toMatchObject({ host: "localhost", port: 1234, protocol: "http" });
    expect(stripeSettingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_x" }).host).toBeUndefined();
  });
});

describe("checkout sessions", () => {
  it("creates the service session (payment, elements, invoice, no SEPA)", async () => {
    const session = await payments.createServiceCheckout({ profileId: "p-1", email: "mila@example.com", product: "service-start", locale: "de", returnUrl: "http://localhost/de/checkout/done" });
    expect(session.sessionId).toMatch(/^cs_test_/);
    expect(session.clientSecret).toContain("_secret_");
    const body = last("POST", "/v1/checkout/sessions")?.body as Record<string, unknown> & {
      line_items: { price_data: { unit_amount: string; product_data: { name: string } } }[];
      metadata: Record<string, string>;
      invoice_creation: { enabled: string };
      allowed_payment_method_types: string[];
    };
    expect(body.mode).toBe("payment");
    expect(body.ui_mode).toBe("elements");
    expect(body.invoice_creation.enabled).toBe("true");
    expect(body.metadata).toEqual({ profile_id: "p-1", product: "service-start", locale: "de" });
    expect(body.allowed_payment_method_types).toEqual(["card", "paypal"]);
    expect(body.allowed_payment_method_types).not.toContain("sepa_debit");
    expect(body).not.toHaveProperty("payment_method_types");
    expect(body.line_items[0]?.price_data.unit_amount).toBe("2499");
    expect(body.line_items[0]?.price_data.product_data.name).toBe("Linkyo Seitenservice Start");
    expect(body.customer_email).toBe("mila@example.com");
  });

  it("creates the Pro session (subscription, SEPA, monthly, metadata on the subscription)", async () => {
    await payments.createProCheckout({ profileId: "p-2", email: "ben@example.com", locale: "de", returnUrl: "http://localhost/de/checkout/done" });
    const body = last("POST", "/v1/checkout/sessions")?.body as Record<string, unknown> & {
      line_items: { price_data: { unit_amount: string; recurring: { interval: string } } }[];
      subscription_data: { metadata: Record<string, string> };
      allowed_payment_method_types: string[];
    };
    expect(body.mode).toBe("subscription");
    expect(body.ui_mode).toBe("elements");
    expect(body.allowed_payment_method_types).toContain("sepa_debit");
    expect(body.line_items[0]?.price_data.recurring.interval).toBe("month");
    expect(body.line_items[0]?.price_data.unit_amount).toBe("800");
    expect(body.subscription_data.metadata.profile_id).toBe("p-2");
    expect(body).not.toHaveProperty("subscription_data.trial_period_days");
    expect(body).not.toHaveProperty("invoice_creation");
  });
});

describe("subscriptions", () => {
  const periodEnd = Math.floor(Date.UTC(2027, 0, 31, 9, 30) / 1000);
  const anchor = Math.floor(Date.UTC(2026, 9, 31, 9, 30) / 1000);

  beforeEach(async () => {
    await register("subscriptions", "sub_unit", { current_period_end: periodEnd, billing_cycle_anchor: anchor, customer: "cus_unit", metadata: { profile_id: "p-3" } });
  });

  it("reads the period end from the first item (the mock sends none on the subscription), and the billing cycle anchor", async () => {
    const state = await payments.retrieveSubscription("sub_unit");
    expect(state).toEqual({
      id: "sub_unit",
      status: "active",
      stripeStatus: "active",
      periodEnd: new Date(periodEnd * 1000).toISOString(),
      billingAnchor: new Date(anchor * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      cancelAt: null,
      customerId: "cus_unit",
      profileId: "p-3",
    });
  });

  it("keeps Stripe's own status word beside the folded one", async () => {
    await register("subscriptions", "sub_unpaid", { status: "unpaid" });
    expect(await payments.retrieveSubscription("sub_unpaid")).toMatchObject({ status: "other", stripeStatus: "unpaid" });
  });

  it("cancels at the period end, at a later date (no proration), resumes and cancels now", async () => {
    expect((await payments.cancelAtPeriodEnd("sub_unit")).cancelAtPeriodEnd).toBe(true);
    expect(last("POST", "/v1/subscriptions/sub_unit")?.body).toEqual({ cancel_at_period_end: "true" });

    const resumed = await payments.resume("sub_unit");
    expect(resumed).toMatchObject({ cancelAtPeriodEnd: false, cancelAt: null });
    expect(last("POST", "/v1/subscriptions/sub_unit")?.body).toEqual({ cancel_at_period_end: "false", cancel_at: "" });

    const at = new Date(Date.UTC(2027, 2, 31, 9, 30));
    const later = await payments.cancelAt("sub_unit", at);
    expect(later.cancelAt).toBe(at.toISOString());
    expect(last("POST", "/v1/subscriptions/sub_unit")?.body).toEqual({ cancel_at: String(at.getTime() / 1000), proration_behavior: "none" });

    const ended = await payments.cancelNow("sub_unit");
    expect(ended.status).toBe("canceled");
    const deleted = last("DELETE", "/v1/subscriptions/sub_unit");
    expect(deleted?.query).toEqual({ prorate: "false", invoice_now: "false" });
  });
});

describe("invoices and refunds", () => {
  it("reads an invoice's payment intent from its payments", async () => {
    await register("invoices", "in_unit", { subscription: "sub_unit", profileId: "p-3", paymentIntent: "pi_from_payments", amount: 800 });
    expect(await payments.invoicePaymentIntent("in_unit")).toBe("pi_from_payments");
    expect(last("GET", "/v1/invoices/in_unit")?.query).toEqual({ expand: ["payments"] });
  });

  it("refunds a payment intent in full or in part", async () => {
    expect(await payments.refund({ paymentIntentId: "pi_1" })).toMatchObject({ status: "succeeded" });
    expect(last("POST", "/v1/refunds")?.body).toEqual({ payment_intent: "pi_1" });
    await payments.refund({ paymentIntentId: "pi_2", amountCents: 1500 });
    expect(last("POST", "/v1/refunds")?.body).toEqual({ payment_intent: "pi_2", amount: "1500" });
  });
});

describe("webhook signatures", () => {
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "invoice.paid", data: { object: { id: "in_1", object: "invoice" } } });

  it("accepts an event signed with the endpoint secret", () => {
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect(payments.verifyWebhook(payload, signature)).toEqual({ id: "evt_1", type: "invoice.paid", data: { object: { id: "in_1", object: "invoice" } } });
  });

  it("refuses a wrong secret, a changed body and a missing header", () => {
    const wrong = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" });
    expect(() => payments.verifyWebhook(payload, wrong)).toThrow(WebhookSignatureError);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect(() => payments.verifyWebhook(payload.replace("in_1", "in_2"), signature)).toThrow(WebhookSignatureError);
    expect(() => payments.verifyWebhook(payload, null)).toThrow(WebhookSignatureError);
  });
});

describe("the mock speaks the current API", () => {
  it("has no period dates on a subscription and names an invoice's subscription under parent", async () => {
    const { port } = server.address() as AddressInfo;
    await register("invoices", "in_shape", { subscription: "sub_shape", profileId: "p-9" });
    const subscription = (await (await fetch(`http://127.0.0.1:${String(port)}/v1/subscriptions/sub_shape`)).json()) as Record<string, unknown>;
    expect(subscription).not.toHaveProperty("current_period_end");
    expect(subscription).toHaveProperty("items.data.0.current_period_end");
    const invoice = (await (await fetch(`http://127.0.0.1:${String(port)}/v1/invoices/in_shape`)).json()) as Record<string, unknown>;
    expect(invoice).toHaveProperty("parent.subscription_details.subscription", "sub_shape");
    expect(invoice).toHaveProperty("parent.subscription_details.metadata.profile_id", "p-9");
    expect(invoice).not.toHaveProperty("subscription");
    expect(invoice).not.toHaveProperty("payment_intent");
    expect(invoice).not.toHaveProperty("payments");
  });
});
