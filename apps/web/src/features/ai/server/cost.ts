import type { BetaUsage } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { INPUT_TOKENS_ESTIMATE, WORST_INPUT_USD_PER_MTOK, WORST_OUTPUT_USD_PER_MTOK } from "../limits";

/**
 * What a call cost, in micro-dollars (tokens × USD per million tokens = micro-dollars), from the
 * usage the API reports. Every attempt of the call is billed: after a refusal the first model's
 * attempt (its input, and whatever it wrote before it declined) and the fallback model's attempt
 * both are, each at its own model's prices. `usage.iterations` lists the attempts; the top-level
 * numbers cover only the attempt that produced the returned message, so they are used only when
 * there is no such list. A model we have no price for (a "default" fallback) costs the highest price.
 * limits.ts reserves the worst case before a run; settling replaces it with this.
 */

export interface Price {
  /** USD per million input tokens. */
  in: number;
  out: number;
  cacheRead: number;
  /** 5-minute cache writes. */
  cacheWrite: number;
}

export const PRICES = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  default: { in: 5, out: 25, cacheRead: 0.5, cacheWrite: 6.25 },
} as const satisfies Record<string, Price>;

export type UsageLike = Pick<BetaUsage, "input_tokens" | "output_tokens"> & Partial<Pick<BetaUsage, "cache_read_input_tokens" | "cache_creation_input_tokens" | "iterations">>;

/** Tokens of one call, as the run log and `ai_runs` store them. */
export interface TokenCounts {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

export const priceOf = (model: string): Price => (model === "claude-opus-5-5" ? PRICES["claude-opus-5-5"] : PRICES.default);

type Counted = Pick<BetaUsage, "input_tokens" | "output_tokens"> & { cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

const priced = (price: Price, usage: Counted): number =>
  usage.input_tokens * price.in + usage.output_tokens * price.out + (usage.cache_read_input_tokens ?? 0) * price.cacheRead + (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite;

/** The attempts of a call when the API lists them, else null (then the top-level numbers are the call). */
const attemptsOf = (usage: Pick<UsageLike, "iterations">) => (usage.iterations?.length ? usage.iterations : null);

/** `model`: the model of the returned message (`message.model`), for attempts that do not name theirs. */
export function costMicros(model: string, usage: UsageLike): number {
  const attempts = attemptsOf(usage);
  if (!attempts) return Math.ceil(priced(priceOf(model), usage));
  let total = 0;
  for (const attempt of attempts) total += priced(priceOf(("model" in attempt ? attempt.model : null) ?? model), attempt);
  return Math.ceil(total);
}

/** The tokens of every attempt together (what was billed), not only of the one that answered. */
export function tokenCounts(usage: UsageLike): TokenCounts {
  const attempts: readonly Counted[] = attemptsOf(usage) ?? [usage];
  const counts: TokenCounts = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  for (const attempt of attempts) {
    counts.input += attempt.input_tokens;
    counts.cacheRead += attempt.cache_read_input_tokens ?? 0;
    counts.cacheWrite += attempt.cache_creation_input_tokens ?? 0;
    counts.output += attempt.output_tokens;
  }
  return counts;
}

/** Did a fallback model serve the answer? (Its entry in `usage.iterations`; the reliable signal.) */
export function servedByFallback(usage: Pick<UsageLike, "iterations">): boolean {
  return (usage.iterations ?? []).some((entry) => entry.type === "fallback_message");
}

// ── A stream that was cut off ────────────────────────────────────────────────

/**
 * What the API had said when a stream was cut off (a stop, or the run's deadline): the input side
 * of the answer's `message_start`, and how many attempts had begun (1, plus one per fallback).
 */
export interface CutOffCall {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  attempts: number;
}

/**
 * No model writes faster than this, thinking included (tokens per second; today's fastest modes
 * stay well under it). A stream cut off after t seconds has written at most this × t.
 */
export const OUTPUT_TOKENS_PER_SECOND_MAX = 300;

/**
 * The most a cut-off stream can have cost. Its final usage never arrives, so this is a bound, at the
 * highest prices: the input it reported (again for every fallback attempt), plus the output it can have written in
 * the time it ran, never more than the call's cap. Cut off before the answer began (`started` null):
 * the input estimate, and no output. Booking the whole cap instead ($0.525 for a draft) made a
 * handful of early stops, each worth a few cents, use up the day's budget for everyone.
 */
export function cutOffCostMicros(call: { started: CutOffCall | null; elapsedMs: number; maxTokens: number }): number {
  const { started } = call;
  if (!started) return Math.ceil(INPUT_TOKENS_ESTIMATE * WORST_INPUT_USD_PER_MTOK);
  const worst = PRICES.default;
  // A fallback model cannot read the first model's cache: its attempt pays for all of the input.
  const again = (Math.max(1, started.attempts) - 1) * (started.input + started.cacheRead + started.cacheWrite) * WORST_INPUT_USD_PER_MTOK;
  const input = started.input * worst.in + started.cacheRead * worst.cacheRead + started.cacheWrite * worst.cacheWrite + again;
  const output = Math.min(call.maxTokens, Math.ceil((Math.max(0, call.elapsedMs) / 1000) * OUTPUT_TOKENS_PER_SECOND_MAX));
  return Math.ceil(input + output * WORST_OUTPUT_USD_PER_MTOK);
}
