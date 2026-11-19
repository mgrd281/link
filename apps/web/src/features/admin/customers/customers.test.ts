import { describe, expect, it } from "vitest";

import { parseUserAgent } from "@/features/account/device";
import type { LoginEvent } from "@/features/account/types";

import { can, PERMISSIONS, ROLE_PERMISSIONS } from "../types";
import { DAY, monthlyRevenue, PLAN_PRICE, riskFlags } from "./model";
import { sampleCustomers } from "./sample";
import { cohorts, funnel, kpis, mrrByMonth, signupsPerDay } from "./stats";

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
    expect(numbers.mrr).toBe(customers.reduce((sum, customer) => sum + monthlyRevenue(customer), 0));
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
  it("counts active and overdue paid plans, never trials or canceled", () => {
    const [customer] = sampleCustomers(NOW, 1);
    if (!customer) throw new Error("no sample");
    const as = (status: "active" | "trialing" | "past_due" | "canceled") =>
      monthlyRevenue({ ...customer, subscription: { ...customer.subscription, plan: "pro", status } });
    expect(as("active")).toBe(PLAN_PRICE.pro);
    expect(as("past_due")).toBe(PLAN_PRICE.pro);
    expect(as("trialing")).toBe(0);
    expect(as("canceled")).toBe(0);
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
});
