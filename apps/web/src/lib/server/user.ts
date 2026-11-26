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
 * Supabase Auth's own error codes for a token it turned down: not a valid JWT, a wrong signature or
 * expired (`bad_jwt`), no token (`no_authorization`), its session ended (`session_not_found`) or its user
 * deleted (`user_not_found`).
 */
const TOKEN_REFUSED = new Set(["bad_jwt", "no_authorization", "session_not_found", "user_not_found"]);

/**
 * Supabase Auth turned the token down: a 4xx that carries one of Auth's own codes about the token
 * (`TOKEN_REFUSED`). supabase-js reports `session_not_found` as an `AuthSessionMissingError` without a
 * code. Anything else says nothing about the token: no answer, a 5xx, a rate limit, and a 4xx without
 * such a code (the API gateway's "Invalid API key", a firewall's page, a proxy).
 */
export function tokenRefused(error: { name?: string; status?: number | undefined; code?: string | undefined }): boolean {
  const { status } = error;
  if (typeof status !== "number" || status < 400 || status >= 500) return false;
  if (error.name === "AuthSessionMissingError") return true;
  return typeof error.code === "string" && TOKEN_REFUSED.has(error.code);
}

export interface RequireUserOptions {
  /**
   * The answer when Supabase Auth did not turn the token down with its own code (`tokenRefused`): no
   * answer, a 5xx, a rate limit, a gateway's or a firewall's 4xx. "unauthorized" (401, the default) or
   * "unavailable" (503: try again later). The iPhone app's routes take the second: on a 401 the app
   * refreshes its session, and wipes the device when the refresh is refused too (ADR 0088).
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
