import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Auth from "@/features/account/server/auth";

/**
 * GET /api/auth/confirm logs the sign-in under the iPhone app's device id when its hand-off link
 * carries one (`/api/auth/handoff`), so "Sign out device" ends the app's two sessions together; any
 * other value, or none, stays the e-mailed link's `dev_email_link`. A suspended account gets no
 * session from a link, as from a code or a password.
 */

interface State {
  logged: { deviceId: string; result: string }[];
  /** The account's `profiles.status`; `null`: no profile row. */
  status: string | null;
  revoked: string[];
  cookiesCleared: number;
  firstSites: number;
}

const state = vi.hoisted((): State => ({ logged: [], status: "active", revoked: [], cookiesCleared: 0, firstSites: 0 }));

vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({
  cookieServerSupabase: () =>
    Promise.resolve({
      auth: {
        verifyOtp: () => Promise.resolve({ data: { user: { id: "u1", email: "mira@example.com" }, session: { access_token: "a.e30.b" } }, error: null }),
        exchangeCodeForSession: () => Promise.resolve({ data: { user: null }, error: { message: "no code" } }),
        signOut: () => {
          state.cookiesCleared += 1;
          return Promise.resolve({ error: null });
        },
      },
    }),
  serviceSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.status === null ? null : { status: state.status }, error: null }) }) }),
    }),
    auth: {
      admin: {
        signOut: (token: string) => {
          state.revoked.push(token);
          return Promise.resolve({ error: null });
        },
      },
    },
  }),
}));
vi.mock("@/features/account/server/first-site", () => ({
  ensureFirstSite: () => {
    state.firstSites += 1;
    return Promise.resolve();
  },
}));
vi.mock("@/features/account/server/referrals", () => ({ cleanRef: () => null, settleReferral: () => Promise.resolve() }));
vi.mock("@/features/account/server/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof Auth>()),
  recordSignIn: (_service: unknown, input: { device: { deviceId: string }; result: string }) => {
    state.logged.push({ deviceId: input.device.deviceId, result: input.result });
    return Promise.resolve();
  },
}));

const { GET } = await import("./route");

const open = (params: Record<string, string>) => GET(new Request(`http://localhost/api/auth/confirm?${new URLSearchParams(params).toString()}`) as never);

beforeEach(() => {
  state.logged = [];
  state.status = "active";
  state.revoked = [];
  state.cookiesCleared = 0;
  state.firstSites = 0;
});

describe("GET /api/auth/confirm: the device in the security log", () => {
  it("names the app's device id from the hand-off link, and continues to the dashboard", async () => {
    const response = await open({ token_hash: "h", type: "magiclink", next: "/de/app", device: "dev_0123456789ab" });
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/de/app");
    expect(state.logged).toEqual([{ deviceId: "dev_0123456789ab", result: "success" }]);
  });

  it.each([[undefined], ["dev_email_link"], ["dev_ABCDEF012345"], ["evil<script>"], ["dev_0123456789abcd"]])("keeps dev_email_link for %s", async (device) => {
    await open({ token_hash: "h", type: "magiclink", next: "/de/app", ...(device ? { device } : {}) });
    expect(state.logged).toEqual([{ deviceId: "dev_email_link", result: "success" }]);
  });
});

describe("GET /api/auth/confirm: a suspended account", () => {
  it.each([["suspended"], ["deleted"], [null]])("profile status %s: no session, a failed sign-in in the log, and the login page says so", async (status) => {
    state.status = status;
    const response = await open({ token_hash: "h", type: "magiclink", next: "/en/app", device: "dev_0123456789ab" });
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(`${location.pathname}${location.search}`).toBe("/en/login?link=suspended");
    // Ended on the server (as /api/auth/verify does) and in this browser's cookies.
    expect(state.revoked).toEqual(["a.e30.b"]);
    expect(state.cookiesCleared).toBe(1);
    expect(state.logged).toEqual([{ deviceId: "dev_0123456789ab", result: "failed" }]);
    expect(state.firstSites).toBe(0);
  });

  it("an active account signs in as before (nothing revoked)", async () => {
    await open({ token_hash: "h", type: "magiclink", next: "/de/app" });
    expect(state.revoked).toEqual([]);
    expect(state.cookiesCleared).toBe(0);
    expect(state.firstSites).toBe(1);
  });
});
