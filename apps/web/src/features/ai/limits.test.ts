import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACCOUNT_CONCURRENCY,
  DAILY_BUDGET_MICROS,
  DRAFT_DAYS,
  FREE_DRAFTS,
  GLOBAL_CONCURRENCY,
  INPUT_TOKENS_ESTIMATE,
  IP_RUNS_PER_DAY,
  MAX_CALLS,
  MAX_TOKENS,
  PRO_DRAFTS_PER_MONTH,
  REPAIR_MAX_TOKENS,
  reserveMicros,
  RUN_LOG_DAYS,
  UNCOUNTED_FAILURES_PER_DAY,
  WORST_INPUT_USD_PER_MTOK,
  WORST_OUTPUT_USD_PER_MTOK,
} from "./limits";

/** The migration that creates public.ai_settings and public.ai_cleanup(). */
const MIGRATION = readFileSync(path.resolve(import.meta.dirname, "../../../../../supabase/migrations/20261123100300_ai.sql"), "utf8");

/** The `create table public.ai_settings (…);` statement. */
const SETTINGS_TABLE = /create table public\.ai_settings \(([\s\S]*?)\n\);/.exec(MIGRATION)?.[1] ?? "";

/** A column's default in public.ai_settings, as a number. */
function settingDefault(column: string): number {
  const match = new RegExp(`^\\s*${column} \\w+ not null default (\\d+)`, "m").exec(SETTINGS_TABLE);
  return match ? Number(match[1]) : Number.NaN;
}

/** A function's body in the migration (between its $$ quotes). */
function sqlBody(signature: string): string {
  const start = MIGRATION.indexOf(`create function public.${signature}`);
  const open = MIGRATION.indexOf("$$", start);
  return start < 0 || open < 0 ? "" : MIGRATION.slice(open + 2, MIGRATION.indexOf("$$", open + 2));
}

describe("AI limits", () => {
  it("the database starts with the same limits", () => {
    expect(SETTINGS_TABLE).not.toBe("");
    expect({
      free_drafts: settingDefault("free_drafts"),
      pro_drafts_per_month: settingDefault("pro_drafts_per_month"),
      ip_runs_per_day: settingDefault("ip_runs_per_day"),
      daily_budget_micros: settingDefault("daily_budget_micros"),
      account_concurrency: settingDefault("account_concurrency"),
      global_concurrency: settingDefault("global_concurrency"),
      uncounted_failures_per_day: settingDefault("uncounted_failures_per_day"),
    }).toEqual({
      free_drafts: FREE_DRAFTS,
      pro_drafts_per_month: PRO_DRAFTS_PER_MONTH,
      ip_runs_per_day: IP_RUNS_PER_DAY,
      daily_budget_micros: DAILY_BUDGET_MICROS,
      account_concurrency: ACCOUNT_CONCURRENCY,
      global_concurrency: GLOBAL_CONCURRENCY,
      uncounted_failures_per_day: UNCOUNTED_FAILURES_PER_DAY,
    });
    expect(/^\s*enabled boolean not null default true/m.test(SETTINGS_TABLE)).toBe(true);
  });

  it("and keeps drafts and the run log as long as the app says", () => {
    const cleanup = sqlBody("ai_cleanup()");
    expect(cleanup).toContain(`set result = null where r.result is not null and r.created_at < now() - interval '${String(DRAFT_DAYS)} days'`);
    expect(cleanup).toContain(`delete from public.ai_runs r where r.created_at < now() - interval '${String(RUN_LOG_DAYS)} days'`);
  });

  it("has the agreed numbers", () => {
    expect([FREE_DRAFTS, PRO_DRAFTS_PER_MONTH, IP_RUNS_PER_DAY, ACCOUNT_CONCURRENCY, GLOBAL_CONCURRENCY, UNCOUNTED_FAILURES_PER_DAY]).toEqual([1, 5, 5, 1, 10, 3]);
    expect(DAILY_BUDGET_MICROS).toBe(10_000_000);
    expect([DRAFT_DAYS, RUN_LOG_DAYS]).toEqual([7, 30]);
    expect(MAX_TOKENS).toEqual({ welcome: 16_000, dashboard: 16_000, team: 32_000 });
    expect(REPAIR_MAX_TOKENS).toBeLessThan(MAX_TOKENS.welcome);
  });

  it("reserves every call at its cap and the worst prices", () => {
    expect(reserveMicros("welcome")).toBe(1_050_000);
    expect(reserveMicros("dashboard")).toBe(1_050_000);
    expect(reserveMicros("team")).toBe(1_850_000);
    expect(reserveMicros("team")).toBe(
      Math.ceil(MAX_CALLS * (MAX_TOKENS.team * WORST_OUTPUT_USD_PER_MTOK + INPUT_TOKENS_ESTIMATE * WORST_INPUT_USD_PER_MTOK)),
    );
    for (const value of [reserveMicros("welcome"), reserveMicros("dashboard"), reserveMicros("team")]) expect(Number.isInteger(value)).toBe(true);
  });

  it("lets several runs a day fit the budget", () => {
    expect(Math.floor(DAILY_BUDGET_MICROS / reserveMicros("welcome"))).toBeGreaterThanOrEqual(GLOBAL_CONCURRENCY - 1);
    expect(reserveMicros("team")).toBeLessThan(DAILY_BUDGET_MICROS);
  });
});
