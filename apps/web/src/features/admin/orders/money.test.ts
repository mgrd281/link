import { describe, expect, it } from "vitest";

import { inBatches, ordersForRevenue } from "./money";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-24T12:00:00Z");
const order = (id: string, daysAgo: number, status: string) => ({ id, orderedAt: new Date(NOW - daysAgo * DAY).toISOString(), status });

describe("the orders the revenue tile reads", () => {
  it("takes the six months, and refunds only of orders recent enough to land in them", () => {
    const queue = [
      order("recent", 10, "delivered"),
      order("edge", 186, "completed"),
      order("old-paid", 200, "completed"),
      // Refunded or withdrawn a little before the window: the refund may fall into it.
      order("refund-late", 230, "refunded"),
      order("withdrawn-late", 270, "withdrawn"),
      // Refunded years ago: never part of the six months, and never read again.
      order("refund-old", 400, "refunded"),
      order("withdrawn-old", 900, "withdrawn"),
    ];
    expect(ordersForRevenue(queue, NOW).map((entry) => entry.id)).toEqual(["recent", "edge", "refund-late", "withdrawn-late"]);
  });

  it("reads the records a few at a time, in order", async () => {
    let running = 0;
    let most = 0;
    const read = async (value: number) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
      return value * 2;
    };
    const values = Array.from({ length: 20 }, (_, index) => index);
    expect(await inBatches(values, 6, read)).toEqual(values.map((value) => value * 2));
    expect(most).toBeLessThanOrEqual(6);
  });
});
