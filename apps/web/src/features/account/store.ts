"use client";

import { useSyncExternalStore } from "react";

import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/config";

import { LocalAccountStore } from "./local-store";
import { browserDevice, browserLoginContext } from "./login-context";
import { SupabaseAccountStore } from "./supabase-store";
import type { AccountStore, Site } from "./types";

/**
 * The app's account store: real accounts when Supabase is configured (ADR 0030), otherwise the
 * demo that keeps everything in this browser.
 */
export const accountStore: AccountStore = supabaseEnabled
  ? new SupabaseAccountStore(browserSupabase, browserDevice)
  : new LocalAccountStore(() => (typeof window === "undefined" ? null : window.localStorage), browserLoginContext);

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
