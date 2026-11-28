import type { Block } from "@linkyo/blocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/app/page: Bearer only, the version check on the read and on the write, the limits, and
 * the platform details through the server's own lookup (Spotify's oEmbed, stubbed).
 */

const OWNER = "0f4c5a3e-1111-4222-8333-444455556666";

interface Row {
  page: { profile: Record<string, unknown>; blocks: Block[] };
  updated_at: string;
}

const state = vi.hoisted(() => ({
  enabled: true,
  status: "active",
  row: null as Row | null,
  clock: 0,
  /** Someone writes between the route's read and its write. */
  raceOnWrite: false,
  /** The profiles read fails (the database cannot be reached). */
  profileError: false,
  /** A read of the page's current version fails. */
  versionError: false,
  writes: [] as Record<string, unknown>[],
  revalidated: [] as string[],
  /** The request's address is on the blocked list. */
  blocked: false,
}));

const link = (id: string): Block => ({ id, type: "link", title: id, url: `https://example.com/${id}`, visible: true, highlight: false });
const stamp = () => `2026-11-26T10:00:00.${String((state.clock += 1)).padStart(6, "0")}+00:00`;

vi.mock("@/lib/supabase/config", () => ({
  get supabaseEnabled() {
    return state.enabled;
  },
  SUPABASE_URL: "http://127.0.0.1:54321",
}));
vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => ({ video: "Video", music: "Musik", events: "Tickets" })[key] ?? key),
}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => state.revalidated.push(path) }));
vi.mock("@/lib/supabase/server", () => ({
  serviceSupabase: () => ({ rpc: (name: string) => Promise.resolve({ data: name === "is_ip_blocked" ? state.blocked : null, error: null }) }),
}));

function db() {
  return {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let values: Record<string, unknown> | null = null;
      const run = () => {
        if (table === "profiles") return state.profileError ? { data: null, error: { message: "TypeError: fetch failed" } } : { data: { status: state.status, username: "mira", locale: "de" }, error: null };
        if (!values && !("updated_at" in filters) && state.versionError) return { data: null, error: { message: "TypeError: fetch failed" } };
        const row = state.row;
        if (!row) return { data: null, error: null };
        const matches = !("updated_at" in filters) || filters.updated_at === row.updated_at;
        if (!values) return { data: matches ? structuredClone(row) : null, error: null };
        if (state.raceOnWrite) {
          state.raceOnWrite = false;
          row.updated_at = stamp();
        }
        if (filters.updated_at !== row.updated_at) return { data: null, error: null };
        state.writes.push(values);
        state.row = { page: structuredClone(values.page) as Row["page"], updated_at: stamp() };
        return { data: { updated_at: state.row.updated_at }, error: null };
      };
      const chain = {
        select: () => chain,
        update: (next: Record<string, unknown>) => {
          values = next;
          return chain;
        },
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return chain;
        },
        maybeSingle: () => Promise.resolve(run()),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/server/user", () => ({
  // As the real one answers (lib/server/user.test.ts): "Bearer auth-down" stands for Supabase Auth
  // failing itself (no answer, a 5xx, a rate limit), which is a 401 unless the route asks otherwise.
  requireUser: (request: Request, options: { outage?: string } = {}) => {
    const header = request.headers.get("authorization");
    if (header === "Bearer app-session") return Promise.resolve({ user: { id: OWNER, email: "mira@example.com" }, db: db() });
    if (header === "Bearer auth-down" && options.outage === "unavailable") return Promise.resolve(Response.json({ ok: false, error: "unavailable" }, { status: 503 }));
    return Promise.resolve(Response.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  },
}));

const { POST } = await import("./route");

