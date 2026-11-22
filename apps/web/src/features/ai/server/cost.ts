import type { BetaUsage } from "@anthropic-ai/sdk/resources/beta/messages/messages";

/**
 * What a call cost, in micro-dollars (tokens × USD per million tokens = micro-dollars), from the
 * usage the API reports. Priced by the model that served the answer (`message.model`): the requested
 * model, or the fallback model that took over after a refusal ("default": the highest fallback price).
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

export const priceOf = (model: string): Price => (model === "claude-opus-5-5" ? PRICES["claude-opus-5-5"] : PRICES.default);

export function costMicros(model: string, usage: UsageLike): number {
  const price = priceOf(model);
  const total =
    usage.input_tokens * price.in + usage.output_tokens * price.out + (usage.cache_read_input_tokens ?? 0) * price.cacheRead + (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite;
  return Math.ceil(total);
}

/** Did a fallback model serve the answer? (Its entry in `usage.iterations`; the reliable signal.) */
export function servedByFallback(usage: Pick<UsageLike, "iterations">): boolean {
  return (usage.iterations ?? []).some((entry) => entry.type === "fallback_message");
}
