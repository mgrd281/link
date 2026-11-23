import type { Result } from "@/features/account/types";
import { accessToken } from "@/lib/supabase/access-token";

/** What `refreshPublicPage` needs from its surroundings (the browser's own in the app, stubs in tests). */
export interface RefreshDeps {
  token: () => Promise<string | null>;
  send: (path: string, init: RequestInit) => Promise<unknown>;
}

const browserDeps: RefreshDeps = { token: accessToken, send: (path, init) => fetch(path, init) };

/**
 * Tells the server that the signed-in account's public page moved to a new address, so the cached
 * copies at the new and the previous address are dropped at once (/api/account/revalidate). The
 * address itself is changed by the account store, from the browser. Nothing to do in demo mode or
 * signed out (no token); a failed call is not an error for the person: the pages then refresh
 * within their minute, as before.
 */
export async function refreshPublicPage(previous: string, deps: RefreshDeps = browserDeps): Promise<boolean> {
  try {
    const token = await deps.token();
    if (!token) return false;
    await deps.send("/api/account/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ previous }),
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Changes the page's address and, when that worked, tells the server at once (the old address then
 * stops answering now, not after its cached page was shown once more). Every screen that changes an
 * address goes through here: Settings and the welcome flow. `change` is the account store's
 * `changeUsername`.
 */
export async function changeAddress(
  next: string,
  previous: string,
  change: (next: string) => Promise<Result>,
  refresh: (previous: string) => Promise<unknown> = refreshPublicPage,
): Promise<Result> {
  const result = await change(next);
  if (result.ok && previous !== "" && previous !== next) void refresh(previous);
  return result;
}
