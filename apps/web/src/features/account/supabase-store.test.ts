import type { Block } from "@linkyo/blocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Site } from "./types";

/**
 * The save guard (ADR 0088): the store writes the page only while the row still has the
 * version it read or last saved. Against an in-memory stand-in for the `sites` row that behaves as
 * Postgres does: every write gets a new `updated_at`, `sites_guard` writes the account's address and
 * badge into the page, and a filter on `updated_at` that no longer matches changes nothing.
 */

vi.mock("@/features/app/media-upload", () => ({ uploadDataUrl: () => Promise.reject(new Error("no uploads in this test")) }));

const { HIDDEN_WAIT, SupabaseAccountStore } = await import("./supabase-store");
const { registerPendingEdits } = await import("./pending-edits");

type Row = Record<string, unknown> & { profile_id: string; page: Record<string, unknown>; updated_at: string };

const ID = "0f4c5a3e-1111-4222-8333-444455556666";
const link = (id: string, title = id): Block => ({ id, type: "link", title, url: `https://example.com/${id}`, visible: true, highlight: false });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

class FakeDb {
  profile = { id: ID, username: "mira", locale: "de", status: "active", created_at: "2026-11-01T00:00:00+00:00", verified: false };
  clock = 0;
  row: Row;
  /** Row-level security turns writes down (a suspended account): 0 rows, nothing changes. */
  refuseWrites = false;
  /** The server answers writes with an error (offline, a timeout). */
  failWrites = false;
  /** The HTTP status of a failed write: 0 (no answer, as PostgREST's client reports it), 5xx, or 4xx (PostgREST refused it). */
  failStatus = 0;
  /** The write reaches the database, but its answer is an error (the connection dropped on the way back). */
  loseAnswers = false;
  /** The status of that lost answer: 0 (no answer at all) or a server error (5xx) whose write landed. */
  lostStatus = 0;
  /** Reads fail (the connection is gone): `true` for all, or a function asked before each read. */
  failReads: boolean | (() => boolean) = false;
  /** Reads never answer (offline, PostgREST's client retries a read for seconds). */
  hangReads = false;
  /** Reads answer this many ms late, with the row as it is then (a slow connection). */
  readDelay = 0;
  /** The session ended (signed out): row-level security lets no write through any more. */
  signedOut = false;
  /** Holds writes: "answer" applies them at once but holds the answer, "apply" holds both until `release()`. */
  hold: "answer" | "apply" | null = null;
  private held: { land: () => unknown; resolve: (answer: unknown) => void }[] = [];
  release() {
    this.hold = null;
    for (const write of this.held.splice(0)) write.resolve(write.land());
  }
  /** The tab is gone: the held writes reach the database, but no code is left to read their answers. */
  land() {
    for (const write of this.held.splice(0)) write.land();
  }
  writes: { filters: Record<string, unknown>; values: Record<string, unknown> }[] = [];
  authListener: ((event: string, session: unknown) => void) | null = null;

