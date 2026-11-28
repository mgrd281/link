import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public report route (/api/reports): its limits (lib/rate-limit.ts, unchanged: 10 per address and
 * 5 per e-mail address an hour), its body cap, and its honest answer where reports cannot be taken.
 * The filing itself is features/moderation/server/submit.test.ts.
 */

const state = vi.hoisted(() => ({ enabled: true, filed: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return state.enabled;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  serviceSupabase: () => ({
    rpc: () => {
      state.filed += 1;
      return Promise.resolve({ data: { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", receivedAt: "2026-11-28T09:15:00Z", duplicate: false }, error: null });
    },
  }),
}));
// The capture or console transport would write or log: here nothing is sent.
vi.mock("@/features/admin/mail", () => ({ deliver: () => Promise.resolve(false) }));

const { POST } = await import("./route");

const body = (email: string) => ({
  page: "linkyo.app/mila",
  category: "fraud",
  explanation: "The ticket link sells tickets that do not exist.",
  name: "Kai Example",
  email,
  goodFaith: true,
  locale: "de",
});
const post = (payload: unknown, from: string | null, raw?: string) =>
  new Request("http://localhost/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json", ...(from === null ? {} : { "x-forwarded-for": from }) },
    body: raw ?? JSON.stringify(payload),
  });

let address = 0;
/** A fresh documentation address per test (RFC 5737): the limits live as long as the module. */
const nextAddress = () => `198.51.100.${String((address += 1))}`;

beforeEach(() => {
  state.enabled = true;
  state.filed = 0;
});

describe("POST /api/reports", () => {
  it("files a report and answers its number, without a cookie", async () => {
    const response = await POST(post(body("kai@example.com"), nextAddress()));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, reference: "7C9E6679", mailed: false });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 429 with Retry-After after 10 reports from one address in an hour; another address goes on", async () => {
    const from = nextAddress();
    for (let n = 0; n < 10; n += 1) expect((await POST(post(body(`p${String(n)}@example.com`), from))).status).toBe(201);
    const refused = await POST(post(body("p10@example.com"), from));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(3000);
    expect(await refused.json()).toEqual({ ok: false, error: "tooManyRequests" });
    expect((await POST(post(body("p10@example.com"), nextAddress()))).status).toBe(201);
  });

  it("answers 429 after 5 reports from one e-mail address, whatever the address they come from", async () => {
    for (let n = 0; n < 5; n += 1) expect((await POST(post(body("same@example.com"), nextAddress()))).status).toBe(201);
    expect((await POST(post(body("Same@Example.com"), nextAddress()))).status).toBe(429);
  });

  it("refuses a body over 32 KB before reading it whole, and anything that is not the form", async () => {
    expect((await POST(post(null, nextAddress(), JSON.stringify({ ...body("big@example.com"), explanation: "x".repeat(40_000) })))).status).toBe(413);
    expect((await POST(post(null, nextAddress(), "not json"))).status).toBe(400);
    expect((await POST(post({ ...body("a@example.com"), ip: "192.0.2.1" }, nextAddress()))).status).toBe(400);
    expect(state.filed).toBe(0);
  });

  it("says reports cannot be taken here without a database (a demo build): 409, nothing filed", async () => {
    state.enabled = false;
    const response = await POST(post(body("demo@example.com"), nextAddress()));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "unavailable" });
    expect(state.filed).toBe(0);
  });
});
