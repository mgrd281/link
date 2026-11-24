import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseUserAgent } from "@/features/account/device";
import type { LoginEvent } from "@/features/account/types";
import { PRICES } from "@/features/payments/prices";

import { can, PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../types";
import { DAY, hasPro, isPaying, monthlyRevenue, PLAN_PRICE, revenueAt, riskFlags, subscriptionSource, withRewards, type Customer } from "./model";
import { sampleCustomers } from "./sample";
import { cohorts, csvCell, customersCsv, funnel, kpis, mrrAt, mrrByMonth, REST, shares, signupsPerDay, visitedCount } from "./stats";

const NOW = Date.UTC(2026, 10, 19, 12);
const login = (overrides: Partial<LoginEvent>): LoginEvent => ({
  id: `lg_${Math.random().toString(36).slice(2)}`,
  at: new Date(NOW).toISOString(),
  ip: "192.0.2.10",
  country: "DE",
  device: { type: "mobile", os: "iOS", browser: "Safari" },
  deviceId: "dev_home",
  result: "success",
  ...overrides,
});

describe("sample customers", () => {
  const customers = sampleCustomers(NOW);

  it("are the same for the same day (seeded)", () => {
    expect(sampleCustomers(NOW).map((customer) => customer.id)).toEqual(
      customers.map((customer) => customer.id),
    );
    expect(customers).toHaveLength(240);
  });

  it("can never point to a real person: example.com and documentation-only IP ranges", () => {
    for (const customer of customers) {
      expect(customer.email).toMatch(/@example\.com$/);
      for (const entry of customer.logins)
        expect(entry.ip).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$|^2001:db8:/);
    }
  });

  it("add up: revenue, conversion, sign-ups, cohorts and funnel", () => {
    const numbers = kpis(customers, NOW, 30);
    expect(numbers.mrr).toBe(customers.reduce((sum, customer) => sum + monthlyRevenue(customer, NOW), 0));
    expect(numbers.paying).toBeGreaterThan(0);
    expect(numbers.conversion).toBeCloseTo(numbers.paying / customers.length);
    const days = signupsPerDay(customers, NOW, 30);
    expect(days).toHaveLength(30);
    expect(days.reduce((sum, day) => sum + day.value, 0)).toBeLessThanOrEqual(numbers.customers);
    expect(mrrByMonth(customers, NOW, 6).at(-1)?.value).toBeGreaterThan(0);
    const grid = cohorts(customers, NOW, 8);
    expect(grid).toHaveLength(8);
    expect(grid[0]?.cells[0]).toBe(grid[0]?.size ? 1 : 0);
    const steps = funnel(customers).map((step) => step.value);
    expect(steps).toEqual([...steps].sort((a, b) => b - a));
  });
});

describe("revenue", () => {
  const [sample] = sampleCustomers(NOW, 1);
  if (!sample) throw new Error("no sample");
  const startedAt = new Date(NOW - 40 * DAY).toISOString();
  const stripePro = (status: "active" | "trialing" | "past_due" | "canceled", extra: Partial<Customer["subscription"]> = {}): Customer => ({
    ...sample,
    subscription: { ...sample.subscription, plan: "pro", status, source: "stripe", startedAt, ...extra },
  });

  it("counts active and overdue Stripe plans, never trials or canceled ones", () => {
    expect(monthlyRevenue(stripePro("active"), NOW)).toBe(PLAN_PRICE.pro);
    expect(monthlyRevenue(stripePro("past_due"), NOW)).toBe(PLAN_PRICE.pro);
    expect(monthlyRevenue(stripePro("trialing"), NOW)).toBe(0);
    expect(monthlyRevenue(stripePro("canceled", { canceledAt: new Date(NOW - DAY).toISOString() }), NOW)).toBe(0);
    expect(monthlyRevenue(stripePro("canceled"), NOW)).toBe(0);
  });

  it("takes the price from the one price list", () => {
    expect(PLAN_PRICE.pro).toBe(PRICES["pro-monthly"].amountCents);
    expect(PLAN_PRICE.free).toBe(0);
  });

  it("never counts Pro the team gave by hand: no money comes in", () => {
    const team: Customer = { ...sample, subscription: { plan: "pro", status: "active", source: "team", startedAt, invoices: [] } };
    expect(subscriptionSource(team)).toBe("team");
    expect(monthlyRevenue(team, NOW)).toBe(0);
    expect(isPaying(team, NOW)).toBe(false);
    expect(hasPro(team)).toBe(true);
    // Without the database's word (demo, older database): invoices come only from Stripe.
    const unsaid = { ...team, subscription: { ...team.subscription, source: undefined } };
    expect(subscriptionSource(unsaid)).toBe("team");
    const invoiced = { ...unsaid, subscription: { ...unsaid.subscription, invoices: [{ id: "in_1", at: startedAt, amount: 800, status: "paid" as const }] } };
    expect(subscriptionSource(invoiced)).toBe("stripe");
    expect(monthlyRevenue(invoiced, NOW)).toBe(PLAN_PRICE.pro);
  });

  it("follows a plan through time: from its start until it was canceled", () => {
    const canceled = stripePro("canceled", { canceledAt: new Date(NOW - 10 * DAY).toISOString() });
    expect(revenueAt(canceled, NOW - 41 * DAY)).toBe(0);
    expect(revenueAt(canceled, NOW - 20 * DAY)).toBe(PLAN_PRICE.pro);
    expect(revenueAt(canceled, NOW - 10 * DAY)).toBe(0);
    // No start date on record: the account's sign-up stands in for it.
    const undated = stripePro("active", { startedAt: undefined });
    expect(revenueAt(undated, Date.parse(sample.createdAt) - DAY)).toBe(0);
    expect(revenueAt(undated, NOW)).toBe(PLAN_PRICE.pro);
  });
});

