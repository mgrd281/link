import { describe, expect, it, vi } from "vitest";

import {
  billingActions,
  changeSubscription,
  invoiceRefundKey,
  missingFunction,
  NotRecorded,
  readAnswer,
  refundInvoice,
  refusal,
  scheduledEnd,
  sendBilling,
  type BillingContext,
} from "./billing";
import type { Customer } from "./customers/model";

const base: Customer = {
  id: "c0000000-0000-4000-8000-000000000001",
  source: "live",
  name: "Mila Berg",
  email: "mila@example.com",
  username: "mila",
  locale: "de",
  country: "DE",
  createdAt: "2026-09-01T10:00:00.000Z",
  lastSeenAt: "2026-11-20T10:00:00.000Z",
  status: "active",
  verified: false,
  subscription: { plan: "free", status: null, invoices: [] },
  usage: { kind: "musician", template: "nocturne", blocks: 4, onboarded: true, views30: 0, clicks30: 0 },
  logins: [],
  notes: [],
};
const paid = { id: "in_1", at: "2026-10-01T10:00:00.000Z", amount: 800, status: "paid" as const };
const stripe: Customer = { ...base, subscription: { plan: "pro", status: "active", source: "stripe", renewsAt: "2026-12-01T10:00:00.000Z", invoices: [paid] } };
const team: Customer = { ...base, subscription: { plan: "pro", status: "active", source: "team", invoices: [] } };
const live = (payments: boolean, manage = true): BillingContext => ({ live: true, payments, manage });
const noPause = () => Promise.resolve();

describe("what the console offers for money", () => {
  it("a Stripe subscription changes only through Stripe: no plan or trial by hand", () => {
    const actions = billingActions(stripe, live(true));
    expect(actions).toMatchObject({ manualPlan: false, trial: false, cancel: "stripe", resume: null, refund: "stripe", waitingForPayments: false });
  });

  it("once cancelled for the period end, it can be taken back (and not cancelled twice)", () => {
    const ending: Customer = { ...stripe, subscription: { ...stripe.subscription, cancelAtPeriodEnd: true, endsAt: "2026-12-01T10:00:00.000Z" } };
    expect(billingActions(ending, live(true))).toMatchObject({ cancel: null, resume: "stripe" });
    expect(scheduledEnd(ending)).toBe("2026-12-01T10:00:00.000Z");
    expect(scheduledEnd(stripe)).toBeNull();
  });

  it("with payments switched off, there is no Stripe action at all, and the console says why", () => {
    expect(billingActions(stripe, live(false))).toEqual({ manualPlan: false, trial: false, cancel: null, resume: null, refund: null, waitingForPayments: true });
  });

  it("Pro the team gave, and Free, change by hand (no money)", () => {
    expect(billingActions(team, live(false))).toMatchObject({ manualPlan: true, trial: true, cancel: "manual", resume: null, refund: null, waitingForPayments: false });
    expect(billingActions(base, live(false))).toMatchObject({ manualPlan: true, trial: true, cancel: null, resume: null });
    const ended: Customer = { ...team, subscription: { ...team.subscription, status: "canceled" } };
    expect(billingActions(ended, live(true))).toMatchObject({ resume: "manual", cancel: null });
  });

  it("without billing.manage nothing is offered; the demo keeps everything in this browser", () => {
    expect(billingActions(stripe, live(true, false))).toEqual({ manualPlan: false, trial: false, cancel: null, resume: null, refund: null, waitingForPayments: false });
    expect(billingActions(stripe, { live: false, payments: false, manage: true })).toMatchObject({ manualPlan: true, cancel: "demo", refund: "demo" });
  });
});

describe("the browser asks our server", () => {
  it("posts to the customer's billing route with the member's token", async () => {
    const send = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, mailed: true }) }));
    const answer = await sendBilling(base.id, "refund", { invoice: "in_1" }, { token: () => Promise.resolve("tok"), send });
    expect(answer).toEqual({ ok: true, mailed: true });
    expect(send).toHaveBeenCalledWith(`/api/admin/customers/${base.id}/billing/refund`, expect.objectContaining({ method: "POST", body: JSON.stringify({ invoice: "in_1" }) }));
    const init = (send.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("never reads a failure as success", async () => {
    expect(readAnswer(false, { ok: false, error: "paymentsOff" })).toEqual({ ok: false, error: "paymentsOff" });
    expect(readAnswer(true, { ok: false, error: "stripe" })).toEqual({ ok: false, error: "stripe" });
    expect(readAnswer(false, { ok: true })).toEqual({ ok: false, error: "server" });
    expect(readAnswer(true, null)).toEqual({ ok: false, error: "server" });
    expect(readAnswer(false, { error: "made-up" })).toEqual({ ok: false, error: "server" });
    expect(await sendBilling(base.id, "cancel", {}, { token: () => Promise.resolve(null), send: vi.fn() })).toEqual({ ok: false, error: "unauthorized" });
    expect(await sendBilling(base.id, "cancel", {}, { token: () => Promise.resolve("tok"), send: () => Promise.reject(new Error("offline")) })).toEqual({ ok: false, error: "network" });
  });
});