  constructor(blocks: Block[] = [link("a"), link("b")]) {
    this.row = {
      profile_id: ID,
      kind: null,
      onboarded: true,
      theme: { template: "nocturne" },
      page: { profile: { username: "mira", displayName: "Mira", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" }, blocks },
      legal: { name: "", address: "", email: "", phone: "" },
      prepared: null,
      updated_at: this.stamp(),
    };
  }

  stamp(): string {
    this.clock += 1;
    return `2026-11-26T10:00:00.${String(this.clock).padStart(6, "0")}+00:00`;
  }

  /** What sites_guard does on every write: the account's address and badge, and a new version. */
  write(values: Record<string, unknown>) {
    const next = { ...this.row, ...clone(values) } as Row;
    const profile = next.page.profile as Record<string, unknown>;
    next.page = { ...next.page, profile: { ...profile, username: this.profile.username, verified: this.profile.verified } };
    next.updated_at = this.stamp();
    this.row = next;
  }

  /** Someone else changes the page (another tab, the iPhone app). */
  elsewhere(blocks: Block[]) {
    this.write({ page: { ...this.row.page, blocks } });
  }

  blocks(): string[] {
    return (this.row.page.blocks as Block[]).map((block) => block.id);
  }

  client() {
    const query = (table: string) => {
      const filters: Record<string, unknown> = {};
      let values: Record<string, unknown> | null = null;
      const run = () => {
        if (table === "profiles") return { data: this.profile, error: null };
        if (values) {
          if (this.failWrites) return { data: null, error: { message: "TypeError: fetch failed" }, status: this.failStatus };
          this.writes.push({ filters: { ...filters }, values });
          const matches = filters.profile_id === this.row.profile_id && (!("updated_at" in filters) || filters.updated_at === this.row.updated_at);
          if (!matches || this.refuseWrites || this.signedOut) return { data: null, error: null };
          this.write(values);
          if (this.loseAnswers) return { data: null, error: { message: "TypeError: Load failed" }, status: this.lostStatus };
          return { data: { page: clone(this.row.page), updated_at: this.row.updated_at }, error: null };
        }
        const failing = typeof this.failReads === "function" ? this.failReads() : this.failReads;
        if (failing) return { data: null, error: { message: "TypeError: fetch failed" }, status: 0 };
        return { data: clone(this.row), error: null };
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
        maybeSingle: () => {
          if (!values && this.hangReads) return new Promise(() => undefined);
          if (!values && this.readDelay > 0) return new Promise((resolve) => setTimeout(() => resolve(run()), this.readDelay));
          if (!values || !this.hold) return Promise.resolve(run());
          if (this.hold === "answer") {
            const answer = run();
            return new Promise((resolve) => this.held.push({ land: () => answer, resolve }));
          }
          let landed: { answer: unknown } | null = null;
          const land = () => (landed ??= { answer: run() }).answer;
          return new Promise((resolve) => this.held.push({ land, resolve }));
        },
        single: () => Promise.resolve(run()),
      };
      return chain;
    };
    return {
      from: query,
      rpc: (name: string, args: { candidate?: string } = {}) => {
        if (name !== "change_username" || !args.candidate) return Promise.resolve({ data: null, error: null });
        // As the database function does: the account's address, then the page row (a new version).
        this.profile.username = args.candidate;
        this.write({});
        return Promise.resolve({ data: "ok", error: null });
      },
      auth: {
        onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
          this.authListener = listener;
          return { data: { subscription: { unsubscribe: () => undefined } } };
        },
        signOut: () => {
          this.signedOut = true;
          this.authListener?.("SIGNED_OUT", null);
          return Promise.resolve({ error: null });
        },
      },
    };
  }
}

const listeners = new Map<string, () => void>();

beforeEach(() => {
  vi.useFakeTimers();
  listeners.clear();
  vi.stubGlobal("window", {
    setTimeout: (handler: () => void, delay: number) => setTimeout(handler, delay),
    clearTimeout: (timer: number) => {
      clearTimeout(timer);
    },
    addEventListener: (name: string, handler: () => void) => listeners.set(name, handler),
    location: { origin: "http://localhost" },
  });
  vi.stubGlobal("document", { visibilityState: "visible" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function signedIn(db: FakeDb) {
  const store = new SupabaseAccountStore(() => db.client() as never, () => Promise.resolve({ device: { type: "desktop", os: "", browser: "" }, deviceId: "dev_000000000000" }));
  store.subscribe(() => undefined);
  db.authListener?.("SIGNED_IN", { user: { id: ID, email: "mira@example.com" }, access_token: "token" });
  await vi.advanceTimersByTimeAsync(0);
  const snapshot = store.getSnapshot();
  if (snapshot.status !== "signedIn") throw new Error("not signed in");
  return store;
}

const site = (store: InstanceType<typeof SupabaseAccountStore>): Site => {
  const snapshot = store.getSnapshot();
  if (snapshot.status !== "signedIn") throw new Error("not signed in");
  return snapshot.site;
};
const ids = (store: InstanceType<typeof SupabaseAccountStore>) => site(store).page.blocks.map((block) => block.id);
const addLink = (store: InstanceType<typeof SupabaseAccountStore>, id: string) =>
  store.updateSite((current) => ({ ...current, page: { ...current.page, blocks: [...current.page.blocks, link(id)] } }));
const snapshotOf = (store: InstanceType<typeof SupabaseAccountStore>) => {
  const snapshot = store.getSnapshot();
  if (snapshot.status !== "signedIn") throw new Error("not signed in");
  return snapshot;
};

describe("the save guard", () => {
  it("writes only over the version it read, and builds the next save on the version it saved", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const read = db.row.updated_at;
    expect(snapshotOf(store).baseUpdatedAt).toBe(read);
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.writes[0]?.filters).toEqual({ profile_id: ID, updated_at: read });
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.writes[1]?.filters.updated_at).not.toBe(read);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(snapshotOf(store).baseUpdatedAt).toBe(db.row.updated_at);
  });

  it("never refuses its own rapid edits (one tab, a save still on its way)", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    for (const id of ["c", "d", "e", "f", "g", "h"]) {
      addLink(store, id);
      await vi.advanceTimersByTimeAsync(150 + Math.floor(Math.random() * 400));
    }
    await store.flush();
    expect(db.blocks()).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(snapshotOf(store).revision).toBe(0);
    expect(snapshotOf(store).sync).toBe("saved");
  });

  it("refuses a save over a newer version: the newer page loads, the change here is dropped and counted", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    // Tab A (or the iPhone app) saves first; this tab still has the old version.
    db.elsewhere([link("a"), link("b"), link("from-elsewhere")]);
    addLink(store, "stale");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "from-elsewhere"]);
    expect(ids(store)).toEqual(["a", "b", "from-elsewhere"]);
    const snapshot = snapshotOf(store);
    expect(snapshot.conflicts).toBe(1);
    expect(snapshot.revision).toBe(1);
    expect(snapshot.sync).toBe("saved");
    expect(snapshot.baseUpdatedAt).toBe(db.row.updated_at);
    // No retry loop: nothing more is sent, and the next change saves over the newer version.
    const sent = db.writes.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.writes).toHaveLength(sent);
    addLink(store, "next");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "from-elsewhere", "next"]);
    expect(snapshotOf(store).conflicts).toBe(1);
  });

  it("keeps a change when only what the server owns changed meanwhile (a new address, the badge)", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    // change_username and the team's badge rewrite the row: a new version, the same page otherwise.
    db.profile.username = "mira-okafor";
    db.profile.verified = true;
    db.write({});
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    await store.flush();
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    expect((db.row.page.profile as Record<string, unknown>).username).toBe("mira-okafor");
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(snapshotOf(store).revision).toBe(0);
  });

  it("retries a write the database turned down without a newer version (a suspended account), never as a conflict", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.refuseWrites = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(snapshotOf(store).sync).toBe("error");
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(ids(store)).toEqual(["a", "b", "c"]);
    db.refuseWrites = false;
    await vi.advanceTimersByTimeAsync(2_500);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    expect(snapshotOf(store).sync).toBe("saved");
  });

  it("the keepalive save on leaving carries the guard, and its answer is the next version", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const read = db.row.updated_at;
    const fetches: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      fetches.push({ url, init });
      db.write(JSON.parse(init.body as string) as Record<string, unknown>);
      return Promise.resolve(new Response(JSON.stringify([{ updated_at: db.row.updated_at }]), { status: 200 }));
    });
    addLink(store, "c");
    listeners.get("pagehide")?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toHaveLength(1);
    expect(fetches[0]?.url).toContain(`updated_at=eq.${encodeURIComponent(read)}`);
    expect(fetches[0]?.init.keepalive).toBe(true);
    expect(new Headers(fetches[0]?.init.headers).get("Prefer")).toBe("return=representation");
    // The tab came back (a phone switching apps): the next change builds on the keepalive's version.
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(snapshotOf(store).conflicts).toBe(0);
  });
});

