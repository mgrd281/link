"use client";

import { useSyncExternalStore } from "react";

import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/config";
import { fromJson } from "@/lib/supabase/json";

import type { Customer } from "./customers/model";
import type { BlockedIp } from "./customers/overrides";
import { useAdminDb } from "./store";
import type { ActivityEvent, Member, Permission, Role } from "./types";

/**
 * The team console on real data (Supabase): every read goes through a team-only database function
 * that checks the caller's permission (supabase/migrations/…_team.sql). Small stores with an
 * explicit refresh: after each action the console reloads what it shows.
 */

export type LiveMember = Member & { id: string };

export type LiveTeam =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; me: LiveMember; permissions: readonly Permission[]; members: LiveMember[]; activity: ActivityEvent[] };

export interface LiveCustomers {
  ready: boolean;
  now: number;
  customers: Customer[];
  blockedIps: BlockedIp[];
}

function liveStore<T>(initial: T, load: () => Promise<T>) {
  let value = initial;
  let started = false;
  const listeners = new Set<() => void>();
  const refresh = async () => {
    value = await load();
    for (const listener of listeners) listener();
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (!started) {
        started = true;
        void refresh();
      }
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => value,
    initial: () => initial,
    refresh,
  } as const;
}

interface TeamRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  addedAt: string;
}

const team = liveStore<LiveTeam>({ status: "loading" }, async () => {
  const supabase = browserSupabase();
  const { data: meData, error } = await supabase.rpc("admin_me");
  if (error || !meData) return { status: "none" };
  const me = fromJson<{ role: Role; email: string; permissions: Permission[] }>(meData);
  const [teamResult, activityResult] = await Promise.all([
    supabase.rpc("admin_team"),
    me.permissions.includes("activity.view") ? supabase.rpc("admin_activity", { max_rows: 300 }) : Promise.resolve({ data: null }),
  ]);
  const members = fromJson<TeamRow[] | null>(teamResult.data ?? null) ?? [];
  const activity = fromJson<ActivityEvent[] | null>(activityResult.data ?? null) ?? [];
  const self = members.find((member) => member.email === me.email);
  return {
    status: "ready",
    me: { id: self?.id ?? "", email: me.email, name: self?.name ?? me.email, role: me.role, addedAt: self?.addedAt ?? "" },
    permissions: me.permissions,
    members: members.map((member) => ({ id: member.id, email: member.email, name: member.name, role: member.role, addedAt: member.addedAt })),
    activity,
  };
});

const customers = liveStore<LiveCustomers>({ ready: false, now: 0, customers: [], blockedIps: [] }, async () => {
  const supabase = browserSupabase();
  const [list, blocked] = await Promise.all([supabase.rpc("admin_customers"), supabase.rpc("admin_blocked_ips")]);
  const rows = fromJson<Omit<Customer, "source">[] | null>(list.data ?? null) ?? [];
  return {
    ready: true,
    now: Date.now(),
    customers: rows.map((row) => ({ ...row, source: "live" as const })),
    // Without "security.view" the database refuses; the console then shows no blocked addresses.
    blockedIps: blocked.error ? [] : (fromJson<BlockedIp[] | null>(blocked.data ?? null) ?? []),
  };
});

export function useLiveTeam(): LiveTeam {
  return useSyncExternalStore(team.subscribe, team.get, team.initial);
}

export function useLiveCustomers(): LiveCustomers {
  return useSyncExternalStore(customers.subscribe, customers.get, customers.initial);
}

/** Reload what the console shows after a change (the activity log is written by the database). */
export async function refreshLive(): Promise<void> {
  await Promise.all([team.refresh(), customers.refresh()]);
}

/** Whether this account is on the team (shows the way into the console in the account menu). */
export const useOnTeam: (email: string) => boolean = supabaseEnabled
  ? () => useLiveTeam().status === "ready"
  : (email) => useAdminDb()?.members.some((member) => member.email === email) ?? false;
