import { createClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseEnabled } from "../supabase/config";
import type { Database } from "../supabase/database.types";
import { anonServerSupabase, type Db } from "../supabase/server";

/**
 * Who is calling an API route. The browser sends its Supabase access token as a bearer token; we
 * check it with Supabase, then hand back a client that acts as that user, so every RPC runs under
 * row-level security and team functions check the caller's permissions in SQL.
 */

/** The bearer token of a request, or null. */
export function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? null;
}

const unauthorized = () => Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

export interface SignedInUser {
  user: { id: string; email: string };
  /** Acts as the user: `Authorization: Bearer <token>` on every request. */
  db: Db;
}

/** The signed-in user and a client acting as them, or a 401 response to return as is. */
export async function requireUser(request: Request): Promise<SignedInUser | Response> {
  const token = bearer(request);
  if (!supabaseEnabled || !token) return unauthorized();
  const { data, error } = await anonServerSupabase().auth.getUser(token);
  if (error) return unauthorized();
  const db = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { user: { id: data.user.id, email: data.user.email ?? "" }, db };
}