describe("closing the tab: the keepalive save is the last code that runs", () => {
  /**
   * The keepalive PATCH against the stand-in row, as PostgREST applies it: `updated_at=eq.` or `gte.`
   * (the stand-in's versions sort as text). A closed tab never reads the answer, so none comes back.
   */
  const keepalive = (db: FakeDb) => {
    const sent: string[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      sent.push(url);
      const guard = new URL(url, "http://localhost").searchParams.get("updated_at") ?? "";
      const [operator, version = ""] = guard.split(/\.(.*)/s);
      const matches = guard === "" || (operator === "eq" ? db.row.updated_at === version : operator === "gte" && db.row.updated_at >= version);
      if (matches) db.write(JSON.parse(init.body as string) as Record<string, unknown>);
      return new Promise<Response>(() => undefined);
    });
    return sent;
  };
  /** The tab is closed: its last events run, and nothing of it after that (no timers, no answers). */
  const close = () => {
    vi.stubGlobal("document", { visibilityState: "hidden" });
    listeners.get("visibilitychange")?.();
    listeners.get("pagehide")?.();
  };

  it("a save on its way lands first, then the keepalive with the change made meanwhile: both are kept", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const read = db.row.updated_at;
    const sent = keepalive(db);
    db.hold = "answer";
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    addLink(store, "d");
    close();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(`updated_at=gte.${encodeURIComponent(read)}`);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
  });

  it("the keepalive lands first, then the save that was on its way: the save changes nothing", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    keepalive(db);
    db.hold = "apply";
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    addLink(store, "d");
    close();
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    db.land();
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
  });

  it("a save landed but its answer was lost; the change made after it is kept on closing", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepalive(db);
    // The connection dropped right after the write landed: its answer and the read-back are lost.
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(snapshotOf(store).sync).toBe("error");
    addLink(store, "d");
    close();
    expect(sent[0]).toContain("updated_at=gte.");
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
  });

  it("after an address change, a change made just before closing is kept (the base follows the address)", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepalive(db);
    await expect(store.changeUsername("mira-okafor")).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    const renamed = db.row.updated_at;
    expect(snapshotOf(store).baseUpdatedAt).toBe(renamed);
    addLink(store, "c");
    close();
    expect(sent[0]).toContain(`updated_at=eq.${encodeURIComponent(renamed)}`);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    expect((db.row.page.profile as Record<string, unknown>).username).toBe("mira-okafor");
  });

  it("with nothing on its way, the keepalive keeps the exact guard: a newer page from elsewhere is not overwritten", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepalive(db);
    db.elsewhere([link("a"), link("from-elsewhere")]);
    addLink(store, "stale");
    close();
    expect(sent[0]).toContain("updated_at=eq.");
    expect(db.blocks()).toEqual(["a", "from-elsewhere"]);
  });
});

