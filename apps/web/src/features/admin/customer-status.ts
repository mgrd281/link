import type { Ground } from "@/features/moderation/types";
import { accessToken } from "@/lib/supabase/access-token";

/** What `sendCustomerStatus` needs from its surroundings (the browser's own in the console, stubs in tests). */
export interface StatusDeps {
  token: () => Promise<string | null>;
  send: (path: string, init: RequestInit) => Promise<{ ok: boolean; json?: () => Promise<unknown> }>;
}

const browserDeps: StatusDeps = { token: accessToken, send: (path, init) => fetch(path, init) };

/** A suspension's statement of reasons (Art. 17 DSA): the facts the customer reads, and the ground. */
export interface Statement {
  reason: string;
  ground: Ground;
}

/**
 * How a status change went. `recorded` is false when the database does not keep reasons yet (the
 * account is suspended all the same); `mailed` is true only when a delivering transport took the
 * statement of reasons.
 */
export type StatusAnswer = { ok: true; recorded: boolean; mailed: boolean } | { ok: false };

/**
 * Suspends a customer or lets them back in through our server (`/api/admin/customers/<id>/status`),
 * not straight from the browser: the route runs the team function as this team member (the database
 * checks the permission; a suspension carries its reason and ground and sends the statement of
 * reasons) and then drops the cached copy of the customer's public page, so a page taken down after a
 * report is gone on the very next visit.
 */
export async function sendCustomerStatus(customerId: string, next: "active" | "suspended", statement: Statement | null, deps: StatusDeps = browserDeps): Promise<StatusAnswer> {
  try {
    const token = await deps.token();
    if (!token) return { ok: false };
    const response = await deps.send(`/api/admin/customers/${encodeURIComponent(customerId)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(next === "suspended" && statement ? { next, reason: statement.reason, ground: statement.ground } : { next }),
    });
    if (!response.ok) return { ok: false };
    const data = ((await response.json?.().catch(() => null)) ?? {}) as { recorded?: unknown; creatorMailed?: unknown };
    return { ok: true, recorded: data.recorded !== false, mailed: data.creatorMailed === true };
  } catch {
    return { ok: false };
  }
}
