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
  /** The successful sign-ins logged: the session each opened and the device id it was made with. */
  signIns: { session_id: string; device_id: string; result: string; profile_id: string }[];
  /** The sign_ins read fails. */
  signInsError: boolean;
  generated: { type: string; email: string }[];
}

const SESSION = "7a0c3f1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const DEVICE = "dev_0123456789ab";
const opened = () => [{ session_id: SESSION, device_id: DEVICE, result: "success", profile_id: "u1" }];

const state = vi.hoisted(
  (): State => ({ enabled: true, status: "active", locale: "de", blocked: false, linkError: false, profileError: false, signIns: [], signInsError: false, generated: [] }),
);

vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return state.enabled;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  serviceSupabase: () => ({
    rpc: (name: string) => Promise.resolve({ data: name === "is_ip_blocked" ? state.blocked : null, error: null }),
    from: (table: string) => {
      const filters: Record<string, string> = {};
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return chain;
        },
        limit: () => chain,
        maybeSingle: () => {
          if (table === "sign_ins") {
            if (state.signInsError) return Promise.resolve({ data: null, error: { message: "TypeError: fetch failed" } });
            const row = state.signIns.find((entry) => Object.entries(filters).every(([column, value]) => entry[column as keyof typeof entry] === value));
            return Promise.resolve({ data: row ? { id: "s1" } : null, error: null });
          }
          return Promise.resolve(
            state.profileError ? { data: null, error: { message: "TypeError: fetch failed" } } : { data: state.status ? { status: state.status, locale: state.locale } : null, error: null },
          );
        },
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
  bearer: (request: Request) => /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null,
  // As the real one answers (lib/server/user.test.ts): "Bearer auth-down" stands for Supabase Auth
  // failing itself (no answer, a 5xx, a rate limit), which is a 401 unless the route asks otherwise.
  // A token whose payload names a session (as Auth's JWTs do) is the app's, checked by Auth.
  requireUser: (request: Request, options: { outage?: string } = {}) => {
    const header = request.headers.get("authorization");
    if (header?.startsWith("Bearer app.")) return Promise.resolve({ user: { id: "u1", email: "mira@example.com" }, db: {} });
    if (header === "Bearer auth-down" && options.outage === "unavailable") return Promise.resolve(Response.json({ ok: false, error: "unavailable" }, { status: 503 }));
    return Promise.resolve(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  },
}));

const { POST } = await import("./route");

/** An access token as Auth makes them, for this session (the route reads `session_id`; Auth checked the rest). */
const tokenFor = (session: unknown) => `app.${Buffer.from(JSON.stringify({ sub: "u1", session_id: session })).toString("base64url")}.signature`;
const APP_TOKEN = tokenFor(SESSION);
/** Each test from its own address, so the per-address limit of one never reaches the next. */
let address = 0;
let ip = "10.1.0.1";
const call = (body: unknown, token: string | null = APP_TOKEN, { raw, from = ip }: { raw?: string; from?: string } = {}) =>
  POST(
    new Request("http://localhost/api/auth/handoff", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": from, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
  );

const logged: unknown[][] = [];
beforeEach(() => {
  Object.assign(state, { enabled: true, status: "active", locale: "de", blocked: false, linkError: false, profileError: false, signIns: opened(), signInsError: false, generated: [] });
  address += 1;
  ip = `10.1.${String(Math.floor(address / 250))}.${String(address % 250)}`;
  // The limits count per account in memory: each test starts 11 minutes after the last one's window.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-11-28T12:00:00Z") + address * 11 * 60_000);
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  logged.length = 0;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args));
});
afterEach(() => {
  vi.useRealTimers();
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
    for (const secret of ["secret-token-hash", "mira@example.com", APP_TOKEN, "/api/auth/confirm"]) expect(text).not.toContain(secret);
  });

  it("hands off only a session opened on this device: its sign-in logged under this device id (403 deviceMismatch)", async () => {
    // Another device's id with this token: a leaked token cannot open a session under a made-up device.
    const other = await call({ deviceId: "dev_ffffffffffff" });
    expect(other.status).toBe(403);
    expect(await other.json()).toEqual({ ok: false, error: "deviceMismatch" });
    // The session has no sign-in at all (another session's token, or its log is older than 30 days).
    expect((await call({ deviceId: DEVICE }, tokenFor("0b1c2d3e-4f50-4617-8899-aabbccddeeff"))).status).toBe(403);
    // A token without a session id, or with one that is no uuid.
    expect((await call({ deviceId: DEVICE }, tokenFor(undefined))).status).toBe(403);
    expect((await call({ deviceId: DEVICE }, tokenFor("not-a-uuid"))).status).toBe(403);
    // Only a successful sign-in opens a session.
    state.signIns = [{ ...opened()[0]!, result: "failed" }];
    expect((await call({ deviceId: DEVICE })).status).toBe(403);
    expect(state.generated).toEqual([]);
    // The log cannot be read: try again later, never the final-sounding refusal.
    state.signInsError = true;
    const down = await call({ deviceId: DEVICE });
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ ok: false, error: "serverError" });
    expect(state.generated).toEqual([]);
  });

  it("answers 413 for a body above 4 KB, also without a Content-Length, before parsing it", async () => {
    const big = JSON.stringify({ deviceId: DEVICE, next: "x".repeat(5000) });
    const response = await call(null, APP_TOKEN, { raw: big });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ ok: false, error: "tooLarge", max: 4096 });
    const streamed = await POST(
      new Request("http://localhost/api/auth/handoff", {
        method: "POST",
        headers: { authorization: `Bearer ${APP_TOKEN}`, "x-forwarded-for": ip },
        body: new ReadableStream({
          start(controller) {
            for (let i = 0; i < 10; i++) controller.enqueue(new TextEncoder().encode("x".repeat(1000)));
            controller.close();
          },
        }),
        duplex: "half",
      } as RequestInit),
    );
    expect(streamed.status).toBe(413);
    // A body that is not JSON stays the 422 the ADR names.
    expect((await call(null, APP_TOKEN, { raw: "{not json" })).status).toBe(422);
    expect(state.generated).toEqual([]);
  });

  it("answers 429 with Retry-After past 10 hand-offs per account in 10 minutes, and past 30 per address", async () => {
    for (let i = 0; i < 10; i++) expect((await call({ deviceId: DEVICE }, APP_TOKEN, { from: `10.9.0.${String(i + 1)}` })).status).toBe(200);
    const refused = await call({ deviceId: DEVICE }, APP_TOKEN, { from: "10.9.0.99" });
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ ok: false, error: "tooManyRequests" });
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(refused.headers.get("retry-after"))).toBeLessThanOrEqual(600);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect(state.generated).toHaveLength(10);
    // The address limit counts before Auth is asked: also tokens Auth turns down.
    for (let i = 0; i < 30; i++) await call({ deviceId: DEVICE }, "someone-else", { from: "10.8.0.1" });
    expect((await call({ deviceId: DEVICE }, "someone-else", { from: "10.8.0.1" })).status).toBe(429);
  });

  it("answers the methods it does not take with 405 and no-store (never Next's cacheable 405)", async () => {
    const route = await import("./route");
    for (const method of ["GET", "PUT", "PATCH", "DELETE"] as const) {
      const response = route[method]();
      expect(response.status, method).toBe(405);
      expect(response.headers.get("cache-control"), method).toBe("no-store");
      expect(response.headers.get("allow"), method).toBe("POST");
    }
  });
});
