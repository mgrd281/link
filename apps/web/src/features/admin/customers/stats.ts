import { DAY, daysAgo, revenueAt, type Customer } from "./model";

/** Numbers for the team console. Pure: the same customers and `now` always give the same answer. */

export interface Kpis {
  customers: number;
  newCustomers: number;
  /** Signed in or edited within the last 7 days. */
  active7: number;
  /** Euro cents per month: `mrrAt(customers, now)`, the same number as the chart's last bar. */
  mrr: number;
  paying: number;
  trialing: number;
  pastDue: number;
  /**
   * Share of all customers who pay for Pro through Stripe (0–1): `paying ÷ customers`. The team's Pro,
   * trials and rewards bring no money and do not count (the tile's hint says so).
   */
  conversion: number;
  /** Paid subscriptions canceled in the range ÷ paid at its start (0–1). */
  churn: number;
  views: number;
  suspended: number;
}

/** Monthly recurring revenue at the moment `at` (cents): the one MRR for the tile and the chart. */
export function mrrAt(customers: readonly Customer[], at: number): number {
  return customers.reduce((sum, customer) => sum + revenueAt(customer, at), 0);
}

export function kpis(customers: readonly Customer[], now: number, rangeDays: number): Kpis {
  const all = customers;
  const inRange = (iso: string | undefined) => iso !== undefined && daysAgo(now, iso) <= rangeDays;
  const paidAtStart = all.filter(
    (customer) =>
      customer.subscription.plan !== "free" &&
      customer.subscription.startedAt &&
      daysAgo(now, customer.subscription.startedAt) > rangeDays,
  ).length;
  const canceled = all.filter(
    (customer) => customer.subscription.status === "canceled" && inRange(customer.subscription.canceledAt),
  ).length;
  const paying = all.filter((customer) => revenueAt(customer, now) > 0).length;
  return {
    customers: all.length,
    newCustomers: all.filter((customer) => inRange(customer.createdAt)).length,
    active7: all.filter((customer) => daysAgo(now, customer.lastSeenAt) <= 7).length,
    mrr: mrrAt(all, now),
    paying,
    trialing: all.filter((customer) => customer.subscription.status === "trialing").length,
    pastDue: all.filter((customer) => customer.subscription.status === "past_due").length,
    conversion: all.length ? paying / all.length : 0,
    churn: paidAtStart ? canceled / paidAtStart : 0,
    views: all.reduce((sum, customer) => sum + customer.usage.views30, 0),
    suspended: all.filter((customer) => customer.status === "suspended").length,
  };
}

export interface DayCount {
  date: string;
  value: number;
}

const dayKey = (time: number) => new Date(time).toISOString().slice(0, 10);

/** New customers per day for the last `days` days (oldest first, zero-filled). */
export function signupsPerDay(customers: readonly Customer[], now: number, days: number): DayCount[] {
  const counts = new Map<string, number>();
  for (const customer of customers)
    counts.set(customer.createdAt.slice(0, 10), (counts.get(customer.createdAt.slice(0, 10)) ?? 0) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = dayKey(now - (days - 1 - index) * DAY);
    return { date, value: counts.get(date) ?? 0 };
  });
}

/**
 * Monthly recurring revenue at the end of each of the last `months` months (cents, oldest first):
 * `mrrAt` at the last moment of each month, and at `now` for the running month, so the last bar is
 * exactly the MRR tile.
 */
export function mrrByMonth(customers: readonly Customer[], now: number, months: number): DayCount[] {
  const today = new Date(now);
  return Array.from({ length: months }, (_, index) => {
    // The last moment of each month (midnight UTC), or now for the running month.
    const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1 - index) + 1, 1);
    const at = Math.min(now, end - 1);
    return { date: new Date(at).toISOString().slice(0, 10), value: mrrAt(customers, at) };
  });
}

export interface Share {
  key: string;
  value: number;
}

