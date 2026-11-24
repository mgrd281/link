import { describe, expect, it } from "vitest";

import { DAY, PLAN_PRICE, type Customer, type Invoice } from "./model";
import { sampleCustomers } from "./sample";
import { mrrAt } from "./stats";
import { churnBetween, customersAt, kpiTrends, monthToDate, payingAt, revenueBetween, revenueThisMonth, samples, signupsBetween, type OrderMoney } from "./trends";

const NOW = Date.UTC(2026, 10, 19, 12);
const iso = (time: number) => new Date(time).toISOString();

let serial = 0;
/** A customer as the console sees one; a paid plan has its invoices (only Stripe writes them). */
function customer(overrides: { createdAt?: number; plan?: "free" | "pro"; status?: Customer["subscription"]["status"]; startedAt?: number; canceledAt?: number; invoices?: Invoice[] } = {}): Customer {
  serial += 1;
  const plan = overrides.plan ?? "free";
  return {
    id: `cus_${String(serial)}`,
    source: "sample",
    name: `Customer ${String(serial)}`,
    email: `c${String(serial)}@example.com`,
    username: `c${String(serial)}`,
    locale: "de",
    country: "DE",
    createdAt: iso(overrides.createdAt ?? NOW - 100 * DAY),
    lastSeenAt: iso(NOW),
    status: "active",
    verified: false,
    subscription: {
      plan,
      status: overrides.status ?? (plan === "pro" ? "active" : null),
      ...(overrides.startedAt ? { startedAt: iso(overrides.startedAt) } : {}),
      ...(overrides.canceledAt ? { canceledAt: iso(overrides.canceledAt) } : {}),
      invoices: overrides.invoices ?? (plan === "pro" ? [{ id: `in_${String(serial)}`, at: iso(overrides.startedAt ?? NOW - 90 * DAY), amount: PLAN_PRICE.pro, status: "paid" }] : []),
    },
    usage: { kind: "musician", template: "nocturne", blocks: 4, onboarded: true, views30: 0, clicks30: 0 },
    logins: [],
    notes: [],
  };
}

const invoice = (at: number, status: Invoice["status"] = "paid", amount = PLAN_PRICE.pro): Invoice => ({ id: `in_${String((serial += 1))}`, at: iso(at), amount, status });

describe("samples", () => {
  it("spreads points over the range, oldest first, now last", () => {
    const points = samples(NOW, 30, 4);
    expect(points).toEqual([NOW - 30 * DAY, NOW - 20 * DAY, NOW - 10 * DAY, NOW]);
  });
});

describe("kpiTrends", () => {
  it("compares now with one range earlier, from the records alone", () => {
    const customers = [
      customer({ createdAt: NOW - 100 * DAY }),
      customer({ createdAt: NOW - 45 * DAY }),
      customer({ createdAt: NOW - 10 * DAY }),
      customer({ createdAt: NOW - 2 * DAY }),
      // Paying since 60 days, and one that started paying 5 days ago.
      customer({ createdAt: NOW - 80 * DAY, plan: "pro", startedAt: NOW - 60 * DAY }),
      customer({ createdAt: NOW - 20 * DAY, plan: "pro", startedAt: NOW - 5 * DAY }),
    ];
    const trends = kpiTrends(customers, NOW, 30);
    expect(trends.customers).toMatchObject({ value: 6, previous: 3, change: 3 });
    expect(trends.newCustomers).toMatchObject({ value: 3, previous: 1, change: 2 });
    expect(trends.paying).toMatchObject({ value: 2, previous: 1, change: 1 });
    expect(trends.mrr).toMatchObject({ value: 2 * PLAN_PRICE.pro, previous: PLAN_PRICE.pro });
    expect(trends.conversion.value).toBeCloseTo(2 / 6);
    expect(trends.conversion.previous).toBeCloseTo(1 / 3);
    // The sparkline ends where the tile is, and the sign-up slices add up to the range.
    expect(trends.customers.series.at(-1)).toBe(6);
    expect(trends.mrr.series.at(-1)).toBe(trends.mrr.value);
    expect(trends.newCustomers.series.reduce((sum, value) => sum + value, 0)).toBe(3);
  });

  it("agrees with the MRR tile and chart on the sample customers", () => {
    const customers = sampleCustomers(NOW);
    const trends = kpiTrends(customers, NOW, 30);
    expect(trends.mrr.value).toBe(mrrAt(customers, NOW));
    expect(trends.mrr.previous).toBe(mrrAt(customers, NOW - 30 * DAY));
    expect(trends.customers.value).toBe(customersAt(customers, NOW));
    expect(trends.paying.value).toBe(payingAt(customers, NOW));
    expect(trends.newCustomers.value).toBe(signupsBetween(customers, NOW - 30 * DAY, NOW));
  });

  it("counts churn only from the customers who paid when the range began", () => {
    const customers = [
      customer({ plan: "pro", startedAt: NOW - 90 * DAY }),
      customer({ plan: "pro", status: "canceled", startedAt: NOW - 90 * DAY, canceledAt: NOW - 3 * DAY }),
      // Started and ended inside the range: never part of the base.
      customer({ plan: "pro", status: "canceled", startedAt: NOW - 20 * DAY, canceledAt: NOW - 10 * DAY }),
      // A trial and the team's Pro bring no money and are no base.
      customer({ plan: "pro", status: "trialing", startedAt: NOW - 90 * DAY, invoices: [] }),
    ];
    expect(churnBetween(customers, NOW - 30 * DAY, NOW)).toBeCloseTo(1 / 2);
    expect(churnBetween([], NOW - 30 * DAY, NOW)).toBe(0);
    expect(kpiTrends(customers, NOW, 30).churn.previous).toBe(0);
  });
});

