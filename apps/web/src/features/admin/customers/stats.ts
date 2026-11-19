import { DAY, daysAgo, isPaying, monthlyRevenue, PLAN_PRICE, type Customer } from "./model";

/** Numbers for the team console. Pure: the same customers and `now` always give the same answer. */

export interface Kpis {
  customers: number;
  newCustomers: number;
  /** Signed in or edited within the last 7 days. */
  active7: number;
  /** Euro cents per month. */
  mrr: number;
  paying: number;
  trialing: number;
  pastDue: number;
  /** Share of all customers on a paid plan (0–1). */
  conversion: number;
  /** Paid subscriptions canceled in the range ÷ paid at its start (0–1). */
  churn: number;
  views: number;
  suspended: number;
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
  const paying = all.filter(isPaying).length;
  return {
    customers: all.length,
    newCustomers: all.filter((customer) => inRange(customer.createdAt)).length,
    active7: all.filter((customer) => daysAgo(now, customer.lastSeenAt) <= 7).length,
    mrr: all.reduce((sum, customer) => sum + monthlyRevenue(customer), 0),
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

/** Monthly recurring revenue at the end of each of the last `months` months (cents, oldest first). */
export function mrrByMonth(customers: readonly Customer[], now: number, months: number): DayCount[] {
  const today = new Date(now);
  return Array.from({ length: months }, (_, index) => {
    // The last moment of each month (midnight UTC), or now for the running month.
    const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1 - index) + 1, 1);
    const at = Math.min(now, end - 1);
    const value = customers.reduce((sum, customer) => {
      const { plan, startedAt, canceledAt, trialEndsAt, status } = customer.subscription;
      if (plan === "free" || !startedAt || Date.parse(startedAt) > at) return sum;
      if (canceledAt && Date.parse(canceledAt) <= at) return sum;
      if (status === "trialing" && (!trialEndsAt || Date.parse(trialEndsAt) > at)) return sum;
      return sum + PLAN_PRICE[plan];
    }, 0);
    return { date: new Date(at).toISOString().slice(0, 10), value };
  });
}

export interface Share {
  key: string;
  value: number;
}

/** Counts per key, largest first; everything past `top` folds into "other". */
export function shares(values: readonly string[], top = 6): Share[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, value }));
  if (sorted.length <= top) return sorted;
  const rest = sorted.slice(top).reduce((sum, share) => sum + share.value, 0);
  return [...sorted.slice(0, top), { key: "other", value: rest }];
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

/** From sign-up to paying, each step a subset of the one before. */
export function funnel(customers: readonly Customer[]): Share[] {
  const onboarded = customers.filter((customer) => customer.usage.onboarded);
  const built = onboarded.filter((customer) => customer.usage.blocks >= 3);
  const visited = built.filter((customer) => customer.usage.views30 > 0);
  const paid = visited.filter((customer) => customer.subscription.plan === "pro");
  return [
    { key: "signedUp", value: customers.length },
    { key: "onboarded", value: onboarded.length },
    { key: "built", value: built.length },
    { key: "visited", value: visited.length },
    { key: "paid", value: paid.length },
  ];
}
