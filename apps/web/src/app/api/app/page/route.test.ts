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
  writes: [] as Record<string, unknown>[],
  revalidated: [] as string[],
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

function db() {
  return {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let values: Record<string, unknown> | null = null;
      const run = () => {
        if (table === "profiles") return { data: { status: state.status, username: "mira", locale: "de" }, error: null };
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
  requireUser: (request: Request) =>
    Promise.resolve(
      request.headers.get("authorization") === "Bearer app-session"
        ? { user: { id: OWNER, email: "mira@example.com" }, db: db() }
        : Response.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    ),
}));

const { POST } = await import("./route");

const call = (body: unknown, { token = "app-session", raw }: { token?: string | null; raw?: string } = {}) =>
  POST(
    new Request("http://localhost/api/app/page", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
  );

beforeEach(() => {
  state.enabled = true;
  state.status = "active";
  state.clock = 0;
  state.raceOnWrite = false;
  state.writes = [];
  state.revalidated = [];
  state.row = {
    page: { profile: { username: "mira", displayName: "Mira Okafor", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" }, blocks: [link("a"), link("b")] },
    updated_at: stamp(),
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
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
    state.row = { ...(state.row as Row), updated_at: stamp() };
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
});