describe("revenue this month (A-19)", () => {
  const window = monthToDate(NOW);

  it("is this month so far against the same stretch of last month", () => {
    expect(iso(window.from)).toBe("2026-11-01T00:00:00.000Z");
    expect(iso(window.previousFrom)).toBe("2026-10-01T00:00:00.000Z");
    expect(window.previousTo - window.previousFrom).toBe(NOW - window.from);
    // On the 31st, last month (30 days) is compared as a whole, never past its end.
    const late = monthToDate(Date.UTC(2026, 11, 31, 12));
    expect(iso(late.previousTo)).toBe("2026-12-01T00:00:00.000Z");
  });

  it("adds paid invoices and orders, net of refunds", () => {
    const customers = [
      customer({ plan: "pro", invoices: [invoice(NOW - 2 * DAY), invoice(NOW - 32 * DAY)] }),
      // Refunded and failed invoices brought nothing in.
      customer({ plan: "pro", invoices: [invoice(NOW - 3 * DAY, "refunded"), invoice(NOW - 4 * DAY, "failed")] }),
    ];
    const orders: OrderMoney[] = [
      { orderedAt: iso(NOW - 5 * DAY), amountCents: 2499, refundedAt: null, refundedCents: 0 },
      // Paid this month and refunded in full this month: nets out.
      { orderedAt: iso(NOW - 6 * DAY), amountCents: 7999, refundedAt: iso(NOW - 1 * DAY), refundedCents: 7999 },
      // Paid last month, part of it went back this month (a withdrawal with work already done).
      { orderedAt: iso(NOW - 40 * DAY), amountCents: 7999, refundedAt: iso(NOW - 1 * DAY), refundedCents: 4000 },
    ];
    expect(revenueBetween(customers, orders, window.from, NOW)).toBe(PLAN_PRICE.pro + 2499 + 7999 - 7999 - 4000);
    expect(revenueBetween(customers, [], window.from, NOW)).toBe(PLAN_PRICE.pro);
    // A refund is never larger than what was paid.
    expect(revenueBetween([], [{ orderedAt: iso(NOW - 1 * DAY), amountCents: 100, refundedAt: iso(NOW), refundedCents: 500 }], window.from, NOW + 1)).toBe(0);
  });

  it("never counts Pro the team gives (it has no invoices)", () => {
    const given = customer({ plan: "pro", startedAt: NOW - 2 * DAY, invoices: [] });
    expect(revenueBetween([given], [], window.from, NOW)).toBe(0);
  });

  it("gives the tile, its change and a six-month line that ends with this month", () => {
    const customers = [customer({ plan: "pro", invoices: [invoice(NOW - 1 * DAY), invoice(Date.UTC(2026, 9, 5)), invoice(Date.UTC(2026, 9, 25))] })];
    const result = revenueThisMonth(customers, [], NOW);
    expect(result.value).toBe(PLAN_PRICE.pro);
    // October 1–19 holds one invoice (the 5th); the 25th lies past the comparable stretch.
    expect(result.previous).toBe(PLAN_PRICE.pro);
    expect(result.change).toBe(0);
    expect(result.series).toHaveLength(6);
    expect(result.series.at(-1)).toBe(result.value);
    expect(result.series.at(-2)).toBe(2 * PLAN_PRICE.pro);
  });
});