const call = (body: unknown, { token = "app-session", raw, from }: { token?: string | null; raw?: string; from?: string } = {}) =>
  POST(
    new Request("http://localhost/api/app/page", {
      method: "POST",
      headers: { "content-type": "application/json", ...(from ? { "x-forwarded-for": from } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
  );

let run = 0;
beforeEach(() => {
  // The limits count per account in memory: each test starts after the last one's window.
  run += 1;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-11-28T12:00:00Z") + run * 2 * 60_000);
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  state.blocked = false;
  state.enabled = true;
  state.status = "active";
  state.clock = 0;
  state.raceOnWrite = false;
  state.profileError = false;
  state.versionError = false;
  state.writes = [];
  state.revalidated = [];
  state.row = {
    page: { profile: { username: "mira", displayName: "Mira Okafor", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" }, blocks: [link("a"), link("b")] },
    updated_at: stamp(),
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.SUPABASE_SECRET_KEY;
});

const base = () => state.row?.updated_at ?? "";

describe("POST /api/app/page", () => {
  it("answers 401 without a Bearer token, and 409 without real accounts (a demo build)", async () => {
    expect((await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "a" }] }, { token: null })).status).toBe(401);
    state.enabled = false;
    const demo = await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "a" }] });
    expect(demo.status).toBe(409);
    expect(demo.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 503 when Supabase Auth could not check the token: never the 401 on which the app signs out and wipes the device", async () => {
    const response = await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "a" }] }, { token: "auth-down" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "unavailable" });
    expect(state.writes).toEqual([]);
  });

  it("answers 502 when the account or the page's version cannot be read, never a final-sounding 404", async () => {
    state.profileError = true;
    const profile = await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "a" }] });
    expect(profile.status).toBe(502);
    expect(await profile.json()).toEqual({ ok: false, error: "serverError" });
    state.profileError = false;
    // A stale base, and the read that would tell a conflict from a missing page fails.
    state.versionError = true;
    const version = await call({ baseUpdatedAt: "2020-01-01T00:00:00+00:00", ops: [{ op: "remove", id: "a" }] });
    expect(version.status).toBe(502);
    expect(await version.json()).toEqual({ ok: false, error: "serverError" });
    expect(state.writes).toEqual([]);
  });

  it("writes over the version the app saw and answers the new version and the changed ids", async () => {
    const seen = base();
    const response = await call({ baseUpdatedAt: seen, ops: [{ op: "move", id: "b", to: 0 }, { op: "show", id: "a", visible: false }] });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const answer = (await response.json()) as { ok: boolean; updatedAt: string; changed: string[] };
    expect(answer).toMatchObject({ ok: true, changed: ["b", "a"], updatedAt: state.row?.updated_at });
    expect(answer.updatedAt).not.toBe(seen);
    expect(state.row?.page.blocks.map((block) => [block.id, block.visible])).toEqual([
      ["b", true],
      ["a", false],
    ]);
    // Visitors see it at once: the cached public page is dropped.
    expect(state.revalidated).toContain("/u/mira");
  });

  it("answers 409 with the current version when the page changed since (nothing written)", async () => {
    const stale = base();
    state.row = { ...(state.row!), updated_at: stamp() };
    const response = await call({ baseUpdatedAt: stale, ops: [{ op: "remove", id: "a" }] });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "conflict", updatedAt: state.row.updated_at });
    expect(state.writes).toEqual([]);
  });

  it("never overwrites a change that lands between its read and its write", async () => {
    state.raceOnWrite = true;
    const response = await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "a" }] });
    expect(response.status).toBe(409);
    expect(state.writes).toEqual([]);
    expect(state.row?.page.blocks.map((block) => block.id)).toEqual(["a", "b"]);
  });

  it("refuses more than 20 operations, an unknown id and a bad address with 422", async () => {
    const many = await call({ baseUpdatedAt: base(), ops: Array.from({ length: 21 }, () => ({ op: "remove", id: "a" })) });
    expect(many.status).toBe(422);
    expect(await many.json()).toEqual({ ok: false, error: "tooManyOps", max: 20 });
    const unknown = await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "nope" }] });
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toEqual({ ok: false, error: "unknownBlock", id: "nope" });
    const address = await call({ baseUpdatedAt: base(), ops: [{ op: "add", url: "nur text" }] });
    expect(address.status).toBe(422);
    expect(await address.json()).toEqual({ ok: false, error: "badUrl", op: 0 });
    const foreign = await call({ baseUpdatedAt: base(), ops: [{ op: "addImage", src: "https://images.example.com/a.jpg", alt: "", w: 1, h: 1 }] });
    expect(foreign.status).toBe(422);
    expect(await foreign.json()).toEqual({ ok: false, error: "badImage", op: 0 });
    expect(state.writes).toEqual([]);
  });

  it("refuses a body over 64 KB (413), broken JSON (400) and a base that is no version (422)", async () => {
    expect((await call(null, { raw: JSON.stringify({ baseUpdatedAt: base(), ops: [{ op: "add", url: `https://example.com/${"x".repeat(70_000)}` }] }) })).status).toBe(413);
    expect((await call(null, { raw: "{" })).status).toBe(400);
    const bad = await call({ baseUpdatedAt: "now", ops: [{ op: "remove", id: "a" }] });
    expect(bad.status).toBe(422);
    expect(await bad.json()).toEqual({ ok: false, error: "invalidBody", path: "baseUpdatedAt" });
  });

  it("refuses a suspended account (403)", async () => {
    state.status = "suspended";
    expect((await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "a" }] })).status).toBe(403);
    expect(state.writes).toEqual([]);
  });

  it("adds a Spotify link as a music block with the details from Spotify's oEmbed, asked by the server", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      asked.push(url);
      return Promise.resolve(Response.json({ title: "Nachtfahrt", author_name: "Mira Okafor", thumbnail_url: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02" }));
    });
    const response = await call({ baseUpdatedAt: base(), ops: [{ op: "add", url: "open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" }] });
    expect(response.status).toBe(200);
    const { added } = (await response.json()) as { added: string[] };
    const music = state.row?.page.blocks.find((block) => block.id === added[0]);
    expect(music).toMatchObject({ type: "music", title: "Nachtfahrt", artist: "Mira Okafor", cover: { src: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02" } });
    expect(asked).toEqual([`https://open.spotify.com/oembed?url=${encodeURIComponent("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")}`]);
  });

  it("writes nothing from a blocked address (403 blocked, as at sign-in and in the hand-off), and 409 without the server's key", async () => {
    state.blocked = true;
    const blocked = await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "a" }] }, { from: "203.0.113.9" });
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ ok: false, error: "blocked" });
    expect(state.writes).toEqual([]);
    state.blocked = false;
    delete process.env.SUPABASE_SECRET_KEY;
    const keyless = await call({ baseUpdatedAt: base(), ops: [{ op: "remove", id: "a" }] });
    expect(keyless.status).toBe(409);
    expect(await keyless.json()).toEqual({ ok: false, error: "unavailable" });
  });

  it("answers 429 with Retry-After past 30 calls per account a minute, and past 120 per address", async () => {
    const op = () => ({ baseUpdatedAt: base(), ops: [{ op: "show", id: "a", visible: true }] });
    for (let i = 0; i < 30; i++) expect((await call(op(), { from: `10.7.0.${String(i + 1)}` })).status).toBe(200);
    const refused = await call(op(), { from: "10.7.1.1" });
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ ok: false, error: "tooManyRequests" });
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(refused.headers.get("retry-after"))).toBeLessThanOrEqual(60);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect(state.writes).toHaveLength(30);
    // The address limit counts before Auth is asked: also calls Auth turns down.
    for (let i = 0; i < 120; i++) await call(op(), { token: "someone-else", from: "10.7.2.1" });
    expect((await call(op(), { token: "someone-else", from: "10.7.2.1" })).status).toBe(429);
  });

  it("answers the methods it does not take with 405 and no-store (never Next's cacheable 405)", async () => {
    const route = await import("./route");
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "OPTIONS"] as const) {
      const response = route[method]();
      expect(response.status, method).toBe(405);
      expect(response.headers.get("cache-control"), method).toBe("no-store");
      expect(response.headers.get("allow"), method).toBe("POST");
    }
  });
});
