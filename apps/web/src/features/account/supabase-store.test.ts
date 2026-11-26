import type { Block } from "@linkyo/blocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Site } from "./types";

/**
 * The save guard (ADR draft-app-sync): the store writes the page only while the row still has the
 * version it read or last saved. Against an in-memory stand-in for the `sites` row that behaves as
 * Postgres does: every write gets a new `updated_at`, `sites_guard` writes the account's address and
 * badge into the page, and a filter on `updated_at` that no longer matches changes nothing.
 */

vi.mock("@/features/app/media-upload", () => ({ uploadDataUrl: () => Promise.reject(new Error("no uploads in this test")) }));

const { SupabaseAccountStore } = await import("./supabase-store");

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
  /** The write reaches the database, but its answer is an error (the connection dropped on the way back). */
  loseAnswers = false;
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
          if (this.failWrites) return { data: null, error: { message: "fetch failed" } };
          this.writes.push({ filters: { ...filters }, values });
          const matches = filters.profile_id === this.row.profile_id && (!("updated_at" in filters) || filters.updated_at === this.row.updated_at);
          if (!matches || this.refuseWrites || this.signedOut) return { data: null, error: null };
          this.write(values);
          if (this.loseAnswers) return { data: null, error: { message: "Load failed" } };
          return { data: { page: clone(this.row.page), updated_at: this.row.updated_at }, error: null };
        }
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
    db.loseAnswers = true;
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

describe("hidden while a save is on its way, then back (a phone switching apps)", () => {
  it("the keepalive's answer comes before the late answer of the save that landed first: the base stays the newer one", async () => {
    const db = new FakeDb();
    const store = await signedIn(db);
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      const version = new URL(url, "http://localhost").searchParams.get("updated_at")?.replace(/^gte\./, "") ?? "";
      if (db.row.updated_at < version) return Promise.resolve(new Response("[]", { status: 200 }));
      db.write(JSON.parse(init.body as string) as Record<string, unknown>);
      return Promise.resolve(new Response(JSON.stringify([{ updated_at: db.row.updated_at }]), { status: 200 }));
    });
    db.hold = "answer";
    addLink(store, "c");
    await vi.advanceTimersByTimeAsync(500);
    addLink(store, "d");
    vi.stubGlobal("document", { visibilityState: "hidden" });
    listeners.get("visibilitychange")?.();
    await vi.advanceTimersByTimeAsync(0);
    const newest = db.row.updated_at;
    expect(snapshotOf(store).baseUpdatedAt).toBe(newest);
    // Back on screen; the first save's answer (an older version) arrives only now.
    vi.stubGlobal("document", { visibilityState: "visible" });
    db.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(snapshotOf(store).baseUpdatedAt).toBe(newest);
    addLink(store, "e");
    await vi.advanceTimersByTimeAsync(500);
    expect(db.blocks()).toEqual(["a", "b", "c", "d", "e"]);
    expect(snapshotOf(store).conflicts).toBe(0);
    expect(snapshotOf(store).revision).toBe(0);
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
