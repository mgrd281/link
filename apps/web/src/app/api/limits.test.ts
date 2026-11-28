import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Auth from "@/features/account/server/auth";

/**
 * The in-route limits (lib/rate-limit.ts, ADR draft-csp-and-limits): each public route that costs
 * something (a fetch to another host, a platform request, a code guess, an e-mail) answers 429 with
 * `Retry-After` once an address used its share, while another address and the machine itself (local
 * development, the e2e run) go on. The routes' own work is stubbed: only the limits are under test.
 */

vi.mock("@/features/ai/server/safe-fetch", () => ({ safeFetch: () => Promise.resolve({ ok: false, reason: "failed" }) }));
vi.mock("@/lib/link-metadata", () => ({
  LinkMetadataUnavailable: class extends Error {},
  LinkMetadataUnsupported: class extends Error {},
  lookupLinkMetadata: () => Promise.resolve({ title: "A song" }),
}));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({
  anonServerSupabase: () => ({
    auth: {
      signInWithOtp: () => Promise.resolve({ error: null }),
      verifyOtp: () => Promise.resolve({ data: { user: null, session: null }, error: { status: 400, message: "Token has expired or is invalid" } }),
    },
  }),
  serviceSupabase: () => ({ rpc: () => Promise.resolve({ data: 0, error: null }) }),
}));
vi.mock("@/features/account/server/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof Auth>()),
  isBlocked: () => Promise.resolve(false),
  recordSignIn: () => Promise.resolve(),
}));

const importLinks = await import("./import-links/route");
const linkMetadata = await import("./link-metadata/route");
const adminVerify = await import("./admin/verify/route");
const authCode = await import("./auth/code/route");
const authVerify = await import("./auth/verify/route");

const post = (path: string, body: unknown, from: string | null) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(from === null ? {} : { "x-forwarded-for": from }) },
    body: JSON.stringify(body),
  });

interface Case {
  name: string;
  /** Requests an address may make in the window. */
  max: number;
  /** The window, in seconds. */
  window: number;
  send: (from: string | null, n: number) => Promise<Response>;
  /** What the route answers in a 429's body. */
  refusal: unknown;
}

const CASES: Case[] = [
  {
    name: "/api/import-links",
    max: 10,
    window: 600,
    send: (from) => importLinks.POST(post("/api/import-links", { url: "https://beacons.ai/mira" }, from)),
    refusal: { ok: false, error: "failed" },
  },
  {
    name: "/api/link-metadata",
    max: 60,
    window: 60,
    send: (from) =>
      linkMetadata.GET(new NextRequest("http://localhost/api/link-metadata?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2Fx", { headers: from === null ? {} : { "x-forwarded-for": from } })),
    refusal: {},
  },
  {
    name: "/api/admin/verify",
    max: 5,
    window: 600,
    // A body the route refuses at once (400): every try counts, so the 400 ms friction is not waited for here.
    send: (from) => adminVerify.POST(post("/api/admin/verify", {}, from)),
    refusal: { ok: false, error: "tooManyAttempts" },
  },
  {
    name: "/api/auth/code (per address)",
    max: 10,
    window: 900,
    // A new e-mail address each time, so only the address limit is reached.
    send: (from, n) => authCode.POST(post("/api/auth/code", { email: `mira${String(n)}@example.com`, locale: "de" }, from)),
    refusal: { ok: false, error: "tooManyAttempts" },
  },
  {
    name: "/api/auth/code (per e-mail address)",
    max: 5,
    window: 900,
    // A new client address each time, so only the e-mail limit is reached.
    send: (from, n) => authCode.POST(post("/api/auth/code", { email: "Mira@Example.com ", locale: "de" }, from === null ? null : `${from}-${String(n)}`)),
    refusal: { ok: false, error: "tooManyAttempts" },
  },
  {
    name: "/api/auth/verify (per address)",
    max: 15,
    window: 900,
    send: (from, n) => authVerify.POST(post("/api/auth/verify", { email: `mira${String(n)}@example.com`, code: "123456" }, from)),
    refusal: { ok: false, error: "tooManyAttempts" },
  },
  {
    name: "/api/auth/verify (per e-mail address)",
    max: 10,
    window: 900,
    send: (from, n) => authVerify.POST(post("/api/auth/verify", { email: "mira@example.com", code: "123456" }, from === null ? null : `${from}-${String(n)}`)),
    refusal: { ok: false, error: "tooManyAttempts" },
  },
];

let run = 0;
beforeEach(() => {
  // Each test in its own hour: no window of one reaches the next.
  run += 1;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-11-28T00:00:00Z") + run * 3_600_000);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  return () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  };
});

/** A client address of the documentation range, one per case. */
const addressOf = (index: number) => `198.51.100.${String(index + 1)}`;

describe.each(CASES.map((item, index) => ({ ...item, index })))("$name", ({ name, max, window, send, refusal, index }) => {
  it(`answers ${String(max)} requests, then 429 with Retry-After within the window, and again once it has ended`, async () => {
    const from = addressOf(index);
    for (let n = 0; n < max; n++) expect((await send(from, n)).status, `request ${String(n + 1)}`).not.toBe(429);
    const refused = await send(from, max);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual(refusal);
    const retry = Number(refused.headers.get("retry-after"));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(window);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    // Another client is still answered (per address), or another e-mail address (per e-mail).
    if (!name.includes("e-mail")) expect((await send(addressOf(index + 50), 0)).status).not.toBe(429);
    // Once the window has ended, the same client is answered again.
    vi.setSystemTime(Date.now() + window * 1000);
    expect((await send(from, max + 1)).status).not.toBe(429);
  });

  // The e-mail limits hold for every client: an e-mail address is the same wherever it is typed.
  it.skipIf(name.includes("e-mail"))("never limits the machine itself (no address, or loopback: local development and the e2e run)", async () => {
    for (let n = 0; n < max + 2; n++) expect((await send(null, n)).status).not.toBe(429);
    for (let n = 0; n < max + 2; n++) expect((await send("127.0.0.1", n)).status).not.toBe(429);
    for (let n = 0; n < max + 2; n++) expect((await send("::1", n)).status).not.toBe(429);
  });
});
