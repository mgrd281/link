import { describe, expect, it } from "vitest";

import { emailTranslator } from "@/features/email/templates/render";
import type { EmailMessage } from "@/features/email/types";
import de from "@/messages/de.json";

import { periodEndContaining } from "../delivery";
import type { Payments, SubscriptionState } from "../types";

import {
  cancellationFormSchema,
  resolveCancellation,
  resolveWithdrawal,
  submitCancellation,
  submitWithdrawal,
  withdrawalFormSchema,
  type CancellationForm,
  type CancellationRecord,
  type ContractsDb,
  type ContractsDeps,
} from "./contracts";

const PERIOD_END = "2027-01-31T09:30:00.000Z";
const RECEIVED = "2026-11-22T13:32:00.000Z";

interface Calls {
  stripe: string[];
  confirmed: { id: string; decision: string; effective: string | null }[];
  receipts: string[];
  refunds: { paymentIntent: string; kind: string; amount: number | null }[];
  mails: EmailMessage[];
}

function setup(record: Partial<CancellationRecord> = {}, withdrawal: { matched?: boolean; suspect?: boolean; accountEmail?: string | null } = {}) {
  const calls: Calls = { stripe: [], confirmed: [], receipts: [], refunds: [], mails: [] };
  const state = (overrides: Partial<SubscriptionState> = {}): SubscriptionState => ({
    id: "sub_1",
    status: "active",
    periodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    customerId: "cus_1",
    profileId: "p-1",
    ...overrides,
  });
  const payments: Payments = {
    createServiceCheckout: () => Promise.reject(new Error("unused")),
    createProCheckout: () => Promise.reject(new Error("unused")),
    retrieveSubscription: (id) => {
      calls.stripe.push(`retrieve ${id}`);
      return Promise.resolve(state());
    },
    invoicePaymentIntent: () => Promise.resolve(null),
    refund: (input) => {
      calls.stripe.push(`refund ${input.paymentIntentId} ${String(input.amountCents ?? "full")}`);
      return Promise.resolve({ refundId: "re_1", status: "succeeded" });
    },
    cancelAtPeriodEnd: (id) => {
      calls.stripe.push(`cancelAtPeriodEnd ${id}`);
      return Promise.resolve(state({ cancelAtPeriodEnd: true }));
    },
    cancelAt: (id, at) => {
      calls.stripe.push(`cancelAt ${id} ${at.toISOString()}`);
      return Promise.resolve(state({ cancelAt: at.toISOString() }));
    },
    resume: (id) => {
      calls.stripe.push(`resume ${id}`);
      return Promise.resolve(state());
    },
    cancelNow: (id) => {
      calls.stripe.push(`cancelNow ${id}`);
      return Promise.resolve(state({ status: "canceled" }));
    },
    verifyWebhook: () => {
      throw new Error("unused");
    },
  };
  const db: ContractsDb = {
    recordWithdrawal: () =>
      Promise.resolve({ id: "w-1", receivedAt: RECEIVED, matched: withdrawal.matched ?? false, suspect: withdrawal.suspect ?? false, accountEmail: withdrawal.accountEmail ?? null }),
    recordCancellation: () =>
      Promise.resolve({
        id: "c-1",
        receivedAt: RECEIVED,
        matched: true,
        suspect: false,
        subscription: "sub_1",
        entitlementId: "e-1",
        periodEnd: PERIOD_END,
        accountEmail: "account@example.com",
        ...record,
      }),
    confirmCancellation: (id, decision, effective) => {
      calls.confirmed.push({ id, decision, effective: effective?.toISOString() ?? null });
      return Promise.resolve();
    },
    markReceiptSent: (kind, id) => {
      calls.receipts.push(`${kind} ${id}`);
      return Promise.resolve();
    },
    recordRefund: (paymentIntent, kind, amount) => {
      calls.refunds.push({ paymentIntent, kind, amount });
      return Promise.resolve("ok");
    },
    updateProSubscription: (subscription, next) => {
      calls.stripe.push(`entitlement ${subscription} ${next}`);
      return Promise.resolve();
    },
  };
  const deps: ContractsDeps = {
    db,
    payments: () => payments,
    send: (message) => {
      calls.mails.push(message);
      return Promise.resolve({ id: "m" });
    },
    translator: () => Promise.resolve(emailTranslator("de", de)),
    log: () => undefined,
  };
  return { calls, deps };
}

const form = (overrides: Partial<CancellationForm> = {}): CancellationForm =>
  cancellationFormSchema.parse({
    kind: "ordinary",
    name: "Ben",
    accountEmail: "account@example.com",
    contract: "pro-monthly",
    confirmationEmail: "typed@example.com",
    locale: "de",
    ...overrides,
  });

