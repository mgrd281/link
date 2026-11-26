import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Auth from "@/features/account/server/auth";

/**
 * GET /api/auth/confirm logs the sign-in under the iPhone app's device id when its hand-off link
 * carries one (`/api/auth/handoff`), so "Sign out device" ends the app's two sessions together; any
 * other value, or none, stays the e-mailed link's `dev_email_link`.
 */

const state = vi.hoisted(() => ({ logged: [] as { deviceId: string; result: string }[] }));

vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({
  cookieServerSupabase: () =>
    Promise.resolve({
      auth: {
        verifyOtp: () => Promise.resolve({ data: { user: { id: "u1", email: "mira@example.com" }, session: { access_token: "a.e30.b" } }, error: null }),
        exchangeCodeForSession: () => Promise.resolve({ data: { user: null }, error: { message: "no code" } }),
      },
    }),
  serviceSupabase: () => ({}),
}));
vi.mock("@/features/account/server/first-site", () => ({ ensureFirstSite: () => Promise.resolve() }));
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
