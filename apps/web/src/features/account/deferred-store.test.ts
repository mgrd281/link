import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountSnapshot, Result } from "./types";

/** The real store and Supabase's client, as stand-ins: what the deferred store loads and hands calls to. */
const loads = vi.hoisted(() => ({ client: 0, failNext: false }));
const realStore = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let snapshot: { status: string } = { status: "signedOut" };
  return {
    listeners,
    set(next: { status: string }) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
    get: () => snapshot,
  };
});

vi.mock("@/lib/supabase/browser", () => ({
  loadBrowserSupabase: () => {
    loads.client += 1;
    if (loads.failNext) {
      loads.failNext = false;
      return Promise.reject(new Error("offline"));
    }
    return Promise.resolve({});
  },
  browserSupabase: () => ({}),
}));

vi.mock("./supabase-store", () => ({
  SupabaseAccountStore: class {
    readonly demo = false;
    subscribe = (listener: () => void) => {
      realStore.listeners.add(listener);
      return () => realStore.listeners.delete(listener);
    };
    getSnapshot = () => realStore.get();
    requestCode = (): Promise<Result> => Promise.resolve({ ok: true, pending: "code" });
    updateSite = (): Result => ({ ok: true });
    flush = () => Promise.resolve({ updatedAt: "2026-11-26T10:00:00.000001+00:00" });
    reload = () => {
      realStore.set({ status: "reloaded" });
      return Promise.resolve();
    };
  },
}));

const { DeferredAccountStore } = await import("./deferred-store");

describe("the real-account store, loaded when first asked for (ADR 0008)", () => {
  beforeEach(() => {
    loads.client = 0;
    loads.failNext = false;
    realStore.listeners.clear();
    realStore.set({ status: "signedOut" });
  });

  it("is loading until the real store is here, and on the server always", () => {
    const store = new DeferredAccountStore();
    expect(store.demo).toBe(false);
    expect(store.getSnapshot()).toEqual({ status: "loading" });
    expect(store.getServerSnapshot()).toEqual({ status: "loading" });
    expect(loads.client).toBe(0);
    // Before the real store is here no account can change its page.
    expect(store.updateSite((site) => site)).toEqual({ ok: false, error: "notFound" });
  });

  it("loads the store and the client on the first call, hands calls on and passes its changes on", async () => {
    const store = new DeferredAccountStore();
    const seen: AccountSnapshot[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));
    expect(await store.requestCode({ email: "mila@example.com", locale: "de" })).toEqual({ ok: true, pending: "code" });
    expect(loads.client).toBe(1);
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
    expect(store.updateSite((site) => site)).toEqual({ ok: true });
    realStore.set({ status: "loading" });
    expect(seen.at(-1)).toEqual({ status: "loading" });
    // Loaded once: later calls reuse it.
    await store.requestCode({ email: "mila@example.com", locale: "de" });
    expect(loads.client).toBe(1);
  });

  it("hands the iPhone app's flush and reload to the real store", async () => {
    const store = new DeferredAccountStore();
    expect(await store.flush()).toEqual({ updatedAt: "2026-11-26T10:00:00.000001+00:00" });
    await store.reload();
    expect(store.getSnapshot()).toEqual({ status: "reloaded" });
  });

  it("tries again after a failed load (offline)", async () => {
    const store = new DeferredAccountStore();
    loads.failNext = true;
    await expect(store.requestCode({ email: "mila@example.com", locale: "de" })).rejects.toThrow("offline");
    expect(await store.requestCode({ email: "mila@example.com", locale: "de" })).toEqual({ ok: true, pending: "code" });
    expect(loads.client).toBe(2);
  });
});