describe("cancellation: kind × date", () => {
  it("ordinary without a date ends at the period end", async () => {
    const { calls, deps } = setup();
    expect(await submitCancellation(form(), "ip", deps)).toEqual({ receivedAt: RECEIVED, mailed: true });
    expect(calls.stripe).toEqual(["cancelAtPeriodEnd sub_1"]);
    expect(calls.confirmed).toEqual([{ id: "c-1", decision: "scheduled", effective: PERIOD_END }]);
  });

  it("ordinary with a date before the period end ends at the period end", async () => {
    const { calls, deps } = setup();
    await submitCancellation(form({ wantedDate: "2027-01-15" }), "ip", deps);
    expect(calls.stripe).toEqual(["cancelAtPeriodEnd sub_1"]);
    expect(calls.confirmed[0]?.effective).toBe(PERIOD_END);
  });

  it("ordinary with a date two months later ends at the end of that billing period", async () => {
    const { calls, deps } = setup();
    await submitCancellation(form({ wantedDate: "2027-03-20" }), "ip", deps);
    const end = periodEndContaining(new Date(PERIOD_END), "2027-03-20").toISOString();
    expect(end).toBe("2027-03-31T09:30:00.000Z");
    expect(calls.stripe).toEqual([`cancelAt sub_1 ${end}`]);
    expect(calls.confirmed).toEqual([{ id: "c-1", decision: "scheduled", effective: end }]);
    const confirmation = calls.mails.find((mail) => mail.tag === "cancellation-confirmation");
    expect(confirmation?.text).toContain("Linkyo Pro endet am Mittwoch, 31. März 2027.");
  });

  it("extraordinary: no Stripe call and no decision (the team reviews it)", async () => {
    const { calls, deps } = setup();
    await submitCancellation(form({ kind: "extraordinary", reason: "Der Dienst war zwei Wochen nicht erreichbar." }), "ip", deps);
    expect(calls.stripe).toEqual([]);
    expect(calls.confirmed).toEqual([]);
    expect(calls.mails.find((mail) => mail.tag === "cancellation-confirmation")?.text).toContain("Wir prüfen sie");
  });

  it("unmatched: no Stripe call, the neutral receipt only", async () => {
    const { calls, deps } = setup({ matched: false, subscription: null, entitlementId: null, periodEnd: null, accountEmail: null });
    expect(await submitCancellation(form(), "ip", deps)).toEqual({ receivedAt: RECEIVED, mailed: true });
    expect(calls.stripe).toEqual([]);
    expect(calls.mails.map((mail) => [mail.tag, mail.to])).toEqual([["cancellation-receipt", "typed@example.com"]]);
  });

  it("suspect: no Stripe call and no e-mail, still stored and answered", async () => {
    const { calls, deps } = setup({ suspect: true });
    expect(await submitCancellation(form(), "ip", deps)).toEqual({ receivedAt: RECEIVED, mailed: false });
    expect(calls.stripe).toEqual([]);
    expect(calls.mails).toEqual([]);
    expect(calls.receipts).toEqual([]);
  });

  it("the typed address gets the same neutral receipt, matched or not; the account address the end date", async () => {
    const matched = setup();
    await submitCancellation(form(), "ip", matched.deps);
    const unmatched = setup({ matched: false, subscription: null, entitlementId: null, periodEnd: null, accountEmail: null });
    await submitCancellation(form(), "ip", unmatched.deps);
    const receipt = (calls: Calls) => calls.mails.find((mail) => mail.tag === "cancellation-receipt");
    expect(receipt(matched.calls)?.to).toBe("typed@example.com");
    expect(receipt(matched.calls)?.text).toBe(receipt(unmatched.calls)?.text);
    expect(receipt(matched.calls)?.html).toBe(receipt(unmatched.calls)?.html);
    const confirmation = matched.calls.mails.filter((mail) => mail.tag === "cancellation-confirmation");
    expect(confirmation.map((mail) => mail.to)).toEqual(["account@example.com"]);
    expect(confirmation[0]?.text).toContain("Linkyo Pro endet am Sonntag, 31. Januar 2027.");
    expect(receipt(matched.calls)?.text).not.toContain("31. Januar 2027");
    expect(matched.calls.receipts).toEqual(["cancellation c-1"]);
  });

  it("one e-mail when the confirmation address is the account's own", async () => {
    const { calls, deps } = setup();
    await submitCancellation(form({ confirmationEmail: "Account@Example.com" }), "ip", deps);
    expect(calls.mails).toHaveLength(1);
    expect(calls.mails[0]?.tag).toBe("cancellation-confirmation");
    expect(calls.mails[0]?.text).toContain("Wir haben deine Kündigung erhalten am 22.11.2026 um 14:32 Uhr.");
    expect(calls.mails[0]?.text).toContain("Linkyo Pro endet am Sonntag, 31. Januar 2027.");
  });

  it("a Stripe failure never refuses the declaration (stored, receipt sent, no end date promised)", async () => {
    const { calls, deps } = setup();
    deps.payments = () => {
      throw new Error("stripe down");
    };
    expect(await submitCancellation(form(), "ip", deps)).toEqual({ receivedAt: RECEIVED, mailed: true });
    expect(calls.confirmed).toEqual([]);
    expect(calls.mails.find((mail) => mail.tag === "cancellation-confirmation")?.text).toContain("Wir prüfen sie");
  });
});

