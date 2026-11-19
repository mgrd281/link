import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

export type Db = SupabaseClient<Database>;

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/** Signs people up and in on the server; the tokens go back to the browser in the response. */
export function anonServerSupabase(): Db {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: noSession });
}

/** For routes that hand a session to the browser as cookies (links from emails). */
export async function cookieServerSupabase(): Promise<Db> {
  const store = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, { ...options, sameSite: "lax", path: "/" });
      },
    },
  });
}

/**
 * The secret key bypasses row-level security: server routes only, never imported by client code
 * (it is not a NEXT_PUBLIC_ variable, so it can't reach a browser bundle).
 */
export function serviceSupabase(): Db {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(SUPABASE_URL, secret, { auth: noSession });
}
