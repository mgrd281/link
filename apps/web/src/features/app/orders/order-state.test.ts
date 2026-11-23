import { describe, expect, it } from "vitest";

import { orderView, type OrderStatus } from "./order-state";

const order = (status: OrderStatus, extra: { briefed?: boolean; withdrawalPending?: boolean } = {}) => ({ status, briefed: false, withdrawalPending: false, ...extra });

describe("what the order screen says", () => {
  it("asks for the briefing while the order waits for it, with the ready date", () => {
    expect(orderView(order("paid"))).toEqual({ due: true, note: null, briefing: "form" });
    expect(orderView(order("awaiting_briefing"))).toEqual({ due: true, note: null, briefing: "form" });
  });

  it("says the briefing is sent only when one was sent", () => {
    expect(orderView(order("queued", { briefed: true }))).toEqual({ due: true, note: null, briefing: "sent" });
    expect(orderView(order("delivered", { briefed: true })).briefing).toBe("sent");
    // Never briefed and no longer open: no claim that a briefing was sent.
    expect(orderView(order("in_progress")).briefing).toBe("none");
  });

  it("promises no ready date and claims no briefing while a withdrawal is being handled", () => {
    expect(orderView(order("paid", { withdrawalPending: true }))).toEqual({ due: false, note: "withdrawalPending", briefing: "none" });
    expect(orderView(order("queued", { briefed: true, withdrawalPending: true }))).toEqual({ due: false, note: "withdrawalPending", briefing: "none" });
  });

  it("promises no ready date and claims no briefing for a withdrawn or refunded order", () => {
    for (const status of ["withdrawn", "refunded"] as const) {
      expect(orderView(order(status)), status).toEqual({ due: false, note: "ended", briefing: "none" });
      expect(orderView(order(status, { briefed: true, withdrawalPending: true })), status).toEqual({ due: false, note: "ended", briefing: "none" });
    }
  });
});
