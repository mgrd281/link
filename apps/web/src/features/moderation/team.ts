"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { refreshLive } from "@/features/admin/live";
import { adminStore } from "@/features/admin/store";
import type { ActivityEvent } from "@/features/admin/types";
import { accessToken } from "@/lib/supabase/access-token";
import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/config";
import { fromJson } from "@/lib/supabase/json";

import { SAMPLES } from "./sample";
import type { DecideAnswer, DecideError, Decision, Ground, InForce, ModerationTarget, Report, YearCounts } from "./types";

/*
 * The team console's side of notice and action.
 * - Real accounts: team-only database functions read the queue (`admin_reports`, each checks
 *   `reports.manage`); decisions go through our server (`/api/admin/moderation`), which decides as the
 *   member, drops the cached page and sends the e-mails. A database without the functions reads as
 *   `unavailable`: the screen and the badge say so or stay hidden, never a 0.
 * - Demo: made-up reports (sample.ts) in this browser's memory; decisions change them and the demo
 *   activity log, and nothing is sent.
 */

export type LoadStatus = "loading" | "ready" | "error" | "unavailable";

const missingFunction = (error: { code?: string | undefined; message?: string | undefined }) =>
  error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");

// ── What changed: every hook here reloads after an action ──────────────────────────────────────
let revision = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getRevision = () => revision;
function changed() {
  revision += 1;
  for (const listener of listeners) listener();
}

// ── Demo ────────────────────────────────────────────────────────────────────────────────────────
interface DemoState {
  reports: Report[];
  targets: Map<string, ModerationTarget>;
}
let demo: DemoState | null = null;
function demoState(): DemoState {
  if (!demo) {
    const now = Date.now();
    demo = {
      reports: SAMPLES.map((sample) => sample.report(now)),
      targets: new Map(SAMPLES.flatMap((sample) => (sample.target ? [[sample.target.id, structuredClone(sample.target)] as const] : []))),
    };
  }
  return demo;
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────
function useLoad<T>(load: (() => Promise<{ status: LoadStatus; data: T | null }>) | null, key: string): { status: LoadStatus; data: T | null; reload: () => void } {
  const shared = useSyncExternalStore(subscribe, getRevision, getRevision);
  const [own, setOwn] = useState(0);
  const [state, setState] = useState<{ key: string; status: LoadStatus; data: T | null }>({ key, status: "loading", data: null });
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then(
      (answer) => {
        if (live) setState({ key, ...answer });
      },
      () => {
        if (live) setState((current) => ({ key, status: "error", data: current.key === key ? current.data : null }));
      },
    );
    return () => {
      live = false;
    };
    // `shared` and `own` are the reasons to load again.
  }, [load, key, shared, own]);
  const current = state.key === key ? state : { status: "loading" as const, data: null };
  return { status: load ? current.status : "unavailable", data: current.data, reload: () => setOwn((count) => count + 1) };
}

