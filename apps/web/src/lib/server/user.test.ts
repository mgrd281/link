import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * requireUser: who is calling an API route. The real supabase-js client, with Supabase Auth's
 * answers stubbed at `fetch`. Only a token Auth turned down is "unauthorized"; when Auth itself
 * could not answer (no answer, a 5xx, a rate limit), a route that asks for it says "try again later"
 * instead: the iPhone app signs out and wipes the device on a 401 (ADR 0088).
 */

vi.mock("@/lib/supabase/config", () => ({ SUPABASE_URL: "http://supabase.test", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", supabaseEnabled: true }));

const { requireUser } = await import("./user");

const call = (outage?: "unavailable") =>
  requireUser(new Request("http://localhost/api/auth/handoff", { method: "POST", headers: { authorization: "Bearer a.valid.token" } }), outage ? { outage } : {});

/** Auth answers every request with this status and body. */
const auth = (status: number, body: unknown = { msg: "upstream" }) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }))),
  );

const answer = async (result: Awaited<ReturnType<typeof requireUser>>) =>
  result instanceof Response ? { status: result.status, body: (await result.json()) as unknown, store: result.headers.get("cache-control") } : "user";

afterEach(() => vi.unstubAllGlobals());

describe("requireUser", () => {
  it("a token Auth accepts: the user", async () => {
    auth(200, { id: "u1", email: "mira@example.com", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" });
    const result = await call("unavailable");
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) expect(result.user).toEqual({ id: "u1", email: "mira@example.com" });
  });

  for (const [status, body] of [
    [401, { code: "bad_jwt", msg: "invalid JWT" }],
    [403, { code: "bad_jwt", msg: "token is expired" }],
    [403, { code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" }],
    [404, { code: "user_not_found", msg: "User from sub claim in JWT does not exist" }],
  ] as const) {
    it(`Auth turns the token down (${String(status)} ${body.code}): 401 unauthorized, with or without the outage option`, async () => {
      auth(status, body);
      expect(await answer(await call("unavailable"))).toEqual({ status: 401, body: { ok: false, error: "unauthorized" }, store: "no-store" });
      expect(await answer(await call())).toEqual({ status: 401, body: { ok: false, error: "unauthorized" }, store: "no-store" });
    });
  }

  for (const status of [500, 502, 503, 504, 429]) {
    it(`Auth answers ${String(status)}: 503 unavailable for a route that asks, never 401`, async () => {
      auth(status);
      expect(await answer(await call("unavailable"))).toEqual({ status: 503, body: { ok: false, error: "unavailable" }, store: "no-store" });
    });
  }

  it("Auth cannot be reached (a network error): 503 unavailable for a route that asks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("fetch failed"))),
    );
    expect(await answer(await call("unavailable"))).toEqual({ status: 503, body: { ok: false, error: "unavailable" }, store: "no-store" });
  });

  it("an answer that is not JSON (a proxy's error page): 503 unavailable for a route that asks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("<html>Bad gateway</html>", { status: 505 }))),
    );
    expect(await answer(await call("unavailable"))).toEqual({ status: 503, body: { ok: false, error: "unavailable" }, store: "no-store" });
  });

  it("every other route keeps its answer: 401 when Auth could not answer", async () => {
    auth(503);
    expect(await answer(await call())).toEqual({ status: 401, body: { ok: false, error: "unauthorized" }, store: "no-store" });
  });

  it("no bearer token: 401, Auth is not asked", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await requireUser(new Request("http://localhost/api/app/page", { method: "POST" }), { outage: "unavailable" });
    expect(await answer(result)).toEqual({ status: 401, body: { ok: false, error: "unauthorized" }, store: "no-store" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
