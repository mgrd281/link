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
const SIX_MONTHS = 186 * 86_400_000;

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

async function readOrderMoney(now: number): Promise<OrderMoney[]> {
  const queue = await loadQueue("all");
  // Paid within the window, or refunded at some point (a refund this month may belong to an older order).
  const wanted = queue.filter((order) => now - Date.parse(order.orderedAt) <= SIX_MONTHS || order.status === "refunded" || order.status === "withdrawn");
  if (wanted.length > MAX_READS) throw new Error("too many orders to add up here");
  const orders = await Promise.all(wanted.map((order) => loadOrder(order.id)));
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