describe("one MRR for the tile and the chart", () => {
  const customers = sampleCustomers(NOW);

  it("the MRR tile equals the chart's last bar at now, in every range", () => {
    for (const range of [7, 30, 90]) {
      const tile = kpis(customers, NOW, range).mrr;
      for (const months of [6, 12]) expect(mrrByMonth(customers, NOW, months).at(-1)?.value).toBe(tile);
      expect(tile).toBe(mrrAt(customers, NOW));
    }
  });

  it("also for the cases that used to differ: a stale trial, a future cancellation, a plan without a start", () => {
    const [base] = customers;
    if (!base) throw new Error("no sample");
    const tricky: Customer[] = [
      // A trial past its end date that nobody updated: trials pay nothing, on both.
      { ...base, id: "t1", subscription: { plan: "pro", status: "trialing", source: "stripe", startedAt: new Date(NOW - 30 * DAY).toISOString(), trialEndsAt: new Date(NOW - 16 * DAY).toISOString(), invoices: [] } },
      // Canceled, with the end still ahead: it pays until then, on both.
      { ...base, id: "t2", subscription: { plan: "pro", status: "canceled", source: "stripe", startedAt: new Date(NOW - 30 * DAY).toISOString(), canceledAt: new Date(NOW + 5 * DAY).toISOString(), invoices: [] } },
      // Paying, but no start date on record.
      { ...base, id: "t3", subscription: { plan: "pro", status: "active", source: "stripe", invoices: [] } },
      // Overdue: still counted until Stripe gives up.
      { ...base, id: "t4", subscription: { plan: "pro", status: "past_due", source: "stripe", startedAt: new Date(NOW - 3 * DAY).toISOString(), invoices: [] } },
    ];
    const tile = kpis(tricky, NOW, 30).mrr;
    expect(mrrByMonth(tricky, NOW, 6).at(-1)?.value).toBe(tile);
    expect(tile).toBe(3 * PLAN_PRICE.pro);
  });
});

describe("shares", () => {
  it("fold the rest into their own key, which never collides with the page kind \"other\"", () => {
    const values = ["a", "a", "b", "c", "d", "other", "other", "e", "f", "g"];
    const result = shares(values, 3);
    expect(result.map((share) => share.key)).toEqual(["a", "other", "b", REST]);
    expect(result.filter((share) => share.key === "other")).toHaveLength(1);
    expect(result.find((share) => share.key === REST)?.value).toBe(5);
    expect(REST).not.toBe("other");
    expect(shares(["other", "a"], 6).map((share) => share.key)).not.toContain(REST);
  });
});

