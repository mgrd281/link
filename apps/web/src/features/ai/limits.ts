/**
 * The AI builder's limits. The first block mirrors the defaults of public.ai_settings and the
 * retention of public.ai_cleanup() (supabase/migrations/20261123100300_ai.sql); limits.test.ts reads
 * the migration and compares, so the two never drift. The team changes the live values in the
 * database; these are what a fresh database starts with.
 */

/** Counted drafts a free account gets, for life. */
export const FREE_DRAFTS = 1;
/** Counted drafts per calendar month (Europe/Berlin) with Pro. */
export const PRO_DRAFTS_PER_MONTH = 5;
/** Runs per day from one address (daily-salted hash), whatever the account. */
export const IP_RUNS_PER_DAY = 5;
/** What all runs together may cost per Berlin day, in micro-dollars ($10). */
export const DAILY_BUDGET_MICROS = 10_000_000;
/** Runs at the same time per account, and overall. */
export const ACCOUNT_CONCURRENCY = 1;
export const GLOBAL_CONCURRENCY = 10;
/** Failed, refused or empty-stopped runs per account and day; they never count, but they are capped. */
export const UNCOUNTED_FAILURES_PER_DAY = 3;
/** A draft is kept 7 days, the content-free run log 30 days. */
export const DRAFT_DAYS = 7;
export const RUN_LOG_DAYS = 30;

/**
 * Output cap per call, by route (thinking counts toward it). Self-serve runs are capped lower than
 * the team's, whose drafts are longer.
 */
export const MAX_TOKENS = { welcome: 16_000, dashboard: 16_000, team: 32_000 } as const;

export type AiLimitRoute = keyof typeof MAX_TOKENS;

/** Output cap of the parse-repair call (effort "low"). */
export const REPAIR_MAX_TOKENS = 8_000;
/** System prompt + catalogue + example + user turn, per call (an estimate, rounded up). */
export const INPUT_TOKENS_ESTIMATE = 20_000;
/** The highest output price (USD per million tokens) of the model and any "default" fallback. */
export const WORST_OUTPUT_USD_PER_MTOK = 25;
/** The highest input-side price (cache write) of the same set. */
export const WORST_INPUT_USD_PER_MTOK = 6.25;
/** A run makes at most two calls: the draft, and one follow-up or repair. */
export const MAX_CALLS = 2;

/**
 * What a run reserves from the day's budget before it starts, in micro-dollars: every call at its
 * output cap and the input estimate, at the worst prices. Settling replaces it with the real cost.
 * (tokens × USD per million tokens = micro-dollars.)
 */
export function reserveMicros(route: AiLimitRoute): number {
  return Math.ceil(MAX_CALLS * (MAX_TOKENS[route] * WORST_OUTPUT_USD_PER_MTOK + INPUT_TOKENS_ESTIMATE * WORST_INPUT_USD_PER_MTOK));
}
