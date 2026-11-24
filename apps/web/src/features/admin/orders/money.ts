"use client";

import { useEffect, useState } from "react";

import type { OrderMoney } from "../customers/trends";

import { settle, type Loaded } from "./load";
import { loadOrder, loadQueue, type TeamOrder } from "./orders-data";

/**
 * Page-service orders as money, for the overview's "Umsatz diesen Monat" (A-19): what each order
 * paid and what went back. Only real accounts with payments have orders; the queue says which, and
 * each order's own record says its price and its refund. More orders than `MAX_READS` in the window:
 * the read fails rather than showing a sum that leaves some out.
 */

const MAX_READS = 120;
const DAY = 86_400_000;
const SIX_MONTHS = 186 * DAY;
/**
 * How long after its order a refund can land: work starts after the 14-day withdrawal period, a
 * withdrawal is refunded within 14 days, the voluntary refund is asked within 14 days of delivery
 * (ADR 0066); 90 days covers all of them with room to spare. A refund of an older order cannot fall
 * into the six months shown.
 */
const REFUND_REACH = 90 * DAY;
/** Order records read at once: a few at a time, not every one in one burst. */
const CONCURRENT_READS = 6;

/** What went back on an order: the refund the timeline records, the whole price when it names none. */
export function orderMoney(order: TeamOrder): OrderMoney {
  const refund = order.events.find((event) => event.kind === "refunded");
  const amount = typeof refund?.details.amount === "number" && Number.isFinite(refund.details.amount) ? refund.details.amount : order.amountCents;
  return {
    orderedAt: order.orderedAt,
    amountCents: order.amountCents,
    refundedAt: order.refundedAt,
    refundedCents: order.refundedAt ? amount : 0,
  };
}

/**
 * The orders whose money can show in the six months: paid within them, or refunded or withdrawn and
 * ordered recently enough for the refund to land within them (a refund this month may belong to an
 * order of last year's last weeks, never to one of years ago).
 */
export function ordersForRevenue<T extends { orderedAt: string; status: string }>(queue: readonly T[], now: number): T[] {
  return queue.filter((order) => {
    const age = now - Date.parse(order.orderedAt);
    return age <= SIX_MONTHS || ((order.status === "refunded" || order.status === "withdrawn") && age <= SIX_MONTHS + REFUND_REACH);
  });
}

/** `read` for every item, at most `limit` at a time, in their order. */
export async function inBatches<T, R>(items: readonly T[], limit: number, read: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let start = 0; start < items.length; start += limit) out.push(...(await Promise.all(items.slice(start, start + limit).map(read))));
  return out;
}

async function readOrderMoney(now: number): Promise<OrderMoney[]> {
  const queue = await loadQueue("all");
  const wanted = ordersForRevenue(queue, now);
  if (wanted.length > MAX_READS) throw new Error("too many orders to add up here");
  // Each record is a whole order (briefing, timeline, proposals); a lighter aggregate function is a
  // follow-up for a database work package.
  const orders = await inBatches(wanted, CONCURRENT_READS, (order) => loadOrder(order.id));
  return orders.flatMap((order) => (order ? [orderMoney(order)] : []));
}

/** `off` where orders cannot exist (no payments, demo) or the role may not see them. */
export function useOrderMoney(enabled: boolean, now: number): { status: "off" } | Loaded<OrderMoney[]> {
  const [state, setState] = useState<Loaded<OrderMoney[]>>({ status: "loading" });
  // The minute clock moves `now`; the orders are read once per visit.
  const [start] = useState(now);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void settle(() => readOrderMoney(start || Date.now())).then((answer) => {
      if (live) setState(answer);
    });
    return () => {
      live = false;
    };
  }, [enabled, start]);
  return enabled ? state : { status: "off" };
}
