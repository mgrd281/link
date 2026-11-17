"use client";

import { useSyncExternalStore } from "react";

import { LocalAccountStore } from "./local-store";
import type { AccountStore, Site } from "./types";

/** The app's account store. Swap this one line for the Supabase implementation in Phase 1. */
export const accountStore: AccountStore = new LocalAccountStore(() => (typeof window === "undefined" ? null : window.localStorage));

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
