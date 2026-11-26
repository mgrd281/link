import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/auth/handoff: the iPhone app's Bearer token → a one-time link to /api/auth/confirm for its
 * web view. Refuses what /api/auth/verify refuses (suspended accounts, blocked addresses), and never
 * logs the token or the link.
 */

interface State {
  enabled: boolean;
  /** The account's status; null when it has no profile. */
  status: string | null;
  locale: string;
  blocked: boolean;
  linkError: boolean;
  /** The profiles read fails (the database cannot be reached). */
  profileError: boolean;
  generated: { type: string; email: string }[];
}

const state = vi.hoisted((): State => ({ enabled: true, status: "active", locale: "de", blocked: false, linkError: false, profileError: false, generated: [] }));

vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return state.enabled;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  serviceSupabase: () => ({
    rpc: (name: string) => Promise.resolve({ data: name === "is_ip_blocked" ? state.blocked : null, error: null }),
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve(
            state.profileError ? { data: null, error: { message: "TypeError: fetch failed" } } : { data: state.status ? { status: state.status, locale: state.locale } : null, error: null },
          ),
      };
      return chain;
    },
    auth: {
      admin: {
        generateLink: (input: { type: string; email: string }) => {
          state.generated.push(input);
          return Promise.resolve(
            state.linkError
              ? { data: { properties: null, user: null }, error: { message: "down" } }
              : { data: { properties: { hashed_token: "secret-token-hash" }, user: {} }, error: null },
          );
        },
      },
    },
  }),
}));

vi.mock("@/lib/server/user", () => ({
  // As the real one answers (lib/server/user.test.ts): "Bearer auth-down" stands for Supabase Auth
  // failing itself (no answer, a 5xx, a rate limit), which is a 401 unless the route asks otherwise.
  requireUser: (request: Request, options: { outage?: string } = {}) => {
    const header = request.headers.get("authorization");
    if (header === "Bearer app-session") return Promise.resolve({ user: { id: "u1", email: "mira@example.com" }, db: {} });
    if (header === "Bearer auth-down" && options.outage === "unavailable") return Promise.resolve(Response.json({ ok: false, error: "unavailable" }, { status: 503 }));
    return Promise.resolve(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  },
}));

const { POST } = await import("./route");

const DEVICE = "dev_0123456789ab";
const call = (body: unknown, token: string | null = "app-session") =>
  POST(
    new Request("http://localhost/api/auth/handoff", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.1.2.3", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
  );

const logged: unknown[][] = [];
beforeEach(() => {
  Object.assign(state, { enabled: true, status: "active", locale: "de", blocked: false, linkError: false, profileError: false, generated: [] });
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  logged.length = 0;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args));
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SUPABASE_SECRET_KEY;
});

describe("POST /api/auth/handoff", () => {
  it("answers the confirm link for the web view: magic-link token, the dashboard, the app's device id", async () => {
    const response = await call({ deviceId: DEVICE });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { ok, url } = (await response.json()) as { ok: boolean; url: string };
    expect(ok).toBe(true);
    const link = new URL(url, "http://localhost");
    expect(link.pathname).toBe("/api/auth/confirm");
    expect(Object.fromEntries(link.searchParams)).toEqual({ token_hash: "secret-token-hash", type: "magiclink", next: "/de/app", device: DEVICE });
    expect(state.generated).toEqual([{ type: "magiclink", email: "mira@example.com" }]);
    // A relative address: the web view opens it on the host it already trusts.
    expect(url.startsWith("/api/auth/confirm?")).toBe(true);
  });

  it("opens the account's language, or an in-app path the app asks for, and nothing else", async () => {
    state.locale = "ar";
    const next = async (body: Record<string, unknown>) => new URL(((await (await call({ deviceId: DEVICE, ...body })).json()) as { url: string }).url, "http://localhost").searchParams.get("next");
    expect(await next({})).toBe("/ar/app");
    expect(await next({ next: "/en/app/design" })).toBe("/en/app/design");
    expect(await next({ next: "/de/admin" })).toBe("/ar/app");
    expect(await next({ next: "https://evil.example/de/app" })).toBe("/ar/app");
    expect(await next({ next: "/de/app?tab=look" })).toBe("/ar/app");
  });

  it("answers 401 without a valid Bearer token, and makes no link", async () => {
    expect((await call({ deviceId: DEVICE }, null)).status).toBe(401);
    expect((await call({ deviceId: DEVICE }, "someone-else")).status).toBe(401);
    expect(state.generated).toEqual([]);
  });

  it("answers 503 when Supabase Auth could not check the token: never the 401 on which the app signs out and wipes the device", async () => {
    const response = await call({ deviceId: DEVICE }, "auth-down");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "unavailable" });
    expect(state.generated).toEqual([]);
  });

  it("answers 502 when the account cannot be read, never 403 suspended (which sounds final)", async () => {
    state.profileError = true;
    const response = await call({ deviceId: DEVICE });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "serverError" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.generated).toEqual([]);
  });

  it.each([[{}], [{ deviceId: "dev_email_link" }], [{ deviceId: "dev_0123456789AB" }], [{ deviceId: "dev_0123456789abc" }], [{ deviceId: "0123456789ab" }]])(
    "answers 422 for a device id that is not dev_<12 hex>: %j",
    async (body) => {
      const response = await call(body);
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ ok: false, error: "invalidDevice" });
      expect(state.generated).toEqual([]);
    },
  );

  it("answers 409 in a demo build and without the server's key (never a 500)", async () => {
    state.enabled = false;
    expect((await call({ deviceId: DEVICE })).status).toBe(409);
    state.enabled = true;
    delete process.env.SUPABASE_SECRET_KEY;
    const response = await call({ deviceId: DEVICE });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "unavailable" });
  });

  it("gives a suspended account no link (as /api/auth/verify refuses it), nor a blocked address", async () => {
    state.status = "suspended";
    const suspended = await call({ deviceId: DEVICE });
    expect(suspended.status).toBe(403);
    expect(await suspended.json()).toEqual({ ok: false, error: "suspended" });
    state.status = null;
    expect((await call({ deviceId: DEVICE })).status).toBe(403);
    state.status = "active";
    state.blocked = true;
    expect((await call({ deviceId: DEVICE })).status).toBe(403);
    expect(state.generated).toEqual([]);
  });

  it("logs neither the token, the link nor the e-mail address", async () => {
    await call({ deviceId: DEVICE });
    state.linkError = true;
    expect((await call({ deviceId: DEVICE })).status).toBe(502);
    const text = JSON.stringify(logged);
    for (const secret of ["secret-token-hash", "mira@example.com", "app-session", "/api/auth/confirm"]) expect(text).not.toContain(secret);
  });
});
