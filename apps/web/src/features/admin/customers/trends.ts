import { DAY, revenueAt, type Customer } from "./model";

/**
 * Trends for the team console's key figures (A-19): each figure now, the same figure one range
 * earlier, and a short series for the sparkline. Pure: the same customers, orders and `now` always
 * give the same answer. Only what the records show: a figure the records cannot say for a past
 * moment (who was active last week, page views) gets no trend at all, never a made-up one.
 */

export interface Trend {
  /** The figure now (or over the current range). */
  value: number;
  /** The same figure one range earlier (or over the range before). */
  previous: number;
  /** `value − previous`. */
  change: number;
  /** Oldest first, the last point is `value`'s moment (for the sparkline). */
  series: number[];
}

const trend = (value: number, previous: number, series: number[]): Trend => ({ value, previous, change: value - previous, series });

/** `points` instants spread evenly over the `days` before `now`, oldest first, `now` last. */
export function samples(now: number, days: number, points = 12): number[] {
  const step = (days * DAY) / Math.max(1, points - 1);
  return Array.from({ length: points }, (_, index) => Math.round(now - (points - 1 - index) * step));
}

/** Customers who had signed up by `at` (deleted accounts are gone from every moment alike). */
export const customersAt = (customers: readonly Customer[], at: number) => customers.filter((customer) => Date.parse(customer.createdAt) <= at).length;

/** Sign-ups in (from, to]. */
export const signupsBetween = (customers: readonly Customer[], from: number, to: number) =>
  customers.filter((customer) => {
    const created = Date.parse(customer.createdAt);
    return created > from && created <= to;
  }).length;

/** Customers paying through Stripe at `at` (`revenueAt`, the one revenue rule). */
export const payingAt = (customers: readonly Customer[], at: number) => customers.filter((customer) => revenueAt(customer, at) > 0).length;

/** Monthly recurring revenue at `at` (cents): the same sum as `mrrAt` in stats.ts. */
export const mrrAtTime = (customers: readonly Customer[], at: number) => customers.reduce((sum, customer) => sum + revenueAt(customer, at), 0);

/** Paying ÷ all customers at `at` (0–1). */
export function conversionAt(customers: readonly Customer[], at: number): number {
  const all = customersAt(customers, at);
  return all ? payingAt(customers, at) / all : 0;
}

/**
 * Paid subscriptions that ended in (from, to] ÷ the customers paying at `from` (0–1). Only those who
 * paid at `from` count, so a plan that started and ended inside the range is not churn of the base.
 */
export function churnBetween(customers: readonly Customer[], from: number, to: number): number {
  const base = customers.filter((customer) => revenueAt(customer, from) > 0);
  if (!base.length) return 0;
  const ended = base.filter((customer) => {
    const { status, canceledAt } = customer.subscription;
    if (status !== "canceled" || !canceledAt) return false;
    const at = Date.parse(canceledAt);
    return at > from && at <= to;
  }).length;
  return ended / base.length;
}

export interface KpiTrends {
  customers: Trend;
  /** Sign-ups in the range, against the range before; the series counts sign-ups per slice. */
  newCustomers: Trend;
  mrr: Trend;
  paying: Trend;
  conversion: Trend;
  /** Churn in the range against the range before (no series: each point would be a range of its own). */
  churn: Trend;
}

/** Every key figure of the overview with its trend over `rangeDays`. */
export function kpiTrends(customers: readonly Customer[], now: number, rangeDays: number, points = 12): KpiTrends {
  const range = rangeDays * DAY;
  const start = now - range;
  const moments = samples(now, rangeDays, points);
  const slice = range / points;
  return {
    customers: trend(
      customersAt(customers, now),
      customersAt(customers, start),
      moments.map((at) => customersAt(customers, at)),
    ),
    newCustomers: trend(
      signupsBetween(customers, start, now),
      signupsBetween(customers, start - range, start),
      Array.from({ length: points }, (_, index) => signupsBetween(customers, start + index * slice, start + (index + 1) * slice)),
    ),
    mrr: trend(
      mrrAtTime(customers, now),
      mrrAtTime(customers, start),
      moments.map((at) => mrrAtTime(customers, at)),
    ),
    paying: trend(
      payingAt(customers, now),
      payingAt(customers, start),
      moments.map((at) => payingAt(customers, at)),
    ),
    conversion: trend(
      conversionAt(customers, now),
      conversionAt(customers, start),
      moments.map((at) => conversionAt(customers, at)),
    ),
    churn: trend(churnBetween(customers, start, now), churnBetween(customers, start - range, start), []),
  };
}

// ── Revenue that came in ─────────────────────────────────────────────────────────────────────────

/** A page-service order as money: what was paid when, and what went back when (A-19). */
export interface OrderMoney {
  orderedAt: string;
  amountCents: number;
  refundedAt: string | null;
  /** What went back (the whole price for a voluntary refund, the decided sum for a withdrawal). */
  refundedCents: number;
}

/**
 * Money that came in during [from, to) (cents), net of refunds: paid Pro invoices dated in the range
 * (a refunded invoice brought nothing in, and a failed one never did), plus page-service orders paid
 * in the range, minus what was refunded on orders in the range. Pro the team gives and rewards have no
 * invoices, so they never count.
 */
export function revenueBetween(customers: readonly Customer[], orders: readonly OrderMoney[], from: number, to: number): number {
  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const at = Date.parse(iso);
    return at >= from && at < to;
  };
  const invoices = customers.reduce(
    (sum, customer) => sum + customer.subscription.invoices.filter((invoice) => invoice.status === "paid" && inRange(invoice.at)).reduce((part, invoice) => part + invoice.amount, 0),
    0,
  );
  const paid = orders.filter((order) => inRange(order.orderedAt)).reduce((sum, order) => sum + order.amountCents, 0);
  const refunded = orders.filter((order) => inRange(order.refundedAt)).reduce((sum, order) => sum + Math.min(order.refundedCents, order.amountCents), 0);
  return invoices + paid - refunded;
}

export interface MonthWindow {
  /** The first moment of this month (UTC). */
  from: number;
  /** Now. */
  to: number;
  /** The first moment of last month. */
  previousFrom: number;
  /** As far into last month as `to` is into this one (never past its end): a fair comparison. */
  previousTo: number;
}

/** This month so far, and the same stretch of last month (UTC calendar months). */
export function monthToDate(now: number): MonthWindow {
  const today = new Date(now);
  const from = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const previousFrom = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
  return { from, to: now, previousFrom, previousTo: Math.min(from, previousFrom + (now - from)) };
}

/**
 * "Umsatz diesen Monat": this month so far against the same stretch of last month, with the six
 * whole months before as the sparkline (oldest first; the last point is this month so far).
 */
export function revenueThisMonth(customers: readonly Customer[], orders: readonly OrderMoney[], now: number, months = 6): Trend {
  const window = monthToDate(now);
  const today = new Date(now);
  const series = Array.from({ length: months }, (_, index) => {
    const back = months - 1 - index;
    const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1);
    const end = back === 0 ? now : Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back + 1, 1);
    return revenueBetween(customers, orders, start, end);
  });
  return trend(revenueBetween(customers, orders, window.from, window.to), revenueBetween(customers, orders, window.previousFrom, window.previousTo), series);
}