describe("cancellation form", () => {
  it("needs a reason only for an extraordinary cancellation", () => {
    expect(cancellationFormSchema.safeParse({ kind: "extraordinary", name: "B", accountEmail: "a@b.de", contract: "pro-monthly", confirmationEmail: "a@b.de", locale: "de" }).success).toBe(false);
    expect(cancellationFormSchema.safeParse({ kind: "ordinary", name: "B", accountEmail: "a@b.de", contract: "pro-monthly", confirmationEmail: "a@b.de", locale: "de", wantedDate: null }).success).toBe(true);
    expect(cancellationFormSchema.safeParse({ kind: "ordinary", name: "B", accountEmail: "a@b.de", contract: "other", confirmationEmail: "a@b.de", locale: "de" }).success).toBe(false);
  });
});

describe("withdrawal", () => {
  const typed = withdrawalFormSchema.parse({ name: "Mila", email: "typed@example.com", contract: "LNK-2026-000123", locale: "de" });

  it("sends the receipt to the typed address and, when matched elsewhere, to the account's address", async () => {
    const { calls, deps } = setup({}, { matched: true, accountEmail: "account@example.com" });
    expect(await submitWithdrawal(typed, "ip", deps)).toEqual({ receivedAt: RECEIVED, mailed: true });
    expect(calls.mails.map((mail) => [mail.tag, mail.to])).toEqual([
      ["withdrawal-receipt", "typed@example.com"],
      ["withdrawal-receipt", "account@example.com"],
    ]);
    expect(calls.receipts).toEqual(["withdrawal w-1"]);
  });

  it("holds the e-mail of a suspect declaration, and never refuses it", async () => {
    const { calls, deps } = setup({}, { suspect: true });
    expect(await submitWithdrawal(typed, "ip", deps)).toEqual({ receivedAt: RECEIVED, mailed: false });
    expect(calls.mails).toEqual([]);
    expect(calls.receipts).toEqual([]);
  });
});

describe("team decisions", () => {
  it("an accepted order withdrawal refunds the set amount and records it as a withdrawal", async () => {
    const { calls, deps } = setup();
    expect(await resolveWithdrawal({ kind: "order", paymentIntent: "pi_1", refundCents: 1800 }, deps)).toEqual({ refunded: true });
    expect(calls.stripe).toEqual(["refund pi_1 1800"]);
    expect(calls.refunds).toEqual([{ paymentIntent: "pi_1", kind: "withdrawal", amount: 1800 }]);
  });

  it("an accepted Pro withdrawal ends now, refunds the latest invoice and marks the entitlement refunded", async () => {
    const { calls, deps } = setup();
    await resolveWithdrawal({ kind: "pro", subscription: "sub_1", paymentIntent: "pi_inv" }, deps);
    expect(calls.stripe).toEqual(["cancelNow sub_1", "refund pi_inv full", "entitlement sub_1 refunded"]);
    expect(calls.refunds).toEqual([{ paymentIntent: "pi_inv", kind: "withdrawal", amount: null }]);
  });

  it("ends, resumes or rejects a cancellation", async () => {
    const { calls, deps } = setup();
    const now = new Date("2026-11-25T10:00:00Z");
    expect((await resolveCancellation("endNow", { id: "c-1", subscription: "sub_1" }, { ...deps, now: () => now })).endsAt).toEqual(now);
    await resolveCancellation("resume", { id: "c-2", subscription: "sub_1" }, deps);
    await resolveCancellation("rejectCancellation", { id: "c-3", subscription: "sub_1" }, deps);
    expect(calls.stripe).toEqual(["cancelNow sub_1", "resume sub_1"]);
    expect(calls.confirmed).toEqual([
      { id: "c-1", decision: "ended", effective: now.toISOString() },
      { id: "c-2", decision: "resumed", effective: null },
      { id: "c-3", decision: "rejected", effective: null },
    ]);
  });
});
