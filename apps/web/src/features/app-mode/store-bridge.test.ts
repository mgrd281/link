import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountSnapshot } from "@/features/account/types";

import { installStoreBridge, postToApp, SIGN_OUT_WAIT, type AppWindow } from "./store-bridge";

/**
 * The store half of the iPhone app's bridge, against a fake window (the app's object and WebKit's
 * message handler) and a store stand-in whose saves the test finishes by hand.
 */

vi.mock("@/features/account/store", () => ({ accountStore: {}, handOverPendingEdits: () => undefined }));

const site = { page: { profile: {}, blocks: [] }, theme: {}, legal: {}, onboarded: true, updatedAt: "local-time" } as never;
const signedIn = (extra: Partial<Extract<AccountSnapshot, { status: "signedIn" }>> = {}): AccountSnapshot => ({
  status: "signedIn",
  account: { id: "a1", email: "mira@example.com", username: "mira", createdAt: "" },
  site,
  sync: "saved",
  baseUpdatedAt: "v1",
  ...extra,
});

function fakeStore(initial: AccountSnapshot = signedIn()) {
  const listeners = new Set<() => void>();
  let snapshot = initial;
  let pending: (() => void) | null = null;
  const store = {
    demo: false,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    set(next: AccountSnapshot) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
    // A save on its way: flush() resolves once the test lets it land.
    flush: vi.fn(
      () =>
        new Promise<{ updatedAt: string | null }>((resolve) => {
          pending = () => resolve({ updatedAt: snapshot.status === "signedIn" ? (snapshot.baseUpdatedAt ?? null) : null });
        }),
    ),
    land(updatedAt: string) {
      store.set(signedIn({ baseUpdatedAt: updatedAt }));
      pending?.();
    },
    reload: vi.fn(() => Promise.resolve()),
    logOut: vi.fn(() => {
      setTimeout(() => store.set({ status: "signedOut" }), 5);
    }),
    listeners,
  };
  return store;
}

function fakeWindow({ app = true, frame = false, linkyoApp }: { app?: boolean; frame?: boolean; linkyoApp?: Record<string, unknown> } = {}) {
  const messages: unknown[] = [];
  const win: AppWindow & { messages: unknown[] } = {
    messages,
    top: null,
    document: { documentElement: { dataset: app ? { app: "ios" } : {} } },
    ...(linkyoApp ? { linkyoApp } : {}),
    webkit: { messageHandlers: { linkyo: { postMessage: (message: unknown) => messages.push(message) } } },
    setTimeout: (handler, delay) => setTimeout(handler, delay) as unknown as number,
    clearTimeout: (id) => {
      clearTimeout(id);
    },
  };
  win.top = frame ? {} : win;
  return win;
}

