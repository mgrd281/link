import type { ConsoleStats } from "./answer";
import { daysBetween } from "./days";

/**
 * The team console's use of the statistics (`admin_page_stats`, read in features/admin/live.ts):
 * views and taps of the last 30 days on each customer's row, and the views per day. Pure.
 */

/** Whether anything has been counted anywhere: before that the console says "not measured yet", never 0. */
export const measured = (stats: ConsoleStats | null): stats is ConsoleStats => stats !== null && stats.since !== null;

/**
 * Each customer's `usage.views30` and `usage.clicks30` from the totals. A customer without a row had
 * no visits in the range (counting is on: `measured`), so 0 is a measured 0 there.
 */
export function withPageStats<C extends { id: string; usage: { views30: number; clicks30: number } }>(customers: readonly C[], stats: ConsoleStats): C[] {
  const byId = new Map(stats.pages.map((page) => [page.id, page]));
  return customers.map((customer) => {
    const page = byId.get(customer.id);
    return { ...customer, usage: { ...customer.usage, views30: page?.views ?? 0, clicks30: page?.clicks ?? 0 } };
  });
}

/** Views per day over the totals' range, oldest first; days before counting began are null, not 0. */
export function viewsPerDay(stats: ConsoleStats): { date: string; value: number | null }[] {
  const byDay = new Map(stats.days.map((row) => [row.day, row.views]));
  return daysBetween(stats.from, stats.to).map((date) => ({
    date,
    value: stats.since === null || date < stats.since ? null : (byDay.get(date) ?? 0),
  }));
}
