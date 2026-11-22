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

export type QuotaState =
  | { status: "loading" }
  /** AI is off: the demo, the route answers 404, the team switched it off, or the answer was unusable. */
  | { status: "off" }
  | { status: "ready"; quota: AiQuota };

/** Reads the route's answer; anything unexpected switches the AI entry points off. */
export function quotaFrom(body: unknown): QuotaState {
  if (!body || typeof body !== "object") return { status: "off" };
  const value = body as Record<string, unknown>;
  if (value.enabled !== true) return { status: "off" };
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

export async function fetchQuota(): Promise<QuotaState> {
  if (!supabaseEnabled) return { status: "off" };
  try {
    const token = await accessToken();
    if (!token) return { status: "off" };
    const response = await fetch("/api/ai/quota", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) return { status: "off" };
    return quotaFrom(await response.json());
  } catch {
    return { status: "off" };
  }
}

const LOADING: QuotaState = { status: "loading" };
const OFF: QuotaState = { status: "off" };

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
  return { status: known.status, enabled: known.status === "ready", quota: known.status === "ready" ? known.quota : null, refresh: refreshQuota };
}

/** Free with nothing left: a new draft needs Pro (the Pro sheet); Pro at zero waits for next month. */
export const needsPro = (quota: AiQuota | null): boolean => quota !== null && quota.plan === "free" && quota.left <= 0;