interface App { flush: () => Promise<{ updatedAt: string | null }>; reload: () => Promise<void>; signOut: () => Promise<void> }

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("store bridge", () => {
  it("installs nothing outside the app: no object, no message", () => {
    const win = fakeWindow({ app: false });
    const store = fakeStore();
    installStoreBridge(win, store);
    expect(win.linkyoApp).toBeUndefined();
    store.set(signedIn({ sync: "saving" }));
    expect(win.messages).toEqual([]);
    expect(store.listeners.size).toBe(0);
  });

  it("installs nothing in a frame inside the app, and posts nothing from there", () => {
    const win = fakeWindow({ frame: true });
    installStoreBridge(win, fakeStore());
    expect(win.linkyoApp).toBeUndefined();
    postToApp(win, { type: "signedOut" });
    expect(win.messages).toEqual([]);
  });

  it("makes window.linkyoApp when missing and keeps what the app and the interface half put there", () => {
    const navigate = () => undefined;
    const win = fakeWindow({ linkyoApp: { platform: "ios", version: "1.0", bridge: 1, navigate } });
    const cleanup = installStoreBridge(win, fakeStore());
    expect(win.linkyoApp).toMatchObject({ platform: "ios", version: "1.0", bridge: 1, navigate });
    expect(typeof win.linkyoApp?.flush).toBe("function");
    expect(typeof win.linkyoApp?.reload).toBe("function");
    expect(typeof win.linkyoApp?.signOut).toBe("function");
    cleanup();
    expect(win.linkyoApp).toEqual({ platform: "ios", version: "1.0", bridge: 1, navigate });

    const bare = fakeWindow();
    installStoreBridge(bare, fakeStore());
    expect(Object.keys(bare.linkyoApp ?? {}).sort()).toEqual(["flush", "reload", "signOut"]);
  });

  it("flush() hands the editor's waiting change over, then resolves with the new updatedAt after the pending save", async () => {
    const win = fakeWindow();
    const store = fakeStore();
    const handOver = vi.fn();
    installStoreBridge(win, store, handOver);
    const app = win.linkyoApp as unknown as App;
    let answer: { updatedAt: string | null } | null = null;
    const flushed = app.flush().then((value) => (answer = value));
    expect(handOver).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(answer).toBeNull();
    store.land("v2");
    await flushed;
    expect(answer).toEqual({ updatedAt: "v2" });
  });

  it("reload() hands over the waiting change and asks the store to read the page again", async () => {
    const win = fakeWindow();
    const store = fakeStore();
    const handOver = vi.fn();
    installStoreBridge(win, store, handOver);
    await (win.linkyoApp as unknown as App).reload();
    expect(handOver).toHaveBeenCalledTimes(1);
    expect(store.reload).toHaveBeenCalledTimes(1);
  });

  it("posts saveState when the save state changes, conflict once per refused save, and signedOut", () => {
    const win = fakeWindow();
    const store = fakeStore();
    installStoreBridge(win, store);
    store.set(signedIn({ sync: "saving" }));
    store.set(signedIn({ sync: "saving" }));
    store.set(signedIn({ sync: "saved", baseUpdatedAt: "v2" }));
    store.set(signedIn({ sync: "error", baseUpdatedAt: "v2" }));
    store.set(signedIn({ sync: "saved", baseUpdatedAt: "v3", conflicts: 1, revision: 1 }));
    store.set(signedIn({ sync: "saving", baseUpdatedAt: "v3", conflicts: 1, revision: 1 }));
    store.set({ status: "signedOut" });
    expect(win.messages).toEqual([
      { type: "saveState", state: "saved", updatedAt: "v1" },
      { type: "saveState", state: "saving", updatedAt: "v1" },
      { type: "saveState", state: "saved", updatedAt: "v2" },
      { type: "saveState", state: "error", updatedAt: "v2" },
      { type: "saveState", state: "conflict", updatedAt: "v3" },
      { type: "saveState", state: "saving", updatedAt: "v3" },
      { type: "signedOut" },
    ]);
  });

  it("signOut() saves first, then ends the session and resolves once it has ended", async () => {
    const win = fakeWindow();
    const store = fakeStore();
    installStoreBridge(win, store);
    const done = (win.linkyoApp as unknown as App).signOut();
    store.land("v2");
    await vi.advanceTimersByTimeAsync(10);
    await done;
    expect(store.flush).toHaveBeenCalled();
    expect(store.logOut).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().status).toBe("signedOut");
  });

  it("signOut() never hangs: offline it gives up after a while and says so", async () => {
    const win = fakeWindow();
    const store = fakeStore();
    store.flush.mockImplementation(() => Promise.reject(new Error("saveFailed")));
    store.logOut.mockImplementation(() => undefined);
    installStoreBridge(win, store);
    const refused = expect((win.linkyoApp as unknown as App).signOut()).rejects.toThrow("signOutTimeout");
    await vi.advanceTimersByTimeAsync(SIGN_OUT_WAIT + 1);
    await refused;
  });

  it("never throws when the app's handler is gone", () => {
    const win = fakeWindow();
    win.webkit = {
      messageHandlers: {
        linkyo: {
          postMessage: () => {
            throw new Error("gone");
          },
        },
      },
    };
    expect(() => {
      postToApp(win, { type: "signedOut" });
    }).not.toThrow();
  });
});
