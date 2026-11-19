"use client";

import { useSyncExternalStore } from "react";

import type { AccountStatus, Note, Plan, SubscriptionStatus } from "./model";

/**
 * What the team changed about customers (demo mode: kept in this browser, next to the team data).
 * Phase 1 writes the same actions to Postgres through team-only functions, each one audited.
 */
export interface CustomerPatch {
  plan?: Plan;
  subscriptionStatus?: SubscriptionStatus | null;
  startedAt?: string;
  trialEndsAt?: string;
  canceledAt?: string | null;
  status?: AccountStatus;
  verified?: boolean;
  /** Invoices refunded by the team (ids). */
  refunded?: string[];
  /** Devices signed out by the team (device ids). */
  signedOut?: string[];
  deleted?: boolean;
}

export interface BlockedIp {
  ip: string;
  at: string;
  by: string;
  reason: string;
}

interface OverridesDb {
  version: 1;
  patches: Record<string, CustomerPatch>;
  notes: Record<string, Note[]>;
  blockedIps: BlockedIp[];
}

const KEY = "linkyo.admin.customers.v1";
const EMPTY: OverridesDb = { version: 1, patches: {}, notes: {}, blockedIps: [] };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: OverridesDb = EMPTY;

const read = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

function snapshot(): OverridesDb {
  const raw = read();
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const data = raw ? (JSON.parse(raw) as Partial<OverridesDb>) : null;
    cached = data?.version === 1 ? { ...EMPTY, ...data } : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(update: (db: OverridesDb) => OverridesDb): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(update(snapshot())));
  } catch {
    return false;
  }
  for (const listener of listeners) listener();
  return true;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

export function useOverrides(): OverridesDb {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export const overrides = {
  patch(id: string, patch: CustomerPatch) {
    return write((db) => ({ ...db, patches: { ...db.patches, [id]: { ...db.patches[id], ...patch } } }));
  },
  addNote(id: string, note: Note) {
    return write((db) => ({ ...db, notes: { ...db.notes, [id]: [note, ...(db.notes[id] ?? [])] } }));
  },
  blockIp(entry: BlockedIp) {
    return write((db) => ({
      ...db,
      blockedIps: [entry, ...db.blockedIps.filter((blocked) => blocked.ip !== entry.ip)],
    }));
  },
  unblockIp(ip: string) {
    return write((db) => ({ ...db, blockedIps: db.blockedIps.filter((blocked) => blocked.ip !== ip) }));
  },
};
