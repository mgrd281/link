"use client";

import { useEffect, useSyncExternalStore } from "react";

import { accessToken } from "@/lib/supabase/access-token";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * How many AI drafts the owner has left, shown before a run starts (never as a surprise after it):
 * `GET /api/ai/quota`. One request per page load, shared by every entry point (welcome, Home, the
 * editor and the build screen) through a small store; `refresh()` after a run. The demo never asks:
 * the route does not exist there, and AI entry points stay hidden.
 */

export interface AiQuota {
  plan: "free" | "pro";
  allowance: number;
  used: number;
  left: number;
  period: "life" | "month";
  /** Pro: the first day of next month (Berlin); Free: null. */
  resetsAt: string | null;
}

/**
 * Why there are no AI drafts right now: `demo` (no real accounts in this build), `disabled` (the
 * team switched the AI off, or it is not set up: the route answers 404) or `failed` (the question
 * could not be asked or answered: no connection, a server error, a session that ran out).
 */
export type QuotaOff = "demo" | "disabled" | "failed";

export type QuotaState =
  | { status: "loading" }
  /** AI is off; every AI entry point stays hidden, and the build screen says why. */
  | { status: "off"; reason: QuotaOff }
  | { status: "ready"; quota: AiQuota };

/** The sentence for each reason, as a key of `app.ai`: only the demo is told about real accounts. */
export const OFF_MESSAGE = { demo: "unavailable", disabled: "errors.disabled", failed: "errors.server" } as const satisfies Record<QuotaOff, string>;

/** Reads the route's answer; anything unexpected switches the AI entry points off. */
export function quotaFrom(body: unknown): QuotaState {
  if (!body || typeof body !== "object") return { status: "off", reason: "failed" };
  const value = body as Record<string, unknown>;
  if (value.enabled !== true) return { status: "off", reason: value.enabled === false ? "disabled" : "failed" };
  const number = (key: string) => {
    const field = value[key];
    return typeof field === "number" && Number.isFinite(field) ? field : 0;
  };
  return {
    status: "ready",
    quota: {
      plan: value.plan === "pro" ? "pro" : "free",
      allowance: number("allowance"),
      used: number("used"),
      left: Math.max(0, number("left")),
      period: value.period === "month" ? "month" : "life",
      resetsAt: typeof value.resetsAt === "string" ? value.resetsAt : null,
    },
  };
}

const LOADING: QuotaState = { status: "loading" };
/** The demo: there is nobody to ask. */
const OFF: QuotaState = { status: "off", reason: "demo" };

export async function fetchQuota(): Promise<QuotaState> {
  if (!supabaseEnabled) return OFF;
  try {
    const token = await accessToken();
    if (!token) return { status: "off", reason: "failed" };
    const response = await fetch("/api/ai/quota", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    // 404: the AI is not set up on this server (the routes do not exist).
    if (!response.ok) return { status: "off", reason: response.status === 404 ? "disabled" : "failed" };
    return quotaFrom(await response.json());
  } catch {
    return { status: "off", reason: "failed" };
  }
}


let current: QuotaState = supabaseEnabled ? LOADING : OFF;
/** The account the cached answer belongs to (another sign-in in the same tab asks again). */
let owner: string | null = null;
const listeners = new Set<() => void>();

function set(next: QuotaState) {
  current = next;
  for (const listener of listeners) listener();
}

/** Asks the server again (after a run, or when a screen opens). */
export function refreshQuota(): Promise<void> {
  return fetchQuota().then(set);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export interface AiQuotaView {
  status: QuotaState["status"];
  /** The AI is on for this account (a real account, the switch on). */
  enabled: boolean;
  /** While `status` is "off": why. */
  off: QuotaOff | null;
  quota: AiQuota | null;
  refresh: () => Promise<void>;
}

/**
 * The signed-in owner's AI drafts (`account` is their id). With `fresh`, the screen asks again when it
 * opens; otherwise the first screen that needs it asks once per page load.
 */
export function useAiQuota({ account, fresh = false }: { account: string; fresh?: boolean }): AiQuotaView {
  const state = useSyncExternalStore(
    subscribe,
    () => current,
    () => (supabaseEnabled ? LOADING : OFF),
  );
  useEffect(() => {
    if (!supabaseEnabled) return;
    if (owner !== account) {
      owner = account;
      set(LOADING);
      void refreshQuota();
    } else if (fresh) void refreshQuota();
  }, [account, fresh]);
  const known = owner === account ? state : supabaseEnabled ? LOADING : OFF;
  return {
    status: known.status,
    enabled: known.status === "ready",
    off: known.status === "off" ? known.reason : null,
    quota: known.status === "ready" ? known.quota : null,
    refresh: refreshQuota,
  };
}

/** Free with nothing left: a new draft needs Pro (the Pro sheet); Pro at zero waits for next month. */
export const needsPro = (quota: AiQuota | null): boolean => quota !== null && quota.plan === "free" && quota.left <= 0;