describe("funnel", () => {
  const [base] = sampleCustomers(NOW, 1);
  if (!base) throw new Error("no sample");
  const person = (id: string, views30: number, plan: "free" | "pro"): Customer => ({
    ...base,
    id,
    usage: { ...base.usage, onboarded: true, blocks: 4, views30, clicks30: 0 },
    subscription: plan === "pro" ? { plan, status: "active", source: "stripe", invoices: [] } : { plan, status: null, invoices: [] },
  });

  it("counts Pro without asking for views (real accounts have none yet)", () => {
    const unmeasured = [person("p1", 0, "pro"), person("p2", 0, "pro"), person("p3", 0, "free")];
    const measured = unmeasured.map((customer) => ({ ...customer, usage: { ...customer.usage, views30: 120 } }));
    expect(funnel(unmeasured).find((step) => step.key === "paid")?.value).toBe(2);
    expect(funnel(measured)).toEqual(funnel(unmeasured));
    expect(funnel(unmeasured).map((step) => step.key)).toEqual(["signedUp", "onboarded", "built", "paid"]);
    expect(visitedCount(measured)).toBe(3);
    expect(visitedCount(unmeasured)).toBe(0);
  });

  it("does not count a canceled plan as Pro", () => {
    const canceled = { ...person("p4", 0, "pro"), subscription: { plan: "pro" as const, status: "canceled" as const, source: "stripe" as const, invoices: [] } };
    expect(funnel([canceled]).find((step) => step.key === "paid")?.value).toBe(0);
  });
});