describe("hidden, not closed (a tab switch, a phone switching apps): never the loose guard", () => {
  /**
   * The keepalive PATCH as PostgREST runs it, `eq.` or `gte.`, answered to a tab that is still there:
   * the new version, or no row when the guard refused it. `guards` records each guard's operator.
   */
  const alive = (db: FakeDb) => {
    const guards: string[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      const guard = new URL(url, "http://localhost").searchParams.get("updated_at") ?? "";
      const [operator = "", version = ""] = guard.split(/\.(.*)/s);
      guards.push(operator);
      const matches = guard === "" || (operator === "eq" ? db.row.updated_at === version : operator === "gte" && db.row.updated_at >= version);
      if (matches) db.write(JSON.parse(init.body as string) as Record<string, unknown>);
      return Promise.resolve(new Response(JSON.stringify(matches ? [{ updated_at: db.row.updated_at }] : []), { status: 200 }));
    });
    return guards;
  };
  /** Hidden, and it stays hidden until `show()`. */
  const hide = () => {
    vi.stubGlobal("document", { visibilityState: "hidden" });
    listeners.get("visibilitychange")?.();
  };
  const show = () => {
    vi.stubGlobal("document", { visibilityState: "visible" });
    listeners.get("visibilitychange")?.();
  };

  it("hidden while a save is on its way: nothing goes until its answer, then the rest with the exact guard on the version it answered", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = alive(db);
    db.hold = "answer";
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    addLink(store, "d");
    hide();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(guards).toEqual([]);
    const landed = db.row.updated_at;
    db.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(guards).toEqual(["eq"]);
    expect(db.writes).toHaveLength(1);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(snapshotOf(store).baseUpdatedAt).toBe(db.row.updated_at);
    expect(db.row.updated_at > landed).toBe(true);
    show();
    addLink(store, "e");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "c", "d", "e"]);
    expect(snapshotOf(store).conflicts).toBe(0);
  });

  it("two tabs: B (stale) is hidden while its save is on its way; A's change is kept and B shows the newer page with the toast", async () => {
    // The reviewer's "window" (N12): before, B's hidden tab sent `updated_at >= base` at once, which
    // overwrote A's newer page when B's own save was refused.
    const db = new FakeDb();
    const tabA = await signedIn(db);
    const tabB = await signedIn(db);
    const guards = alive(db);
    addLink(tabA, "fromA");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "fromA"]);
    db.hold = "apply";
    addLink(tabB, "fromB1");
    await vi.advanceTimersByTimeAsync(450);
    addLink(tabB, "fromB2");
    hide();
    await vi.advanceTimersByTimeAsync(1_000);
    db.release();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(guards).not.toContain("gte");
    expect(db.blocks()).toEqual(["a", "b", "fromA"]);
    expect(ids(tabA)).toEqual(["a", "b", "fromA"]);
    // Back on screen, B shows the newest page and has counted the conflict (its toast).
    show();
    expect(ids(tabB)).toEqual(["a", "b", "fromA"]);
    expect(snapshotOf(tabB).conflicts).toBe(1);
    expect(snapshotOf(tabA).conflicts).toBe(0);
  });

  it("hidden while a lost answer is read back: it waits for the read-back, then the exact guard on the version it found", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = alive(db);
    db.loseAnswers = true;
    db.readDelay = 1_000;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(450);
    db.loseAnswers = false;
    addLink(store, "d");
    hide();
    await vi.advanceTimersByTimeAsync(900);
    expect(guards).toEqual([]);
    db.readDelay = 0;
    await vi.advanceTimersByTimeAsync(200);
    expect(guards).toEqual(["eq"]);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(snapshotOf(store).sync).toBe("saved");
    expect(snapshotOf(store).conflicts).toBe(0);
  });

  it(`a slow answer: after ${String(HIDDEN_WAIT)} ms the rest goes with the exact guard; refused as this tab's own, it goes again after that answer`, async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = alive(db);
    db.hold = "answer";
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    addLink(store, "d");
    hide();
    await vi.advanceTimersByTimeAsync(HIDDEN_WAIT - 10);
    expect(guards).toEqual([]);
    await vi.advanceTimersByTimeAsync(10);
    // Exact: c (this tab's own, still without an answer) is in the row, so it is refused, never a conflict.
    expect(guards).toEqual(["eq"]);
    await vi.advanceTimersByTimeAsync(100);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    expect(snapshotOf(store).conflicts).toBe(0);
    // c's answer comes at last: d goes as a normal save on its version.
    db.release();
    await vi.advanceTimersByTimeAsync(100);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(snapshotOf(store).baseUpdatedAt).toBe(db.row.updated_at);
    show();
    addLink(store, "e");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "c", "d", "e"]);
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(snapshotOf(store).revision).toBe(0);
  });

  it("closed while it waits (pagehide right after hidden, as a closing tab does): the keepalive goes at once, with the loose guard", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = alive(db);
    db.hold = "answer";
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    addLink(store, "d");
    hide();
    listeners.get("pagehide")?.();
    expect(guards).toEqual(["gte"]);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    // Nothing more is sent when the wait ends.
    await vi.advanceTimersByTimeAsync(HIDDEN_WAIT + 100);
    expect(guards).toEqual(["gte"]);
  });

  it("back on screen before the answer: the rest goes as a normal save once that answer comes", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = alive(db);
    db.hold = "answer";
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    addLink(store, "d");
    hide();
    await vi.advanceTimersByTimeAsync(300);
    show();
    db.release();
    await vi.advanceTimersByTimeAsync(100);
    expect(guards).toEqual([]);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(snapshotOf(store).sync).toBe("saved");
  });
});

