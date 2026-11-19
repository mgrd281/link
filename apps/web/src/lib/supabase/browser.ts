"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

/** The browser's Supabase client: the session lives in first-party cookies (strictly necessary). */
export function browserSupabase(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { sameSite: "lax", secure: window.location.protocol === "https:", path: "/" },
  });
  return client;
}