describe("the server's side", () => {
  it("maps a refusal of the team function to an HTTP answer", () => {
    expect(refusal({ message: "linkyo:forbidden" })).toEqual({ status: 403, error: "forbidden" });
    expect(refusal({ message: "linkyo:notFound" })).toEqual({ status: 404, error: "notFound" });
    expect(refusal({ message: "linkyo:locked" })).toEqual({ status: 409, error: "locked" });
    expect(refusal({ message: "linkyo:invalidAction" })).toEqual({ status: 400, error: "invalid" });
    expect(refusal({ code: "PGRST202", message: "Could not find the function public.admin_pro_refund_target" })).toEqual({ status: 409, error: "notAvailable" });
    expect(refusal({ code: "XX000", message: "boom" })).toEqual({ status: 500, error: "server" });
    expect(missingFunction({ code: "42883" })).toBe(true);
    expect(missingFunction({ code: "42501", message: "linkyo:forbidden" })).toBe(false);
  });

  it("refunds at Stripe once per invoice, then records it; a failed record is retried and reported", async () => {
    const refund = vi.fn(() => Promise.resolve({}));
    const record = vi.fn(() => Promise.resolve());
    await refundInvoice({ invoice: "in_1", paymentIntent: "pi_1", amountCents: 800 }, { refund, record, pause: noPause });
    expect(refund).toHaveBeenCalledWith({ paymentIntentId: "pi_1", amountCents: 800, key: invoiceRefundKey("in_1") });
    expect(record).toHaveBeenCalledWith("pi_1", 800);

    const flaky = vi.fn().mockRejectedValueOnce(new Error("db")).mockResolvedValue(undefined);
    await refundInvoice({ invoice: "in_1", paymentIntent: "pi_1", amountCents: 800 }, { refund, record: flaky, pause: noPause });
    expect(flaky).toHaveBeenCalledTimes(2);

    const broken = vi.fn(() => Promise.reject(new Error("db down")));
    await expect(refundInvoice({ invoice: "in_1", paymentIntent: "pi_1", amountCents: 800 }, { refund, record: broken, pause: noPause })).rejects.toBeInstanceOf(NotRecorded);
    expect(broken).toHaveBeenCalledTimes(3);
  });

  it("a refused refund is never recorded", async () => {
    const record = vi.fn(() => Promise.resolve());
    const refund = vi.fn(() => Promise.reject(new Error("card_declined")));
    await expect(refundInvoice({ invoice: "in_1", paymentIntent: "pi_1", amountCents: 800 }, { refund, record })).rejects.toThrow("card_declined");
    expect(record).not.toHaveBeenCalled();
  });

  it("cancels at the period end and records what Stripe answered", async () => {
    const state = { status: "active", periodEnd: "2026-12-01T10:00:00.000Z", cancelAtPeriodEnd: true, cancelAt: null, customerId: "cus_1" };
    const record = vi.fn(() => Promise.resolve());
    const cancelAtPeriodEnd = vi.fn(() => Promise.resolve(state));
    const resume = vi.fn(() => Promise.resolve({ ...state, cancelAtPeriodEnd: false }));
    const result = await changeSubscription("cancel", { subscription: "sub_1", stripeCustomer: "cus_1" }, { cancelAtPeriodEnd, resume, record, pause: noPause });
    expect(result).toEqual({ endsAt: "2026-12-01T10:00:00.000Z" });
    expect(resume).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith({ subscription: "sub_1", customer: "cus_1", next: "active", periodEnd: state.periodEnd, cancelAtEnd: true, cancelAt: null });

    expect(await changeSubscription("resume", { subscription: "sub_1", stripeCustomer: null }, { cancelAtPeriodEnd, resume, record })).toEqual({ endsAt: null });
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({ cancelAtEnd: false }));
  });

  it("does not record a state it does not understand", async () => {
    const record = vi.fn(() => Promise.resolve());
    const odd = { status: "incomplete", periodEnd: "2026-12-01T10:00:00.000Z", cancelAtPeriodEnd: true, cancelAt: null, customerId: "cus_1" };
    await expect(
      changeSubscription("cancel", { subscription: "sub_1", stripeCustomer: null }, { cancelAtPeriodEnd: () => Promise.resolve(odd), resume: () => Promise.resolve(odd), record }),
    ).rejects.toBeInstanceOf(NotRecorded);
    expect(record).not.toHaveBeenCalled();
  });
});