describe("hidden, then ended by the phone with no other event (iOS ends a suspended app's web view)", () => {
  /**
   * The keepalive PATCH as PostgREST applies it (`eq.` or `gte.`); the page is gone by its answer, so
   * nothing reads it. `guards` records each guard's operator.
   */
  const killed = (db: FakeDb) => {
    const guards: string[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      const guard = new URL(url, "http://localhost").searchParams.get("updated_at") ?? "";
      const [operator = "", version = ""] = guard.split(/\.(.*)/s);
      guards.push(operator);
      const matches = guard === "" || (operator === "eq" ? db.row.updated_at === version : operator === "gte" && db.row.updated_at >= version);
      if (matches) db.write(JSON.parse(init.body as string) as Record<string, unknown>);
      return new Promise<Response>(() => undefined);
    });
    return guards;
  };
  const hide = () => {
    vi.stubGlobal("document", { visibilityState: "hidden" });
    listeners.get("visibilitychange")?.();
  };

  it("a save landed but its answer was lost and reads fail; a change, hidden, ended 200 ms later: the change is kept", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = killed(db);
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(450);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    db.loseAnswers = false;
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(50);
    hide();
    await vi.advanceTimersByTimeAsync(200);
    // The page is ended here: only what reached the database counts.
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(guards).toEqual(["gte"]);
  });

  it("a 503 whose write landed and reads fail; a change, hidden, ended 200 ms later: the change is kept", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = killed(db);
    db.loseAnswers = true;
    db.lostStatus = 503;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(450);
    db.loseAnswers = false;
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(50);
    hide();
    await vi.advanceTimersByTimeAsync(200);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(guards).toEqual(["gte"]);
  });

  it("reads work again by the time it is hidden: the row shows its own write, so the keepalive builds on it with the exact guard", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = killed(db);
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(450);
    db.loseAnswers = false;
    db.failReads = false;
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(50);
    hide();
    await vi.advanceTimersByTimeAsync(200);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(guards).toEqual(["eq"]);
  });

  it("reads work again and the row holds a page changed elsewhere: the exact guard, so that page is not overwritten", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = killed(db);
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(450);
    db.loseAnswers = false;
    db.failReads = false;
    db.elsewhere([link("a"), link("b"), link("c"), link("from-elsewhere")]);
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(50);
    hide();
    await vi.advanceTimersByTimeAsync(200);
    expect(guards).toEqual(["eq"]);
    expect(db.blocks()).toEqual(["a", "b", "c", "from-elsewhere"]);
  });

  it("hidden while a save is on its way that fails without an answer, and the page was changed elsewhere: the read-back resolves it, so the exact guard keeps that page", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = killed(db);
    db.hold = "apply";
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(450);
    addLink(store, "d");
    hide();
    db.elsewhere([link("a"), link("b"), link("from-elsewhere")]);
    db.failWrites = true;
    db.failStatus = 0;
    db.release();
    await vi.advanceTimersByTimeAsync(10);
    db.failWrites = false;
    await vi.advanceTimersByTimeAsync(HIDDEN_WAIT);
    expect(guards).toEqual(["eq"]);
    expect(db.blocks()).toEqual(["a", "b", "from-elsewhere"]);
  });

  it(`the read never answers: after ${String(HIDDEN_WAIT)} ms the keepalive goes with the closing tab's guard`, async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const guards = killed(db);
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(450);
    db.loseAnswers = false;
    db.failReads = false;
    db.hangReads = true;
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(50);
    hide();
    await vi.advanceTimersByTimeAsync(HIDDEN_WAIT - 10);
    expect(guards).toEqual([]);
    await vi.advanceTimersByTimeAsync(10);
    expect(guards).toEqual(["gte"]);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("leaving the account", () => {
  it("logOut() sends a refused save of its own again before the session ends", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    // The team's badge: a new version with the same content, so the next save is refused as this tab's own.
    db.profile.verified = true;
    db.write({});
    addLink(store, "c");
    store.logOut();
    await vi.advanceTimersByTimeAsync(10);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    expect(store.getSnapshot().status).toBe("signedOut");
  });
});

describe("flush() and reload() for the iPhone app", () => {
  it("flush() saves what is waiting and answers the new version", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    addLink(store, "c");
    const flushed = store.flush();
    await vi.advanceTimersByTimeAsync(0);
    await expect(flushed).resolves.toEqual({ updatedAt: db.row.updated_at });
    expect(db.blocks()).toEqual(["a", "b", "c"]);
  });

  it("flush() rejects when the change could not be saved", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.failWrites = true;
    addLink(store, "c");
    const refused = expect(store.flush()).rejects.toThrow("saveFailed");
    await vi.advanceTimersByTimeAsync(0);
    await refused;
  });

  it("flush() after a refused save answers the newer version it loaded", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.elsewhere([link("x")]);
    addLink(store, "stale");
    const flushed = store.flush();
    await vi.advanceTimersByTimeAsync(0);
    await expect(flushed).resolves.toEqual({ updatedAt: db.row.updated_at });
    expect(ids(store)).toEqual(["x"]);
  });

  it("reload() reads the row again and starts the editor over, without counting a conflict", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.elsewhere([link("a"), link("added-natively")]);
    await store.reload();
    expect(ids(store)).toEqual(["a", "added-natively"]);
    expect(snapshotOf(store).revision).toBe(1);
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(snapshotOf(store).baseUpdatedAt).toBe(db.row.updated_at);
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "added-natively", "c"]);
  });

  it("reload() with nothing new keeps the editor as it is", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    await store.reload();
    expect(snapshotOf(store).revision).toBe(0);
  });

  it("reload() saves a waiting change first: unchanged elsewhere, it is kept", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    addLink(store, "c");
    const reloaded = store.reload();
    await vi.advanceTimersByTimeAsync(0);
    await reloaded;
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    expect(ids(store)).toEqual(["a", "b", "c"]);
  });
});

/** The tab is closed: hidden, then `pagehide` (the page is going away; nothing of it runs after this). */
const closeTab = () => {
  vi.stubGlobal("document", { visibilityState: "hidden" });
  listeners.get("visibilitychange")?.();
  listeners.get("pagehide")?.();
};

