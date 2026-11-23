/**
 * What the order screen says for an order's state. A withdrawal that is being handled, and an order
 * that was withdrawn or refunded, have no ready date and no briefing any more: they get one status
 * sentence instead. "The briefing is sent" is only said when one was sent.
 */

export type OrderStatus = "paid" | "awaiting_briefing" | "queued" | "in_progress" | "delivered" | "revision_requested" | "completed" | "refunded" | "withdrawn";

export interface OrderView {
  /** Show "Ready by …". */
  due: boolean;
  /** The status sentence shown in place of the ready date. */
  note: "withdrawalPending" | "ended" | null;
  /** The briefing section: the form, the note that it was sent, or no section at all. */
  briefing: "form" | "sent" | "none";
}

export function orderView(order: { status: OrderStatus; briefed: boolean; withdrawalPending: boolean }): OrderView {
  if (order.status === "refunded" || order.status === "withdrawn") return { due: false, note: "ended", briefing: "none" };
  if (order.withdrawalPending) return { due: false, note: "withdrawalPending", briefing: "none" };
  if (order.briefed) return { due: true, note: null, briefing: "sent" };
  const open = order.status === "paid" || order.status === "awaiting_briefing";
  return { due: true, note: null, briefing: open ? "form" : "none" };
}
