"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

/**
 * The browser's Supabase client: the session lives in first-party cookies (strictly necessary). In a
 * module of its own so that `./browser.ts` loads it, and Supabase's library with it, only with real
 * accounts (ADR 0008).
 */
export function createBrowserSupabase(): SupabaseClient<Database> {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { sameSite: "lax", secure: window.location.protocol === "https:", path: "/" },
  });
}