describe("a bad network: one tab never loses a change and never sees the toast", () => {
  /** The keepalive PATCH as PostgREST applies it (`eq.` or `gte.`); the closed tab reads no answer. */
  const keepalive = (db: FakeDb) => {
    const sent: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      sent.push({ url, body: init.body as string });
      const guard = new URL(url, "http://localhost").searchParams.get("updated_at") ?? "";
      const [operator, version = ""] = guard.split(/\.(.*)/s);
      const matches = guard === "" || (operator === "eq" ? db.row.updated_at === version : operator === "gte" && db.row.updated_at >= version);
      if (matches) db.write(JSON.parse(init.body as string) as Record<string, unknown>);
      return new Promise<Response>(() => undefined);
    });
    return sent;
  };

  it("a save lands but its answer is lost, then three more attempts fail without an answer, then the network is back: every change is stored", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    // The write lands; the connection drops before its answer (and the read-back) comes.
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
    db.loseAnswers = false;
    db.failWrites = true;
    const attempts = db.writes.length;
    for (const id of ["d", "e", "f"]) {
      addLink(store, id);
      await vi.advanceTimersByTimeAsync(600);
    }
    expect(snapshotOf(store).sync).toBe("error");
    db.failWrites = false;
    db.failReads = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.writes.length - attempts).toBeGreaterThan(0);
    expect(db.blocks()).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(ids(store)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(snapshotOf(store).revision).toBe(0);
    expect(snapshotOf(store).sync).toBe("saved");
  });

  it("the same change tried again and again by the retries alone (2 s, 5 s, 15 s) never pushes the landed save out", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    db.loseAnswers = false;
    db.failWrites = true;
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(25_000);
    db.failWrites = false;
    db.failReads = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(snapshotOf(store).conflicts).toBe(0);
  });

  it("answers lost on every save: past the rebase limit the change waits like a failed save, is never dropped, and is stored once answers come back", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    // Every write lands without an answer; its read-back fails too, the next refusal's read works.
    let reads = 0;
    db.failReads = () => reads++ % 2 === 0;
    db.loseAnswers = true;
    for (const id of ["c", "d", "e", "f", "g", "h"]) {
      addLink(store, id);
      await vi.advanceTimersByTimeAsync(450);
    }
    addLink(store, "late");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(ids(store)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "late"]);
    expect(snapshotOf(store).sync).toBe("error");
    expect(snapshotOf(store).conflicts).toBe(0);
    db.loseAnswers = false;
    db.failReads = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(db.blocks()).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "late"]);
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(snapshotOf(store).revision).toBe(0);
    expect(snapshotOf(store).sync).toBe("saved");
  });

  it("past the rebase limit no save is sent at once again: the next waits for the retry delay", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    let reads = 0;
    db.failReads = () => reads++ % 2 === 0;
    db.loseAnswers = true;
    addLink(store, "c");
    // Each round: the save lands, its answer is lost; the retry is refused, finds its own page, sends again.
    await vi.advanceTimersByTimeAsync(400 + 2_000 * 4);
    const sent = db.writes.length;
    await vi.advanceTimersByTimeAsync(1_500);
    expect(db.writes.length - sent).toBeLessThanOrEqual(1);
    expect(snapshotOf(store).conflicts).toBe(0);
  });

  it("every write's answer is lost but reads get through (a connection that drops on the way back): every change is stored, no toast", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.loseAnswers = true;
    for (const id of ["c", "d", "e", "f", "g", "h", "i", "j"]) {
      addLink(store, id);
      await vi.advanceTimersByTimeAsync(650);
    }
    await vi.advanceTimersByTimeAsync(4_000);
    expect(db.blocks()).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
    expect(snapshotOf(store).conflicts).toBe(0);
    // The read-back showed each save landed: nothing waits, nothing is in doubt.
    expect(snapshotOf(store).sync).toBe("saved");
    expect(snapshotOf(store).baseUpdatedAt).toBe(db.row.updated_at);
  });

  it("the read-back after a lost answer never holds up the next save (a read that takes seconds)", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.loseAnswers = true;
    db.hangReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    db.loseAnswers = false;
    db.hangReads = false;
    const before = db.writes.length;
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(450);
    expect(db.writes.length).toBeGreaterThan(before);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(snapshotOf(store).conflicts).toBe(0);
  });

  it("a lost answer whose read-back shows the save landed: the keepalive guard is exact again", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepalive(db);
    db.loseAnswers = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    db.loseAnswers = false;
    expect(snapshotOf(store).sync).toBe("saved");
    // Another tab writes now; this tab then closes with a change: the newer page is not overwritten.
    db.elsewhere([link("a"), link("b"), link("c"), link("from-elsewhere")]);
    addLink(store, "stale");
    vi.stubGlobal("document", { visibilityState: "hidden" });
    listeners.get("visibilitychange")?.();
    expect(sent[0]?.url).toContain("updated_at=eq.");
    expect(db.blocks()).toEqual(["a", "b", "c", "from-elsewhere"]);
  });

  it.each([
    { label: "no answer at all (status 0)", status: 0, online: true, operator: "gte" },
    { label: "a server error (503)", status: 503, online: true, operator: "gte" },
    { label: "PostgREST refused it (401): nothing written", status: 401, online: true, operator: "eq" },
    { label: "the browser was offline when it was tried", status: 0, online: false, operator: "eq" },
  ])("a failed save, then the tab closes: $label → the keepalive guard is updated_at=$operator", async ({ status, online, operator }) => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepalive(db);
    vi.stubGlobal("navigator", { onLine: online });
    db.failWrites = true;
    db.failStatus = status;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(snapshotOf(store).sync).toBe("error");
    db.failWrites = false;
    closeTab();
    expect(sent[0]?.url).toContain(`updated_at=${operator}.`);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
  });

  it.each([
    { label: "no answer at all (status 0)", status: 0 },
    { label: "a server error (503)", status: 503 },
  ])("a failed save, then the tab is only hidden: $label → it waits for the read-back, then the exact guard", async ({ status }) => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepalive(db);
    db.failWrites = true;
    db.failStatus = status;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    db.failWrites = false;
    // The read-back (nothing landed) ends, and the page is still there: never the loose guard.
    vi.stubGlobal("document", { visibilityState: "hidden" });
    listeners.get("visibilitychange")?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.map((request) => new URL(request.url, "http://localhost").searchParams.get("updated_at")?.split(".")[0])).toEqual(["eq"]);
    expect(db.blocks()).toEqual(["a", "b", "c"]);
  });

  it("a save tried while the browser is offline is not taken for this tab's own: the page written elsewhere meanwhile is not overwritten on closing", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    keepalive(db);
    vi.stubGlobal("navigator", { onLine: false });
    db.failWrites = true;
    addLink(store, "fromB");
    await vi.advanceTimersByTimeAsync(500);
    db.failWrites = false;
    db.elsewhere([link("a"), link("b"), link("fromA")]);
    closeTab();
    expect(db.blocks()).toEqual(["a", "b", "fromA"]);
  });
});