/**
 * The key everything past `top` folds into. Not a word a value can be: "other" is a page kind of
 * its own, and folding into it showed "Other" twice.
 */
export const REST = "__rest";

/** Counts per key, largest first; everything past `top` folds into `REST`. */
export function shares(values: readonly string[], top = 6): Share[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, value }));
  if (sorted.length <= top) return sorted;
  const rest = sorted.slice(top).reduce((sum, share) => sum + share.value, 0);
  return [...sorted.slice(0, top), { key: REST, value: rest }];
}

/** The device each customer signed in with most recently. */
export const lastDevice = (customer: Customer) =>
  customer.logins.find((login) => login.result === "success")?.device;

/**
 * Weekly cohorts: of the customers who signed up in a week, the share still active `n` weeks later
 * (last seen at least n weeks after sign-up). Rows oldest first; cells are 0–1, or null while that
 * week isn't over for the whole cohort yet.
 */
export function cohorts(
  customers: readonly Customer[],
  now: number,
  weeks: number,
): { start: string; size: number; cells: (number | null)[] }[] {
  const week = 7 * DAY;
  return Array.from({ length: weeks }, (_, index) => {
    const start = now - (weeks - index) * week;
    const members = customers.filter((customer) => {
      const created = Date.parse(customer.createdAt);
      return created >= start && created < start + week;
    });
    const cells = Array.from({ length: weeks }, (_, n) => {
      // A week only counts once it is over for the whole cohort (week 0 is 100 % by definition).
      if (n > 0 && start + (n + 1) * week > now) return null;
      if (!members.length) return 0;
      return (
        members.filter(
          (customer) => Date.parse(customer.lastSeenAt) - Date.parse(customer.createdAt) >= n * week,
        ).length / members.length
      );
    });
    return { start: new Date(start).toISOString().slice(0, 10), size: members.length, cells };
  });
}

/**
 * From sign-up to Pro, each step a subset of the one before. Page views are not a step: real
 * accounts have no view counter yet, and a Pro count must never hang on a number nobody measured.
 * "paid" is a running Pro plan (not canceled); rewards are not a plan.
 */
export function funnel(customers: readonly Customer[]): Share[] {
  const onboarded = customers.filter((customer) => customer.usage.onboarded);
  const built = onboarded.filter((customer) => customer.usage.blocks >= 3);
  const paid = built.filter(
    (customer) => customer.subscription.plan === "pro" && customer.subscription.status !== "canceled",
  );
  return [
    { key: "signedUp", value: customers.length },
    { key: "onboarded", value: onboarded.length },
    { key: "built", value: built.length },
    { key: "paid", value: paid.length },
  ];
}

/** Customers whose page had visitors in the last 30 days (only where views are measured). */
export const visitedCount = (customers: readonly Customer[]) =>
  customers.filter((customer) => customer.usage.views30 > 0).length;

// ── Export ───────────────────────────────────────────────────────────────────────────────────

/** Characters that make a spreadsheet read a cell as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell: quoted, inner quotes doubled, and text a spreadsheet would run as a formula
 * (= + - @, a tab or a carriage return first) starts with an apostrophe, so it stays text.
 */
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** The customer list as CSV, one row per customer; views only where they are measured. */
export function customersCsv(customers: readonly Customer[], now: number, options: { views: boolean }): string {
  const header = [
    "name",
    "email",
    "username",
    "plan",
    "subscription",
    "status",
    "country",
    "created",
    "last_seen",
    "mrr_eur",
    ...(options.views ? ["views_30d"] : []),
  ];
  const lines = customers.map((customer) =>
    [
      customer.name,
      customer.email ?? "",
      customer.username,
      customer.subscription.plan,
      customer.subscription.status ?? "",
      customer.status,
      customer.country,
      customer.createdAt,
      customer.lastSeenAt,
      (revenueAt(customer, now) / 100).toFixed(2),
      ...(options.views ? [customer.usage.views30] : []),
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