/** A team function's answer: ready with its JSON, `unavailable` on a database without it, or a thrown error. */
async function rpc(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<{ status: LoadStatus; data: unknown }> {
  const { data, error } = await call;
  if (error) {
    if (missingFunction(error)) return { status: "unavailable", data: null };
    throw new Error(error.message);
  }
  return { status: "ready", data: fromJson(data as never) };
}

interface Loaded<T> {
  status: LoadStatus;
  data: T | null;
}

const liveReports = (state: "open" | "decided") => async () => (await rpc(browserSupabase().rpc("admin_reports", { state, max_rows: 200 }))) as Loaded<Report[]>;
const LIVE = { open: liveReports("open"), decided: liveReports("decided") } as const;
const demoReports = (state: "open" | "decided") => () => Promise.resolve({ status: "ready" as const, data: demoState().reports.filter((report) => report.state === state) });
const DEMO = { open: demoReports("open"), decided: demoReports("decided") } as const;

/** The queue (`open`, oldest first) or the decided reports (newest first). `enabled` false asks nothing. */
export function useReports(state: "open" | "decided", enabled = true): { status: LoadStatus; reports: Report[]; reload: () => void } {
  const source = supabaseEnabled ? LIVE : DEMO;
  const { status, data, reload } = useLoad(enabled ? source[state] : null, state);
  return { status, reports: data ?? [], reload };
}

/** One account's blocks and restrictions in force (null id: nothing to load). */
export function useModerationTarget(customerId: string | null): { status: LoadStatus; target: ModerationTarget | null } {
  const load = useMemo(() => {
    if (!customerId) return null;
    if (supabaseEnabled) return async () => (await rpc(browserSupabase().rpc("admin_moderation_target", { customer: customerId }))) as Loaded<ModerationTarget>;
    return () => Promise.resolve({ status: "ready" as const, data: demoState().targets.get(customerId) ?? null });
  }, [customerId]);
  const { status, data } = useLoad(load, customerId ?? "");
  return { status, target: data };
}

const liveCounts = async () => (await rpc(browserSupabase().rpc("admin_moderation_counts", {}))) as Loaded<YearCounts>;
function demoCounts(): Promise<{ status: LoadStatus; data: YearCounts }> {
  const { reports } = demoState();
  const byAction: YearCounts["byAction"] = {};
  const byCategory: YearCounts["byCategory"] = {};
  for (const report of reports) byCategory[report.category] = (byCategory[report.category] ?? 0) + 1;
  for (const report of reports) if (report.decision) byAction[report.decision.action] = (byAction[report.decision.action] ?? 0) + 1;
  const decided = reports.filter((report) => report.decidedAt);
  const hours = decided.map((report) => (Date.parse(report.decidedAt ?? "") - Date.parse(report.receivedAt)) / 3_600_000).sort((a, b) => a - b);
  const middle = hours.length ? (hours.length % 2 ? (hours[(hours.length - 1) / 2] ?? 0) : ((hours[hours.length / 2 - 1] ?? 0) + (hours[hours.length / 2] ?? 0)) / 2) : null;
  return Promise.resolve({
    status: "ready",
    data: {
      year: new Date().getFullYear(),
      received: reports.length,
      byCategory,
      byAction,
      byGround: {},
      fromReports: decided.length,
      lifted: 0,
      medianHours: middle === null ? null : Math.round(middle * 10) / 10,
      openNow: reports.length - decided.length,
    },
  });
}

/** This year's figures (the transparency count). */
export function useYearCounts(enabled = true): { status: LoadStatus; counts: YearCounts | null } {
  const { status, data } = useLoad(enabled ? (supabaseEnabled ? liveCounts : demoCounts) : null, "year");
  return { status, counts: data };
}

// ── Writing ─────────────────────────────────────────────────────────────────────────────────────
export interface DecideRequest {
  decision: Decision;
  report: Report | null;
  customer: string | null;
  reason: string;
  ground: Ground | null;
  block: string | null;
  /** Who decides (the demo log). */
  actor: string;
}

const KNOWN_ERRORS = new Set<DecideError>([
  "invalid",
  "unauthorized",
  "forbidden",
  "notFound",
  "alreadyDecided",
  "alreadyDone",
  "blockNotFound",
  "mismatch",
  "notYourself",
  "unavailable",
  "server",
]);

const AUDIT: Record<Decision, ActivityEvent["action"]> = {
  hide_block: "moderation.hide",
  unpublish: "moderation.unpublish",
  suspend: "customer.suspend",
  dismiss: "report.dismiss",
};

function decideInDemo(request: DecideRequest): DecideAnswer {
  const state = demoState();
  const report = request.report ? state.reports.find((item) => item.id === request.report?.id) : undefined;
  if (request.report && report?.state !== "open") return { ok: false, error: "alreadyDecided" };
  const target = request.customer ? state.targets.get(request.customer) : undefined;
  const now = new Date().toISOString();
  // One id for the decision and the restriction it put in force, as in the database.
  const id = crypto.randomUUID();
  let blockLabel: string | null = null;
  if (request.decision !== "dismiss") {
    if (!target) return { ok: false, error: "notFound" };
    if (request.decision === "hide_block") {
      const block = target.blocks.find((item) => item.id === request.block);
      if (!block) return { ok: false, error: "blockNotFound" };
      if (block.hidden) return { ok: false, error: "alreadyDone" };
      block.hidden = true;
      blockLabel = block.label;
    }
    if (target.inForce.some((item) => item.action === request.decision && (request.decision !== "hide_block" || item.blockId === request.block))) return { ok: false, error: "alreadyDone" };
    const entry: InForce = {
      id,
      action: request.decision,
      blockId: request.block,
      blockLabel,
      ground: request.ground ?? "terms",
      reason: request.reason,
      at: now,
      report: report?.id ?? null,
    };
    target.inForce = [entry, ...target.inForce];
    if (request.decision === "suspend") target.status = "suspended";
  }
  if (report) {
    report.state = "decided";
    report.decidedAt = now;
    report.decision = { id, action: request.decision, ground: request.ground, reason: request.reason, blockLabel, at: now, by: request.actor, liftedAt: null };
    if (report.account) {
      report.account = { ...report.account, status: target?.status ?? report.account.status, offline: target?.inForce.some((item) => item.action === "unpublish") ?? false };
    }
  }
  adminStore.record(request.actor, AUDIT[request.decision], target?.username ?? report?.page ?? "");
  changed();
  return { ok: true, creatorMailed: false, reporterMailed: false };
}

async function bearerPost(path: string, body: unknown): Promise<Response | null> {
  const token = await accessToken();
  if (!token) return null;
  try {
    return await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch {
    return null;
  }
}

async function readAnswer(response: Response | null): Promise<DecideAnswer> {
  if (!response) return { ok: false, error: "server" };
  const data = (await response.json().catch(() => null)) as { ok?: unknown; error?: unknown; creatorMailed?: unknown; reporterMailed?: unknown } | null;
  if (response.ok && data?.ok === true) return { ok: true, creatorMailed: data.creatorMailed === true, reporterMailed: data.reporterMailed === true };
  const error = typeof data?.error === "string" && KNOWN_ERRORS.has(data.error as DecideError) ? (data.error as DecideError) : "server";
  return { ok: false, error };
}

export const moderationTeam = {
  /** One decision. Real accounts: through our server (the database, the page cache, the e-mails). */
  async decide(request: DecideRequest): Promise<DecideAnswer> {
    if (!supabaseEnabled) return decideInDemo(request);
    const answer = await readAnswer(
      await bearerPost("/api/admin/moderation", {
        decision: request.decision,
        reason: request.reason,
        ...(request.customer ? { customer: request.customer } : {}),
        ...(request.ground ? { ground: request.ground } : {}),
        ...(request.block ? { block: request.block } : {}),
        ...(request.report ? { report: request.report.id } : {}),
      }),
    );
    if (answer.ok) {
      await refreshLive();
      changed();
    }
    return answer;
  },

  /** Lifts a restriction in force (`decision`: the decision that put it in force). */
  async lift(input: { customer: string; decision: string; action: Exclude<Decision, "dismiss">; reason: string; actor: string; username: string }): Promise<boolean> {
    if (!supabaseEnabled) {
      const state = demoState();
      const target = state.targets.get(input.customer);
      const entry = target?.inForce.find((item) => item.id === input.decision);
      if (!target || !entry) return false;
      target.inForce = target.inForce.filter((item) => item.id !== entry.id);
      if (entry.action === "hide_block") target.blocks = target.blocks.map((block) => (block.id === entry.blockId ? { ...block, hidden: false } : block));
      if (entry.action === "suspend") target.status = "active";
      for (const report of state.reports) {
        if (report.decision?.id !== entry.id) continue;
        report.decision = { ...report.decision, liftedAt: new Date().toISOString() };
        if (report.account) report.account = { ...report.account, status: target.status, offline: target.inForce.some((item) => item.action === "unpublish") };
      }
      adminStore.record(input.actor, entry.action === "suspend" ? "customer.unsuspend" : "moderation.lift", input.username);
      changed();
      return true;
    }
    const response = await bearerPost("/api/admin/moderation/lift", { decision: input.decision, reason: input.reason });
    if (!response?.ok) return false;
    await refreshLive();
    changed();
    return true;
  },
};
