import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Auth from "@/features/account/server/auth";

/**
 * POST /api/auth/password: an account that is not active gets no session ("suspended") and a failed
 * sign-in in the log. A profile that could not be read says nothing about the account: the generic
 * server error ("try again"), the session just opened ended, and nothing logged as failed. Before, a
 * failed read answered "suspended", which the iPhone app shows as a final word.
 */

interface State {
  /** The account's `profiles.status`; `null`: no profile row. */
  status: string | null;
  /** Reading the profile fails (the database could not be reached). */
  readFails: boolean;
  logged: string[];
  revoked: string[];
  firstSites: number;
}

const state = vi.hoisted((): State => ({ status: "active", readFails: false, logged: [], revoked: [], firstSites: 0 }));

const session = { access_token: "a.e30.b", refresh_token: "r1" };
const user = { id: "u1", email: "mira@example.com" };

vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({
  anonServerSupabase: () => ({
    auth: {
      verifyOtp: () => Promise.resolve({ data: { user, session }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user, session }, error: null }),
    },
  }),
  serviceSupabase: () => ({
    rpc: () => Promise.resolve({ data: 0, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve(
              state.readFails
                ? { data: null, error: { message: "TypeError: fetch failed", code: "" } }
                : { data: state.status === null ? null : { status: state.status }, error: null },
            ),
        }),
      }),
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
  isBlocked: () => Promise.resolve(false),
  recordSignIn: (_service: unknown, input: { result: string }) => {
    state.logged.push(input.result);
    return Promise.resolve();
  },
}));

const { POST } = await import("./route");

const body = { email: "mira@example.com", password: "a-long-password", deviceId: "dev_0123456789ab" };
const signIn = async () => {
  const response = await POST(new Request("http://localhost/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as unknown, store: response.headers.get("cache-control") };
};

beforeEach(() => {
  state.status = "active";
  state.readFails = false;
  state.logged = [];
  state.revoked = [];
  state.firstSites = 0;
});

describe("POST /api/auth/password", () => {
  it("an active account: the session, a successful sign-in in the log", async () => {
    expect(await signIn()).toEqual({ status: 200, body: { ok: true, session }, store: "no-store" });
    expect(state.logged).toEqual(["success"]);
    expect(state.revoked).toEqual([]);
  });

  it.each([["suspended"], ["deleted"], [null]])("profile status %s: suspended, the session ended, a failed sign-in in the log", async (status) => {
    state.status = status;
    expect(await signIn()).toEqual({ status: 200, body: { ok: false, error: "suspended" }, store: "no-store" });
    expect(state.revoked).toEqual(["a.e30.b"]);
    expect(state.logged).toEqual(["failed"]);
    expect(state.firstSites).toBe(0);
  });

  it("the profile could not be read: the generic server error, never suspended; the session ended, nothing logged as failed", async () => {
    state.readFails = true;
    expect(await signIn()).toEqual({ status: 502, body: { ok: false, error: "serverError" }, store: "no-store" });
    expect(state.revoked).toEqual(["a.e30.b"]);
    expect(state.logged).toEqual([]);
    expect(state.firstSites).toBe(0);
  });
});