describe("a lost answer, then signing out or flush()", () => {
  it("lost answer, a change, then logOut() before the store's delay: the change is stored before the session ends", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(snapshotOf(store).sync).toBe("error");
    db.loseAnswers = false;
    db.failReads = false;
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(100);
    store.logOut();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
    expect(store.getSnapshot().status).toBe("signedOut");
  });

  it("lost answer, a change, then flush(): it resolves with the stored version", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    expect(snapshotOf(store).sync).toBe("error");
    db.loseAnswers = false;
    db.failReads = false;
    addLink(store, "d");
    const flushed = store.flush();
    await vi.advanceTimersByTimeAsync(10);
    await expect(flushed).resolves.toEqual({ updatedAt: db.row.updated_at });
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
  });

  it("lost answer, a change, logOut() while the next save is on its way: kept", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    db.loseAnswers = true;
    db.failReads = true;
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    db.loseAnswers = false;
    db.failReads = false;
    db.hold = "apply";
    addLink(store, "d");
    await vi.advanceTimersByTimeAsync(450);
    store.logOut();
    db.release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(db.blocks()).toEqual(["a", "b", "c", "d"]);
  });
});

/**
 * The keepalive PATCH as PostgREST applies it (`eq.` or `gte.`), answered to a tab that is still there:
 * the new version, or no row when the guard refused it. `hold`: the answer waits for `release()`, then
 * fails without an answer (the connection dropped). `guards` records each guard's operator.
 */
function keepaliveAnswered(db: FakeDb) {
  const guards: string[] = [];
  const held: (() => void)[] = [];
  const state = { hold: false };
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    const guard = new URL(url, "http://localhost").searchParams.get("updated_at") ?? "";
    const [operator = "", version = ""] = guard.split(/\.(.*)/s);
    guards.push(operator);
    if (state.hold) return new Promise<Response>((_, reject) => held.push(() => reject(new TypeError("Load failed"))));
    const owner = new URL(url, "http://localhost").searchParams.get("profile_id") === `eq.${db.row.profile_id}`;
    const matches = owner && (guard === "" || (operator === "eq" ? db.row.updated_at === version : operator === "gte" && db.row.updated_at >= version));
    if (matches) db.write(JSON.parse(init.body as string) as Record<string, unknown>);
    return Promise.resolve(new Response(JSON.stringify(matches ? [{ updated_at: db.row.updated_at }] : []), { status: 200 }));
  });
  return {
    guards,
    hold: () => {
      state.hold = true;
    },
    failHeld: () => {
      state.hold = false;
      for (const fail of held.splice(0)) fail();
    },
  };
}
const hideTab = () => {
  vi.stubGlobal("document", { visibilityState: "hidden" });
  listeners.get("visibilitychange")?.();
};
const toggle = (store: InstanceType<typeof SupabaseAccountStore>, id: string) =>
  store.updateSite((current) => ({ ...current, page: { ...current.page, blocks: current.page.blocks.map((block) => (block.id === id ? { ...block, visible: !block.visible } : block)) } }));

