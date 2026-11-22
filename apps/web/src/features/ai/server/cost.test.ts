import { describe, expect, it } from "vitest";

import { WORST_INPUT_USD_PER_MTOK, WORST_OUTPUT_USD_PER_MTOK } from "../limits";

import { costMicros, priceOf, PRICES, servedByFallback } from "./cost";

describe("cost", () => {
  it("prices usage in micro-dollars by the model that served the answer", () => {
    const usage = { input_tokens: 800, output_tokens: 3200, cache_read_input_tokens: 3570, cache_creation_input_tokens: 0 };
    // 800 × 4 + 3,200 × 20 + 3,570 × 0.2 = 3,200 + 64,000 + 714
    expect(costMicros("claude-opus-5-5", usage)).toBe(67_914);
    // A fallback model is priced at the "default" (highest) prices.
    expect(costMicros("claude-opus-5", usage)).toBe(800 * 5 + 3200 * 25 + 3570 * 0.5);
    expect(costMicros("claude-opus-5-5", { input_tokens: 800, output_tokens: 0, cache_creation_input_tokens: 3570 })).toBe(800 * 4 + 3570 * 5);
    expect(priceOf("anything-else")).toBe(PRICES.default);
  });

  it("knows a fallback served the answer from usage.iterations", () => {
    expect(servedByFallback({ iterations: null })).toBe(false);
    expect(servedByFallback({ iterations: [{ type: "message", model: "claude-opus-5-5", input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cache_creation: null }] })).toBe(false);
    expect(
      servedByFallback({
        iterations: [{ type: "fallback_message", model: "claude-opus-5", input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cache_creation: null }],
      }),
    ).toBe(true);
  });

  it("reserves at least the highest price of the table (limits.ts), so a price change cannot undercut the budget", () => {
    for (const price of Object.values(PRICES)) {
      expect(WORST_OUTPUT_USD_PER_MTOK).toBeGreaterThanOrEqual(price.out);
      expect(WORST_INPUT_USD_PER_MTOK).toBeGreaterThanOrEqual(Math.max(price.in, price.cacheWrite, price.cacheRead));
    }
  });
});
