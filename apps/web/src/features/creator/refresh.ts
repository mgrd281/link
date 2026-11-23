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