describe("one document, two accounts (signed out in Settings, then another account signs in in the same tab)", () => {
  const ID2 = "9a8b7c6d-2222-4333-8444-555566667777";
  /** Account B's page in the same database: the tab signs in as B next. */
  const becomeB = (db: FakeDb) => {
    db.profile = { ...db.profile, id: ID2, username: "nora" };
    db.row = { ...db.row, profile_id: ID2, page: { profile: { username: "nora", displayName: "Nora", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" }, blocks: [link("n1"), link("n2")] }, updated_at: db.stamp() };
    db.signedOut = false;
  };
  const signInB = async (db: FakeDb, store: InstanceType<typeof SupabaseAccountStore>) => {
    becomeB(db);
    db.authListener?.("SIGNED_IN", { user: { id: ID2, email: "nora@example.com" }, access_token: "token-b" });
    await vi.advanceTimersByTimeAsync(10);
    expect(snapshotOf(store).account.id).toBe(ID2);
    expect(snapshotOf(store).sync).toBe("saved");
  };
  /** A's save lands without an answer and its read-back fails; A then goes offline and signs out. */
  const aLeavesWithALostWrite = async (db: FakeDb, store: InstanceType<typeof SupabaseAccountStore>) => {
    db.loseAnswers = true;
    db.failReads = true;
    toggle(store, "a");
    await vi.advanceTimersByTimeAsync(450);
    db.loseAnswers = false;
    db.failWrites = true;
    store.logOut();
    await vi.advanceTimersByTimeAsync(100);
    expect(store.getSnapshot().status).toBe("signedOut");
    // A's retry timers would have run out meanwhile, while signed out.
    await vi.advanceTimersByTimeAsync(60_000);
    db.failWrites = false;
    db.failReads = false;
  };

  it("B closes the tab without a change: nothing is sent, and the write B's app made stays", async () => {
    // Before, A's `dirty` and lost writes carried over: B's close sent B's own unchanged page with
    // `updated_at >= base` and overwrote what B's app had written since B's page loaded.
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepaliveAnswered(db);
    await aLeavesWithALostWrite(db, store);
    await signInB(db, store);
    db.elsewhere([link("n1"), link("n2"), link("from-noras-app")]);
    await vi.advanceTimersByTimeAsync(1_000);
    closeTab();
    await vi.advanceTimersByTimeAsync(100);
    expect(sent.guards).toEqual([]);
    expect(db.blocks()).toEqual(["n1", "n2", "from-noras-app"]);
  });

  it("B's tab is hidden instead: no conflict toast for a change B never made, and the app's write stays", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepaliveAnswered(db);
    await aLeavesWithALostWrite(db, store);
    await signInB(db, store);
    db.elsewhere([link("n1"), link("n2"), link("from-noras-app")]);
    await vi.advanceTimersByTimeAsync(1_000);
    hideTab();
    await vi.advanceTimersByTimeAsync(HIDDEN_WAIT + 1_000);
    expect(sent.guards).toEqual([]);
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(db.blocks()).toEqual(["n1", "n2", "from-noras-app"]);
  });

  it("A's keepalive is on its way when A's session ends, and fails after B signed in: nothing of it is B's", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepaliveAnswered(db);
    sent.hold();
    toggle(store, "a");
    hideTab();
    expect(sent.guards).toEqual(["eq"]);
    // A's session ends elsewhere (another tab signed out); B signs in here.
    db.authListener?.("SIGNED_OUT", null);
    await vi.advanceTimersByTimeAsync(10);
    vi.stubGlobal("document", { visibilityState: "visible" });
    await signInB(db, store);
    sent.failHeld();
    await vi.advanceTimersByTimeAsync(100);
    db.elsewhere([link("n1"), link("n2"), link("from-noras-app")]);
    closeTab();
    await vi.advanceTimersByTimeAsync(100);
    expect(sent.guards).toEqual(["eq"]);
    expect(snapshotOf(store).sync).toBe("saved");
    expect(db.blocks()).toEqual(["n1", "n2", "from-noras-app"]);
  });

  it("B signs in over A without a sign-out in between: A's waiting change and failures are not B's", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const sent = keepaliveAnswered(db);
    db.loseAnswers = true;
    db.failReads = true;
    toggle(store, "a");
    await vi.advanceTimersByTimeAsync(450);
    db.loseAnswers = false;
    db.failWrites = true;
    toggle(store, "b");
    await vi.advanceTimersByTimeAsync(450);
    expect(snapshotOf(store).sync).toBe("error");
    db.failWrites = false;
    db.failReads = false;
    await signInB(db, store);
    const writes = db.writes.length;
    db.elsewhere([link("n1"), link("n2"), link("from-noras-app")]);
    // A's retry timer would have fired here, saving B's unchanged page and showing B the conflict toast.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(db.writes.length).toBe(writes);
    expect(snapshotOf(store).conflicts).toBe(0);
    closeTab();
    await vi.advanceTimersByTimeAsync(100);
    expect(sent.guards).toEqual([]);
    expect(db.blocks()).toEqual(["n1", "n2", "from-noras-app"]);
  });
});

describe("the editor's change from the last moment (its autosave delay)", () => {
  let unregister: () => void = () => undefined;
  afterEach(() => unregister());

  it("logOut() asks the editor for it first and saves it before the session ends", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    let waiting = true;
    unregister = registerPendingEdits(() => {
      if (waiting) addLink(store, "just-typed");
      waiting = false;
    });
    store.logOut();
    await vi.advanceTimersByTimeAsync(10);
    expect(db.blocks()).toEqual(["a", "b", "just-typed"]);
    expect(store.getSnapshot().status).toBe("signedOut");
  });

  it("the store's pagehide asks the editor itself, whatever order the listeners run in", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    const bodies: string[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      db.write(JSON.parse(init.body as string) as Record<string, unknown>);
      return new Promise<Response>(() => undefined);
    });
    let waiting = true;
    unregister = registerPendingEdits(() => {
      if (waiting) addLink(store, "just-typed");
      waiting = false;
    });
    // The store's listener first (it was added before the editor's), as in a closing tab.
    listeners.get("pagehide")?.();
    expect(bodies).toHaveLength(1);
    expect(db.blocks()).toEqual(["a", "b", "just-typed"]);
  });
});
