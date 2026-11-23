import { describe, expect, it } from "vitest";

import { DAILY_BUDGET_MICROS, INPUT_TOKENS_ESTIMATE, MAX_TOKENS, reserveMicros, UNCOUNTED_FAILURES_PER_DAY, WORST_INPUT_USD_PER_MTOK, WORST_OUTPUT_USD_PER_MTOK } from "../limits";

import { costMicros, cutOffCostMicros, OUTPUT_TOKENS_PER_SECOND_MAX, priceOf, PRICES, servedByFallback, tokenCounts } from "./cost";

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

  // ai-3: after a refusal both attempts are billed; the top-level usage is the fallback's alone.
  it("prices every attempt of a call by its own model: the declined one and the fallback's", () => {
    const declined = { type: "message" as const, model: "claude-opus-5-5", input_tokens: 5_000, output_tokens: 6_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 3_570, cache_creation: null };
    const fallback = { type: "fallback_message" as const, model: "claude-opus-5", input_tokens: 8_570, output_tokens: 3_200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cache_creation: null };
    const usage = { input_tokens: 8_570, output_tokens: 3_200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, iterations: [declined, fallback] };
    const first = 5_000 * 4 + 6_000 * 20 + 3_570 * 0.2; // 140,714: about $0.14 that used to go unbooked
    const second = 8_570 * 5 + 3_200 * 25;
    expect(costMicros("claude-opus-5", usage)).toBe(first + second);
    expect(costMicros("claude-opus-5", usage)).toBeGreaterThan(costMicros("claude-opus-5", { ...usage, iterations: null }) + 140_000);
    expect(tokenCounts(usage)).toEqual({ input: 13_570, cacheRead: 3_570, cacheWrite: 0, output: 9_200 });
    // An attempt that does not name its model is priced as the message's model; one attempt is the call.
    expect(costMicros("claude-opus-5-5", { ...usage, iterations: [{ ...declined, model: null }] })).toBe(first);
    expect(costMicros("claude-opus-5-5", { input_tokens: 800, output_tokens: 3200, iterations: [] })).toBe(800 * 4 + 3200 * 20);
    expect(tokenCounts({ input_tokens: 800, output_tokens: 3200, cache_read_input_tokens: 3570 })).toEqual({ input: 800, cacheRead: 3570, cacheWrite: 0, output: 3200 });
  });

  // ai-1: a stopped stream used to be booked at the call's cap, $0.525, whatever it had produced.
  it("bounds a cut-off stream by what it can have produced: its input and the output of the time it ran", () => {
    const started = { input: 812, cacheRead: 3_605, cacheWrite: 0, attempts: 1 };
    const input = 812 * 5 + 3_605 * 0.5;
    expect(cutOffCostMicros({ started, elapsedMs: 2_000, maxTokens: 16_000 })).toBe(Math.ceil(input + 2 * OUTPUT_TOKENS_PER_SECOND_MAX * 25));
    expect(cutOffCostMicros({ started, elapsedMs: 0, maxTokens: 16_000 })).toBe(Math.ceil(input));
    // Never more than the cap's output, however long it ran (the run's deadline).
    expect(cutOffCostMicros({ started, elapsedMs: 285_000, maxTokens: 16_000 })).toBe(Math.ceil(input + 16_000 * 25));
    // A fallback attempt pays for the whole input again, uncached.
    expect(cutOffCostMicros({ started: { ...started, attempts: 2 }, elapsedMs: 0, maxTokens: 16_000 })).toBe(Math.ceil(input + (812 + 3_605) * 6.25));
    // Cut off before the answer began: the input estimate, no output.
    expect(cutOffCostMicros({ started: null, elapsedMs: 9_000, maxTokens: 16_000 })).toBe(INPUT_TOKENS_ESTIMATE * WORST_INPUT_USD_PER_MTOK);
    // The bound is at the highest prices, so a price in the table can never exceed it.
    for (const price of Object.values(PRICES)) expect(WORST_OUTPUT_USD_PER_MTOK).toBeGreaterThanOrEqual(price.out);
  });

  it("stops no longer use up the day's budget: every early stop the limits allow 6 accounts leaves room for a run", () => {
    // Six free accounts, each with its three uncounted runs a day, stopping two seconds into the call.
    const stops = 6 * UNCOUNTED_FAILURES_PER_DAY;
    const early = cutOffCostMicros({ started: { input: 6_000, cacheRead: 0, cacheWrite: 4_000, attempts: 1 }, elapsedMs: 2_000, maxTokens: MAX_TOKENS.welcome });
    const beforeTheAnswer = cutOffCostMicros({ started: null, elapsedMs: 2_000, maxTokens: MAX_TOKENS.welcome });
    expect(early).toBeLessThan(100_000);
    for (const stop of [early, beforeTheAnswer]) expect(stops * stop + reserveMicros("welcome")).toBeLessThan(DAILY_BUDGET_MICROS / 2);
    // At the cap ($0.525 each) those 18 stops refused every further run of the day.
    expect(stops * 525_000 + reserveMicros("welcome")).toBeGreaterThan(DAILY_BUDGET_MICROS);
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
