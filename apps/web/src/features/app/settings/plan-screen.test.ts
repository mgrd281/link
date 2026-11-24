import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({ push: () => undefined }), usePathname: () => "/" }));

import { FREE_PLAN, INVOICES_SHOWN, planFrom, type EntitlementRow, type InvoiceRow, type RewardRow, type SubscriptionRow } from "./plan-screen";

/**
 * The Plan pane reads the owner's own rows and says which plan the database grants: the same order
 * of checks as public.has_pro() (20261123100400_review_fixes.sql), so the pane never claims Pro the
 * AI quota would not give, or the other way round.
 */

const NOW = new Date("2026-11-24T12:00:00Z");
const LATER = "2026-12-24T12:00:00Z";
const EARLIER = "2026-10-24T12:00:00Z";

const entitlement = (patch: Partial<EntitlementRow> = {}): EntitlementRow => ({
  source: "stripe",
  status: "active",
  current_period_end: LATER,
  cancel_at_period_end: false,
  cancel_at: null,
  stripe_customer_id: "cus_1",
  created_at: "2026-11-01T00:00:00Z",
  ...patch,
});
const invoice = (id: string, at: string): InvoiceRow => ({ id, at, amount_cents: 800, status: "paid" });
const rows = (patch: { entitlements?: EntitlementRow[]; rewards?: RewardRow[]; subscription?: SubscriptionRow | null; invoices?: InvoiceRow[] } = {}) => ({
  entitlements: [],
  rewards: [],
  subscription: null,
  invoices: [],
  ...patch,
});

describe("the plan from the owner's rows", () => {
  it("is Free without any rows, with no customer and no dates", () => {
    expect(planFrom(rows(), NOW)).toEqual(FREE_PLAN);
  });

  it("is Pro through Stripe while the subscription runs, renewing at the period end", () => {
    expect(planFrom(rows({ entitlements: [entitlement()] }), NOW)).toMatchObject({ plan: "pro", source: "stripe", renewsAt: LATER, endsAt: null, pastDue: false, customer: true });
  });

  it("says when a canceled subscription ends (at the period end, or on the later day chosen) and that it does not renew", () => {
    expect(planFrom(rows({ entitlements: [entitlement({ cancel_at_period_end: true })] }), NOW)).toMatchObject({ source: "stripe", renewsAt: null, endsAt: LATER });
    const day = "2027-02-28T12:00:00Z";
    expect(planFrom(rows({ entitlements: [entitlement({ cancel_at: day })] }), NOW)).toMatchObject({ renewsAt: null, endsAt: day });
  });

  it("keeps Pro while a payment is due, and says so", () => {
    expect(planFrom(rows({ entitlements: [entitlement({ status: "past_due" })] }), NOW)).toMatchObject({ plan: "pro", source: "stripe", pastDue: true });
  });

  it("is Free once the period is over or the subscription ended, but keeps the portal (Stripe knows the account)", () => {
    for (const ended of [entitlement({ current_period_end: EARLIER }), entitlement({ status: "canceled" }), entitlement({ status: "refunded" })]) {
      expect(planFrom(rows({ entitlements: [ended] }), NOW)).toMatchObject({ plan: "free", source: "free", customer: true });
    }
  });

  it("has no portal without a Stripe customer", () => {
    expect(planFrom(rows({ entitlements: [entitlement({ source: "team", stripe_customer_id: null, current_period_end: null })] }), NOW)).toMatchObject({ plan: "pro", source: "team", customer: false });
  });

  it("is Pro from the team (an entitlement without an end, or with one still ahead)", () => {
    expect(planFrom(rows({ entitlements: [entitlement({ source: "team", stripe_customer_id: null, current_period_end: null })] }), NOW)).toMatchObject({ source: "team", endsAt: null, renewsAt: null });
    expect(planFrom(rows({ entitlements: [entitlement({ source: "team", stripe_customer_id: null })] }), NOW)).toMatchObject({ source: "team", endsAt: LATER });
  });

  it("is Pro for life from the invite program until the team takes it back", () => {
    expect(planFrom(rows({ rewards: [{ kind: "pro_for_life", revoked_at: null }] }), NOW)).toMatchObject({ plan: "pro", source: "reward" });
    expect(planFrom(rows({ rewards: [{ kind: "pro_for_life", revoked_at: EARLIER }] }), NOW).plan).toBe("free");
    expect(planFrom(rows({ rewards: [{ kind: "verification_review", revoked_at: null }] }), NOW).plan).toBe("free");
  });

  it("counts the team's Pro in subscriptions only while no Stripe subscription runs (has_pro, review fixes)", () => {
    const team: SubscriptionRow = { plan: "pro", status: "active", trial_ends_at: null };
    expect(planFrom(rows({ subscription: team }), NOW)).toMatchObject({ plan: "pro", source: "team" });
    // A Stripe subscription past its period but still marked active: its mirror row grants nothing.
    expect(planFrom(rows({ subscription: team, entitlements: [entitlement({ current_period_end: EARLIER })] }), NOW).plan).toBe("free");
    // Once that subscription has ended, the team's Pro counts again.
    expect(planFrom(rows({ subscription: team, entitlements: [entitlement({ status: "canceled" })] }), NOW)).toMatchObject({ plan: "pro", source: "team", customer: true });
  });

  it("shows a team trial with its end while that end is ahead", () => {
    expect(planFrom(rows({ subscription: { plan: "pro", status: "trialing", trial_ends_at: LATER } }), NOW)).toMatchObject({ source: "team", trial: true, endsAt: LATER });
    expect(planFrom(rows({ subscription: { plan: "pro", status: "trialing", trial_ends_at: EARLIER } }), NOW)).toMatchObject({ source: "team", trial: true, endsAt: null });
    expect(planFrom(rows({ subscription: { plan: "pro", status: "canceled", trial_ends_at: null } }), NOW).plan).toBe("free");
  });

  it("prefers the Stripe subscription (the one with billing) over a team grant", () => {
    const view = planFrom(rows({ entitlements: [entitlement({ source: "team", stripe_customer_id: null, current_period_end: null }), entitlement()], rewards: [{ kind: "pro_for_life", revoked_at: null }] }), NOW);
    expect(view.source).toBe("stripe");
  });

  it("lists at most the newest invoices, in the order they came", () => {
    // Newest first, as the read orders them.
    const list = ["a", "b", "c", "d", "e"].map((id, index) => invoice(id, `2026-0${String(9 - index)}-01T00:00:00Z`));
    expect(planFrom(rows({ invoices: list }), NOW).invoices.map((entry) => entry.id)).toEqual(["a", "b", "c"].slice(0, INVOICES_SHOWN));
  });
});
