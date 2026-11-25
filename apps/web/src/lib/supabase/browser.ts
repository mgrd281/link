"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseEnabled } from "./config";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

let client: Client | null = null;
let loading: Promise<Client> | null = null;

/**
 * Loads the browser's Supabase client (the session lives in first-party cookies, strictly necessary).
 * Its library comes in a chunk of its own, loaded only with real accounts: a demo build never sends it
 * to the browser (ADR 0008). With real accounts it starts loading as soon as this module runs (below),
 * and the account store waits for it before it reports a session, so every screen behind the session
 * finds it loaded.
 */
export function loadBrowserSupabase(): Promise<Client> {
  loading ??= import("./browser-client").then(({ createBrowserSupabase }) => (client ??= createBrowserSupabase()));
  // A failed load (offline) may be tried again.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * The browser's Supabase client, once loaded (`loadBrowserSupabase`). Screens behind the session call
 * it after the account store has reported one, which waits for the client; code that may run before
 * that awaits `loadBrowserSupabase()` instead.
 */
export function browserSupabase(): Client {
  if (!client) throw new Error("The Supabase client is not loaded yet: await loadBrowserSupabase() first.");
  return client;
}

// Real accounts: start loading right away, so the client is ready by the time anything asks for it.
if (supabaseEnabled && typeof window !== "undefined") void loadBrowserSupabase().catch(() => undefined);