describe("CSV export", () => {
  it("starts every cell a spreadsheet would run as a formula with an apostrophe", () => {
    for (const start of ["=", "+", "-", "@", "\t", "\r"]) expect(csvCell(`${start}HYPERLINK("x")`)).toBe(`"'${start}HYPERLINK(""x"")"`);
    expect(csvCell("=1+1")).toBe(`"'=1+1"`);
    expect(csvCell("Mila Berg")).toBe(`"Mila Berg"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
    expect(csvCell(12)).toBe(`"12"`);
    expect(csvCell("a=b")).toBe(`"a=b"`);
  });

  it("writes one safe row per customer; views only where they are measured", () => {
    const [base] = sampleCustomers(NOW, 1);
    if (!base) throw new Error("no sample");
    const evil: Customer = { ...base, name: "=cmd|' /C calc'!A0", email: "@evil@example.com" };
    const csv = customersCsv([evil], NOW, { views: false });
    const [header, row] = csv.split("\n");
    expect(header).not.toContain("views_30d");
    expect(row?.startsWith(`"'=cmd|' /C calc'!A0","'@evil@example.com"`)).toBe(true);
    expect(customersCsv([evil], NOW, { views: true }).split("\n")[0]).toContain("views_30d");
  });
});

describe("Pro for life", () => {
  const samples = sampleCustomers(NOW);
  const free = samples.find((customer) => customer.subscription.plan === "free" && !customer.rewards);
  if (!free) throw new Error("no free sample");
  const proForLife = { at: new Date(NOW - 20 * DAY).toISOString(), source: "referrals" as const };
  const rewarded: Customer = { ...free, rewards: { proForLife } };

  it("never counts Pro for life as revenue", () => {
    expect(monthlyRevenue(rewarded, NOW)).toBe(0);
    expect(isPaying(rewarded, NOW)).toBe(false);
    expect(hasPro(rewarded)).toBe(true);
    expect(hasPro(free)).toBe(false);

    const alone = kpis([rewarded], NOW, 30);
    expect(alone.mrr).toBe(0);
    expect(alone.paying).toBe(0);
    expect(alone.conversion).toBe(kpis([free], NOW, 30).conversion);
    for (const month of mrrByMonth([rewarded], NOW, 12)) expect(month.value).toBe(0);
    expect(funnel([rewarded]).find((step) => step.key === "paid")?.value).toBe(0);

    // Among every sample customer: MRR, ARR, paying, conversion and the MRR history are exactly
    // what they are without the reward.
    const others = samples.filter((customer) => customer.id !== free.id);
    const without = [...others, free];
    const withReward = [...others, rewarded];
    const before = kpis(without, NOW, 30);
    const after = kpis(withReward, NOW, 30);
    expect(after.mrr).toBe(before.mrr);
    expect(after.mrr * 12).toBe(before.mrr * 12);
    expect(after.paying).toBe(before.paying);
    expect(after.conversion).toBe(before.conversion);
    expect(mrrByMonth(withReward, NOW, 12)).toEqual(mrrByMonth(without, NOW, 12));
    expect(funnel(withReward)).toEqual(funnel(without));
  });

  it("comes from the team's reward rows, beside the subscription; a removed one gives no Pro", () => {
    const [merged] = withRewards(
      [free],
      [
        { customerId: free.id, username: free.username, kind: "pro_for_life", source: "referrals", at: proForLife.at, revokedAt: null, counted: 10 },
        { customerId: "someone-else", username: "x", kind: "verification_review", source: "team", at: proForLife.at, revokedAt: null, counted: 3 },
      ],
    );
    if (!merged) throw new Error("no customer");
    expect(merged.rewards).toEqual({ proForLife });
    expect(merged.subscription).toEqual(free.subscription);
    expect(hasPro(merged)).toBe(true);
    expect(monthlyRevenue(merged, NOW)).toBe(0);

    const removed: Customer = { ...free, rewards: { proForLife: { ...proForLife, revokedAt: new Date(NOW).toISOString() } } };
    expect(hasPro(removed)).toBe(false);
    // Paid Pro is Pro as long as it runs; a canceled plan is not.
    expect(hasPro({ ...free, subscription: { ...free.subscription, plan: "pro", status: "active" } })).toBe(true);
    expect(hasPro({ ...free, subscription: { ...free.subscription, plan: "pro", status: "canceled" } })).toBe(false);
  });

  it("one sample customer has it, on the free plan", () => {
    const holders = samples.filter((customer) => customer.rewards?.proForLife);
    expect(holders).toHaveLength(1);
    expect(holders[0]?.subscription.plan).toBe("free");
    expect(holders[0]?.rewards?.proForLife?.source).toBe("referrals");
  });
});

describe("risk flags", () => {
  const usual = login({ at: new Date(NOW - 5 * DAY).toISOString() });

  it("flags a device and a country never seen before", () => {
    const stranger = login({ deviceId: "dev_new", country: "BR", ip: "203.0.113.9" });
    expect(riskFlags(stranger, [usual, stranger], new Set())).toEqual(["new-device", "new-country"]);
    expect(riskFlags(login({}), [usual], new Set())).toEqual([]);
  });

  it("flags bursts of failed attempts and blocked addresses", () => {
    const fails = [1, 2, 3].map((minute) =>
      login({ result: "failed", at: new Date(NOW - minute * 60_000).toISOString(), ip: "198.51.100.66" }),
    );
    const next = login({ result: "failed", ip: "198.51.100.66" });
    expect(riskFlags(next, [...fails, next], new Set(["198.51.100.66"]))).toEqual([
      "blocked-ip",
      "failed-burst",
    ]);
  });
});

describe("devices", () => {
  it("reads system, browser and type from the user agent", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ type: "mobile", os: "iOS", browser: "Safari" });
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
      ),
    ).toEqual({ type: "mobile", os: "Android", browser: "Chrome" });
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0",
      ),
    ).toEqual({ type: "desktop", os: "Windows", browser: "Edge" });
    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ).type,
    ).toBe("tablet");
  });
});

describe("roles", () => {
  it("owners can do everything; admins all but the team and deleting customers; viewers only look", () => {
    expect(ROLE_PERMISSIONS.owner).toEqual(PERMISSIONS);
    expect(can("admin", "billing.manage")).toBe(true);
    expect(can("admin", "team.manage")).toBe(false);
    expect(can("admin", "customers.delete")).toBe(false);
    expect(can("viewer", "security.view")).toBe(true);
    expect(can("viewer", "security.manage")).toBe(false);
    expect(can("editor", "billing.view")).toBe(false);
  });

  it("editors work on orders without seeing customers; only owners and admins export", () => {
    expect(can("editor", "orders.view")).toBe(true);
    expect(can("editor", "customers.view")).toBe(false);
    expect(can("viewer", "orders.view")).toBe(true);
    expect(can("viewer", "customers.view")).toBe(true);
    expect(ROLES.filter((role) => can(role, "customers.export"))).toEqual(["owner", "admin"]);
    expect(ROLES.filter((role) => can(role, "orders.view"))).toEqual(["owner", "admin", "editor", "viewer"]);
  });

  it("match the role table of the database (supabase/migrations)", () => {
    const migrations = join(process.cwd(), "../../supabase/migrations");
    const team = readFileSync(join(migrations, "20261119100200_team.sql"), "utf8");
    const money = readFileSync(join(migrations, "20261124100100_admin_money.sql"), "utf8");
    // Every permission the app knows is granted somewhere in the database.
    for (const permission of PERMISSIONS) expect(`${team}\n${money}`).toContain(`'${permission}'`);
    expect(money).toContain("delete from public.role_permissions where role = 'editor' and permission = 'customers.view'");
    expect(Object.fromEntries(ROLES.map((role) => [role, ROLE_PERMISSIONS[role].length]))).toEqual({ owner: 18, admin: 16, editor: 5, viewer: 6 });
  });
});
