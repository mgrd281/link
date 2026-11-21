"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { LocalAccountStore, STORAGE_KEY } from "@/features/account/local-store";
import { accountStore } from "@/features/account/store";
import { overrides } from "@/features/admin/customers/overrides";
import { refreshLive } from "@/features/admin/live";
import { adminStore } from "@/features/admin/store";
import type { ActivityEvent } from "@/features/admin/types";
import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/config";
import type { Json } from "@/lib/supabase/database.types";
import { fromJson } from "@/lib/supabase/json";

import type { CustomerReferrals, DeclineReason, ReferralQueue, RewardKind } from "./types";

/*
 * The team console's side of the invite program (ADR 0064).
 * - Real accounts: team-only database functions (each checks the permission and writes the activity
 *   log), then the console reloads (refreshLive) and so does everything shown here.
 * - Demo: the demo store's team methods on the accounts in this browser, then the console's demo
 *   activity log. Approving also gives the badge in the demo customer list.
 * Every action answers whether it worked.
 */

type LoadStatus = "loading" | "ready" | "error";

const EMPTY_QUEUE: ReferralQueue = { verifications: [], held: [], rewards: [] };
const noop = () => undefined;

/** The demo store, when this build runs without real accounts. */
const demoStore = accountStore instanceof LocalAccountStore ? accountStore : null;

// ── What changed: actions bump it, every hook here reloads ─────────────────────────────────────
let revision = 0;
const revisionListeners = new Set<() => void>();
const subscribeRevision = (listener: () => void) => {
  revisionListeners.add(listener);
  return () => {
    revisionListeners.delete(listener);
  };
};
const getRevision = () => revision;
function changed() {
  revision += 1;
  for (const listener of revisionListeners) listener();
}

/** Demo: the raw stored accounts, read whenever they change (this tab or another). */
const readDemo = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};
function useDemoRaw(): string {
  return useSyncExternalStore((listener) => accountStore.subscribe(listener), readDemo, () => "");
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────

/** Loads `load()` on mount, after every action here and on `reload()`; a reload keeps the data on screen. */
function useLive<T>(load: (() => Promise<T>) | null, key: string): { status: LoadStatus; data: T | null; reload: () => void } {
  const shared = useSyncExternalStore(subscribeRevision, getRevision, getRevision);
  const [own, setOwn] = useState(0);
  const [state, setState] = useState<{ key: string; status: LoadStatus; data: T | null }>({ key, status: "loading", data: null });
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then(
      (data) => {
        if (live) setState({ key, status: "ready", data });
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
  return { status: current.status, data: current.data, reload: () => setOwn((count) => count + 1) };
}

/** A team function's JSON answer, or a thrown error (the screen then offers to try again). */
async function rpcJson<T>(call: PromiseLike<{ data: Json | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(error.message);
  return fromJson<T>(data);
}

const loadQueue = () => rpcJson<ReferralQueue | null>(browserSupabase().rpc("admin_referral_queue")).then((queue) => queue ?? EMPTY_QUEUE);

function useLiveQueue(): { status: LoadStatus; queue: ReferralQueue; reload(): void } {
  const { status, data, reload } = useLive(loadQueue, "queue");
  return { status, queue: data ?? EMPTY_QUEUE, reload };
}

function useDemoQueue(): { status: LoadStatus; queue: ReferralQueue; reload(): void } {
  const raw = useDemoRaw();
  const queue = useMemo(() => (raw && demoStore ? demoStore.teamQueue() : EMPTY_QUEUE), [raw]);
  return { status: "ready", queue, reload: noop };
}

/** Open verification requests, held invites and every reward, for `/admin/referrals` and the customers list. */
export const useReferralQueue: () => { status: LoadStatus; queue: ReferralQueue; reload(): void } = supabaseEnabled ? useLiveQueue : useDemoQueue;

function useLiveCustomer(customerId: string): { status: LoadStatus; data: CustomerReferrals | null; reload(): void } {
  const load = useMemo(() => () => rpcJson<CustomerReferrals | null>(browserSupabase().rpc("admin_customer_referrals", { customer: customerId })), [customerId]);
  return useLive(load, customerId);
}

function useDemoCustomer(customerId: string): { status: LoadStatus; data: CustomerReferrals | null; reload(): void } {
  const raw = useDemoRaw();
  const data = useMemo(() => (raw && demoStore ? demoStore.teamCustomer(customerId) : null), [raw, customerId]);
  return { status: "ready", data, reload: noop };
}

/** One customer's invites, rewards and verification requests (the customer's Invites tab). */
export const useCustomerReferrals: (customerId: string) => { status: LoadStatus; data: CustomerReferrals | null; reload(): void } = supabaseEnabled
  ? useLiveCustomer
  : useDemoCustomer;

// ── Writing ─────────────────────────────────────────────────────────────────────────────────────

/** The program's entries in the activity log (the database writes the same names on real accounts). */
type ReferralAction =
  | "referral.release"
  | "referral.revoke"
  | "referral.restore"
  | "reward.revoke"
  | "reward.restore"
  | "verification.approve"
  | "verification.decline";

/** Demo: logs a team decision. The console's action list (features/admin/types.ts) names these from the console's own package on. */
const record = (actor: string, action: ReferralAction, target: string) => adminStore.record(actor, action as unknown as ActivityEvent["action"], target);

/** Real accounts: the database decided; reload what the console shows. */
async function done(call: PromiseLike<{ error: unknown }>): Promise<boolean> {
  const { error } = await call;
  if (error) return false;
  await refreshLive();
  changed();
  return true;
}

export const referralTeam: {
  /** Approve (sets the blue check) or decline a verification request. */
  review(input: { requestId: string; customerId: string; target: string; actor: string; decision: "approve" | "decline"; reason?: DeclineReason }): Promise<boolean>;
  /** Count a held invite, or remove one. */
  setReferral(input: { id: string; next: "qualified" | "revoked"; why?: string; actor: string; target: string }): Promise<boolean>;
  /** Give or remove a reward. */
  setReward(input: { customerId: string; kind: RewardKind; granted: boolean; why?: string; actor: string; target: string }): Promise<boolean>;
} = {
  review({ requestId, customerId, target, actor, decision, reason }) {
    if (supabaseEnabled) {
      return done(browserSupabase().rpc("admin_review_verification", { request: requestId, decision, ...(reason ? { reason } : {}) }));
    }
    if (!demoStore?.teamReview(requestId, decision, reason)) return Promise.resolve(false);
    if (decision === "approve") overrides.patch(customerId, { verified: true });
    record(actor, decision === "approve" ? "verification.approve" : "verification.decline", target);
    changed();
    return Promise.resolve(true);
  },

  setReferral({ id, next, why, actor, target }) {
    if (supabaseEnabled) {
      return done(browserSupabase().rpc("admin_set_referral", { referral: id, next_state: next, ...(why ? { why } : {}) }));
    }
    const before = demoStore?.teamSetReferral(id, next) ?? null;
    if (!before) return Promise.resolve(false);
    record(actor, next === "revoked" ? "referral.revoke" : "referral.restore", target);
    changed();
    return Promise.resolve(true);
  },

  setReward({ customerId, kind, granted, why, actor, target }) {
    if (supabaseEnabled) {
      return done(browserSupabase().rpc("admin_set_reward", { customer: customerId, kind, granted, ...(why ? { why } : {}) }));
    }
    if (!demoStore?.teamSetReward(customerId, kind, granted, why)) return Promise.resolve(false);
    record(actor, granted ? "reward.restore" : "reward.revoke", target);
    changed();
    return Promise.resolve(true);
  },
};
