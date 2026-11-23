import { accessToken } from "@/lib/supabase/access-token";

/** What `sendCustomerStatus` needs from its surroundings (the browser's own in the console, stubs in tests). */
export interface StatusDeps {
  token: () => Promise<string | null>;
  send: (path: string, init: RequestInit) => Promise<{ ok: boolean }>;
}

const browserDeps: StatusDeps = { token: accessToken, send: (path, init) => fetch(path, init) };

/**
 * Suspends a customer or lets them back in through our server (`/api/admin/customers/<id>/status`),
 * not straight from the browser: the route runs `admin_set_status` as this team member (the database
 * checks the permission) and then drops the cached copy of the customer's public page, so a page
 * taken down after a report is gone on the very next visit. Answers whether it worked.
 */
export async function sendCustomerStatus(customerId: string, next: "active" | "suspended", deps: StatusDeps = browserDeps): Promise<boolean> {
  try {
    const token = await deps.token();
    if (!token) return false;
    const response = await deps.send(`/api/admin/customers/${encodeURIComponent(customerId)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ next }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
