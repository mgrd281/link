"use client";

import { useSyncExternalStore } from "react";

import { supabaseEnabled } from "@/lib/supabase/config";

import { DeferredAccountStore } from "./deferred-store";
import { LocalAccountStore } from "./local-store";
import { browserLoginContext } from "./login-context";
import type { AccountStore, Site } from "./types";

/**
 * The app's account store: real accounts when Supabase is configured (ADR 0030), otherwise the
 * demo that keeps everything in this browser. Real accounts load their store and Supabase's client
 * when first asked for (`./deferred-store.ts`), so a demo build ships neither (ADR 0008).
 */
export const accountStore: AccountStore = supabaseEnabled
  ? new DeferredAccountStore()
  : new LocalAccountStore(() => (typeof window === "undefined" ? null : window.localStorage), browserLoginContext);

/**
 * Changes that have not reached the store yet: the dashboard's editor writes a change a moment after
 * the last one (its autosave delay). Whoever needs everything saved now (the iPhone app, before it
 * changes the page itself) asks these to hand their change over first, then flushes the store.
 */
const pendingEdits = new Set<() => void>();

/** The editor registers how to hand over its waiting change; the answer unregisters it. */
export function registerPendingEdits(handOver: () => void): () => void {
  pendingEdits.add(handOver);
  return () => {
    pendingEdits.delete(handOver);
  };
}

/** Every waiting change goes to the store now (it saves them with its next flush). */
export function handOverPendingEdits(): void {
  for (const handOver of pendingEdits) handOver();
}

/** Current session and site; `loading` during server render and hydration. */
const subscribe = (listener: () => void) => accountStore.subscribe(listener);
const getSnapshot = () => accountStore.getSnapshot();
const getServerSnapshot = () => accountStore.getServerSnapshot();

export function useAccount() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The signed-in account and site. Only call below `<AppGate>` (it guarantees a session). */
export function useSignedIn() {
  const snapshot = useAccount();
  if (snapshot.status !== "signedIn") throw new Error("useSignedIn() outside <AppGate>");
  return { account: snapshot.account, site: snapshot.site, update: (fn: (site: Site) => Site) => accountStore.updateSite(fn) };
}
