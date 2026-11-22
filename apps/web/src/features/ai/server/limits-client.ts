import type { Json } from "@/lib/supabase/database.types";
import { serviceSupabase, type Db } from "@/lib/supabase/server";

import type { AiErrorCode } from "../events";
import type { AiRoute } from "../request";

/**
 * The run's book-keeping in the database, through the service-only functions of the AI migration:
 * reserve (quota, address, budget and concurrency in one transaction), progress, the stop flag,
 * settle (status, cost, counted, the draft) and the kill switch. Injected into the pipeline, so tests
 * run without a database.
 */

export type ReserveRefusal = "disabled" | "budget" | "busy" | "quota" | "ip" | "failures";

export type ReserveResult =
  | { ok: true; id: string; plan: "free" | "pro" | "team"; allowance: number | null; used: number | null; left: number | null }
  | { ok: false; reason: ReserveRefusal };

/** Content-free progress for a reconnecting or polling client. */
export interface ProgressEntry {
  key: string;
  state: string;
  count?: number;
  ms?: number;
}

/** Column names of `ai_runs` (see `ai_settle_run`). */
export interface SettleDetails {
  model?: string | null;
  served_by?: string | null;
  effort?: string | null;
  stop_reason?: string | null;
  error_code?: AiErrorCode | "stale" | null;
  calls: number;
  sources?: number;
  blocks?: number;
  dropped?: number;
  fixed?: number;
  ms_sources?: number;
  ms_model?: number;
  ms_total?: number;
  input_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  output_tokens?: number;
}

export interface LimitsClient {
  reserve: (input: {
    account: string;
    ipHash: string;
    route: AiRoute;
    worstMicros: number;
    promptVersion: string;
    schemaVersion: string;
    actor?: string;
    order?: string;
  }) => Promise<ReserveResult>;
  recordProgress: (run: string, progress: ProgressEntry[]) => Promise<void>;
  stopRequested: (run: string) => Promise<boolean>;
  settle: (input: { run: string; status: "succeeded" | "stopped" | "failed" | "refused"; counted: boolean; costMicros: number; details: SettleDetails; draft: Json | null }) => Promise<void>;
  disable: (reason: string) => Promise<void>;
}

const REFUSALS = new Set<string>(["disabled", "budget", "busy", "quota", "ip", "failures"]);

const asReserveResult = (data: Json): ReserveResult => {
  const record = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  if (record.ok === true && typeof record.id === "string") {
    const plan = record.plan === "pro" || record.plan === "team" ? record.plan : "free";
    const number = (value: Json | undefined) => (typeof value === "number" ? value : null);
    return { ok: true, id: record.id, plan, allowance: number(record.allowance), used: number(record.used), left: number(record.left) };
  }
  const reason = typeof record.reason === "string" && REFUSALS.has(record.reason) ? (record.reason as ReserveRefusal) : "disabled";
  return { ok: false, reason };
};

export function createLimitsClient(db: Db = serviceSupabase()): LimitsClient {
  return {
    async reserve(input) {
      const { data, error } = await db.rpc("ai_reserve_run", {
        account: input.account,
        ip_hash: input.ipHash,
        route: input.route,
        worst_micros: input.worstMicros,
        prompt_version: input.promptVersion,
        schema_version: input.schemaVersion,
        ...(input.actor ? { actor: input.actor } : {}),
        ...(input.order ? { target_order: input.order } : {}),
      });
      if (error) throw new Error(`ai_reserve_run failed (${error.code})`);
      return asReserveResult(data);
    },
    async recordProgress(run, progress) {
      const { error } = await db.rpc("ai_record_progress", { run, progress: progress as unknown as Json });
      if (error) throw new Error(`ai_record_progress failed (${error.code})`);
    },
    async stopRequested(run) {
      const { data, error } = await db.rpc("ai_stop_requested", { run });
      if (error) throw new Error(`ai_stop_requested failed (${error.code})`);
      return data;
    },
    async settle(input) {
      const { error } = await db.rpc("ai_settle_run", {
        run: input.run,
        next_status: input.status,
        is_counted: input.counted,
        cost: input.costMicros,
        details: input.details as unknown as Json,
        ...(input.draft === null ? {} : { draft: input.draft }),
      });
      if (error) throw new Error(`ai_settle_run failed (${error.code})`);
    },
    async disable(reason) {
      const { error } = await db.rpc("ai_disable", { reason });
      if (error) throw new Error(`ai_disable failed (${error.code})`);
    },
  };
}
