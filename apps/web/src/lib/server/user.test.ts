import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * requireUser: who is calling an API route. The real supabase-js client, with Supabase Auth's
 * answers stubbed at `fetch`. Only a token Auth turned down with its own code is "unauthorized"; when
 * Auth could not answer (no answer, a 5xx, a rate limit) or something else answered (a gateway, a
 * firewall), a route that asks for it says "try again later" instead: the iPhone app refreshes its
 * session on a 401, and wipes the device when that refresh is refused too (ADR 0088).
 */

vi.mock("@/lib/supabase/config", () => ({ SUPABASE_URL: "http://supabase.test", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", supabaseEnabled: true }));

const { requireUser } = await import("./user");

const call = (outage?: "unavailable") =>
  requireUser(new Request("http://localhost/api/auth/handoff", { method: "POST", headers: { authorization: "Bearer a.valid.token" } }), outage ? { outage } : {});

/**
 * Supabase Auth answers every request with this status and body. Auth itself answers a client that sends
 * `X-Supabase-Api-Version` (supabase-js does) with that header and its error code in `code`; anything
 * in between (the API gateway, a firewall) does not.
 */
const auth = (status: number, body: unknown = { msg: "upstream" }, from: "auth" | "gateway" = "auth") =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json", ...(from === "auth" ? { "x-supabase-api-version": "2024-01-01" } : {}) },
        }),
      ),
    ),
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

  // What the local stack's Auth answers (`audit/ios/integrate/fix-4/probe-auth-codes.log`): a token
  // that is no JWT or carries a wrong signature, 403 bad_jwt; an expired one goes the same way in Auth
  // (`parseJWTClaims`: "token has invalid claims: token is expired"); a signed-out session, 403
  // session_not_found, which supabase-js turns into an AuthSessionMissingError without a code; a deleted
  // user, 403 user_not_found.
  for (const [status, body] of [
    [403, { code: "bad_jwt", message: "invalid JWT: unable to parse or verify signature, token signature is invalid" }],
    [403, { code: "bad_jwt", message: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired" }],
    [401, { code: "bad_jwt", message: "invalid JWT" }],
    [403, { code: "session_not_found", message: "Session from session_id claim in JWT does not exist" }],
    [403, { code: "user_not_found", message: "User from sub claim in JWT does not exist" }],
    [401, { code: "no_authorization", message: "This endpoint requires a valid Bearer token" }],
  ] as const) {
    it(`Auth turns the token down (${String(status)} ${body.code}: ${body.message.slice(-20)}): 401 unauthorized, with or without the outage option`, async () => {
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

  // Only Auth's own code says the token is bad. A 4xx from anything else (the API gateway's "Invalid API
  // key" on a rotated key, a firewall's page, an answer without a code) says nothing about the token: the
  // iPhone app would sign out and wipe the device on a 401 for something a moment later works again.
  for (const [label, status, body, from] of [
    ["the API gateway: 401 Invalid API key", 401, { message: "Invalid API key", hint: "Double check your Supabase `anon` or `service_role` API key." }, "gateway"],
    ["the API gateway: 401 no API key", 401, { message: "No API key found in request" }, "gateway"],
    ["a firewall: 403 in JSON without a code", 403, { message: "Request blocked" }, "gateway"],
    ["Auth: a 400 without a code", 400, { message: "bad request" }, "auth"],
    ["Auth: a 4xx with a code that is not about the token", 422, { code: "validation_failed", message: "Unable to validate" }, "auth"],
  ] as const) {
    it(`${label}: 503 unavailable for a route that asks, never 401; 401 elsewhere as before`, async () => {
      auth(status, body, from);
      expect(await answer(await call("unavailable"))).toEqual({ status: 503, body: { ok: false, error: "unavailable" }, store: "no-store" });
      expect(await answer(await call())).toEqual({ status: 401, body: { ok: false, error: "unauthorized" }, store: "no-store" });
    });
  }

  it("a firewall's page (403, not JSON): 503 unavailable for a route that asks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("<html>blocked by a firewall</html>", { status: 403, headers: { "content-type": "text/html" } }))),
    );
    expect(await answer(await call("unavailable"))).toEqual({ status: 503, body: { ok: false, error: "unavailable" }, store: "no-store" });
  });

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
