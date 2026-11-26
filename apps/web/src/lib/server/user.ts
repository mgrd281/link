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

const noStore = { "Cache-Control": "no-store" };
const unauthorized = () => Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
const unavailable = () => Response.json({ ok: false, error: "unavailable" }, { status: 503, headers: noStore });

/**
 * Supabase Auth turned the token down: an answer about the token (invalid, expired, its session or its
 * user gone), a 4xx other than a rate limit (429) or a timeout (408). No answer, a 5xx, a rate limit or
 * an answer that is not Auth's own (no status) say nothing about the token.
 */
export function tokenRefused(error: { name?: string; status?: number | undefined }): boolean {
  if (error.name === "AuthRetryableFetchError") return false;
  const { status } = error;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export interface RequireUserOptions {
  /**
   * The answer when Supabase Auth could not check the token (no answer, a 5xx, a rate limit):
   * "unauthorized" (401, the default) or "unavailable" (503: try again later). The iPhone app's routes
   * take the second, since the app signs out and wipes the device on a 401 (ADR 0088).
   */
  outage?: "unauthorized" | "unavailable";
}

export interface SignedInUser {
  user: { id: string; email: string };
  /** Acts as the user: `Authorization: Bearer <token>` on every request. */
  db: Db;
}

/** The signed-in user and a client acting as them, or a 401 (or 503, see `outage`) response to return as is. */
export async function requireUser(request: Request, { outage = "unauthorized" }: RequireUserOptions = {}): Promise<SignedInUser | Response> {
  const token = bearer(request);
  if (!supabaseEnabled || !token) return unauthorized();
  const down = outage === "unavailable" ? unavailable : unauthorized;
  let checked: Awaited<ReturnType<Db["auth"]["getUser"]>>;
  try {
    checked = await anonServerSupabase().auth.getUser(token);
  } catch {
    return down();
  }
  const { data, error } = checked;
  if (error) return tokenRefused(error) ? unauthorized() : down();
  const db = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { user: { id: data.user.id, email: data.user.email ?? "" }, db };
}
