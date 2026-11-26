import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountSnapshot } from "@/features/account/types";

import type { LinkyoApp } from "./app-mode";
import { announceReady, installOnApp, withdrawReady } from "./app-object";
import { installStoreBridge, READY_WAIT, SIGN_OUT_WAIT } from "./store-bridge";

/**
 * The store half of the iPhone app's bridge, against a stand-in WKWebView (the page's window with the
 * app's object and WebKit's message handler, `<html data-app>`, and whether the page is the main frame)
 * and a store stand-in whose saves the test finishes by hand. It posts through `./bridge.ts` `post()`
 * and asks `inAppMode()`, so it follows the same rules as every other message.
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

interface WebView {
  messages: unknown[];
  linkyoApp?: LinkyoApp;
  webkit: { messageHandlers: { linkyo: { postMessage: (message: unknown) => void } } };
  top: unknown;
  self: unknown;
  setTimeout: (handler: () => void, delay: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

/**
 * The page as the app's WKWebView shows it. `app`: the value of `<html data-app>` (null: none, a
 * browser); `frame`: the page runs inside a frame; `linkyoApp`: what the app's script put on the window.
 */
function webView({ app = "ios", frame = false, linkyoApp }: { app?: string | null; frame?: boolean; linkyoApp?: LinkyoApp } = {}): WebView {
  const messages: unknown[] = [];
  const win: WebView = {
    messages,
    ...(linkyoApp ? { linkyoApp } : {}),
    webkit: { messageHandlers: { linkyo: { postMessage: (message: unknown) => messages.push(message) } } },
    top: null,
    self: null,
    setTimeout: (handler, delay) => setTimeout(handler, delay),
    clearTimeout: (id) => {
      clearTimeout(id as number);
    },
  };
  win.self = win;
  win.top = frame ? { other: true } : win;
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { documentElement: { dataset: app === null ? {} : { app } } });
  return win;
}

interface App {
  flush: () => Promise<{ updatedAt: string | null }>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Every bridge a test installs is taken down after it, as the dashboard's layout does when it unmounts. */
const installed: (() => void)[] = [];
const installBridge = (...args: Parameters<typeof installStoreBridge>): (() => void) => {
  const cleanup = installStoreBridge(...args);
  installed.push(cleanup);
  return cleanup;
};

beforeEach(() => {
  vi.useFakeTimers();
  // The interface half has told the app `ready` for the test's account (see "ready comes first").
  announceReady("a1");
});
afterEach(() => {
  for (const cleanup of installed.splice(0)) cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  withdrawReady();
});

describe("store bridge", () => {
  it("installs nothing outside the app: no object, no message", () => {
    const win = webView({ app: null });
    const store = fakeStore();
    installBridge(store);
    expect(win.linkyoApp).toBeUndefined();
    store.set(signedIn({ sync: "saving" }));
    expect(win.messages).toEqual([]);
    expect(store.listeners.size).toBe(0);
  });

  it("installs nothing for a platform the web does not know: the same predicate as the rest of app mode", () => {
    // Before, any data-app value installed the store's methods while the CSS and every other part of
    // app mode (inAppMode) took the page for a browser.
    for (const app of ["android", "", "true"]) {
      const win = webView({ app });
      const store = fakeStore();
      installBridge(store);
      store.set(signedIn({ sync: "saving" }));
      expect(win.linkyoApp, app).toBeUndefined();
      expect(win.messages, app).toEqual([]);
    }
  });

  it("is the app where React took <html data-app> away and the app's object names the platform", () => {
    const win = webView({ app: null, linkyoApp: { platform: "ios", version: "1.0", bridge: 1 } });
    installBridge(fakeStore());
    expect(typeof win.linkyoApp?.flush).toBe("function");
    expect(win.messages).toEqual([{ type: "saveState", state: "saved", updatedAt: "v1" }]);
  });

  it("installs nothing in a frame inside the app, and posts nothing from there", () => {
    const win = webView({ frame: true });
    const store = fakeStore();
    installBridge(store);
    store.set(signedIn({ sync: "saving" }));
    store.set({ status: "signedOut" });
    expect(win.linkyoApp).toBeUndefined();
    expect(win.messages).toEqual([]);
  });

  it("makes window.linkyoApp when missing and keeps what the app and the interface half put there", () => {
    const navigate = () => true;
    const app: LinkyoApp = { platform: "ios", version: "1.0", bridge: 1, navigate };
    const win = webView({ linkyoApp: app });
    const cleanup = installBridge(fakeStore());
    expect(win.linkyoApp).toBe(app);
    expect(win.linkyoApp).toMatchObject({ platform: "ios", version: "1.0", bridge: 1, navigate });
    expect(typeof win.linkyoApp?.flush).toBe("function");
    expect(typeof win.linkyoApp?.reload).toBe("function");
    expect(typeof win.linkyoApp?.signOut).toBe("function");
    cleanup();
    expect(win.linkyoApp).toEqual({ platform: "ios", version: "1.0", bridge: 1, navigate });

    const bare = webView();
    installBridge(fakeStore());
    expect(Object.keys(bare.linkyoApp ?? {}).sort()).toEqual(["flush", "reload", "signOut"]);
  });

  it("flush() hands the editor's waiting change over, then resolves with the new updatedAt after the pending save", async () => {
    const win = webView();
    const store = fakeStore();
    const handOver = vi.fn();
    installBridge(store, handOver);
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
    const win = webView();
    const store = fakeStore();
    const handOver = vi.fn();
    installBridge(store, handOver);
    await (win.linkyoApp as unknown as App).reload();
    expect(handOver).toHaveBeenCalledTimes(1);
    expect(store.reload).toHaveBeenCalledTimes(1);
  });

  it("posts saveState when the save state changes, conflict once per refused save, and signedOut", () => {
    const win = webView();
    const store = fakeStore();
    installBridge(store);
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
    const win = webView();
    const store = fakeStore();
    installBridge(store);
    const done = (win.linkyoApp as unknown as App).signOut();
    store.land("v2");
    await vi.advanceTimersByTimeAsync(10);
    await done;
    expect(store.flush).toHaveBeenCalled();
    expect(store.logOut).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().status).toBe("signedOut");
  });

  it("signOut() never hangs: offline it gives up after a while and says so", async () => {
    const win = webView();
    const store = fakeStore();
    store.flush.mockImplementation(() => Promise.reject(new Error("saveFailed")));
    store.logOut.mockImplementation(() => undefined);
    installBridge(store);
    const refused = expect((win.linkyoApp as unknown as App).signOut()).rejects.toThrow("signOutTimeout");
    await vi.advanceTimersByTimeAsync(SIGN_OUT_WAIT + 1);
    await refused;
  });

  it("a rejection's string form is the bare reason, as WebKit hands it to the app (never \"Error: saveFailed\")", async () => {
    // WebKit puts a rejected promise's string form in the error the app gets
    // (userInfo[WKJavaScriptExceptionMessage]); ADR 0088 §4 lists the bare reasons.
    const win = webView();
    const store = fakeStore();
    store.flush.mockImplementation(() => Promise.reject(new Error("saveFailed")));
    store.reload.mockImplementation(() => Promise.reject(new Error("reloadFailed")));
    store.logOut.mockImplementation(() => undefined);
    installBridge(store);
    const app = win.linkyoApp as unknown as App;
    const reason = (work: Promise<unknown>) =>
      work.then(
        () => "resolved",
        (error: unknown) => ({ asString: String(error), message: error instanceof Error ? error.message : null }),
      );
    expect(await reason(app.flush())).toEqual({ asString: "saveFailed", message: "saveFailed" });
    expect(await reason(app.reload())).toEqual({ asString: "reloadFailed", message: "reloadFailed" });
    const signingOut = reason(app.signOut());
    await vi.advanceTimersByTimeAsync(SIGN_OUT_WAIT + 1);
    expect(await signingOut).toEqual({ asString: "signOutTimeout", message: "signOutTimeout" });
  });

  describe("right after the web view opened (the store is still loading)", () => {
    const loading: AccountSnapshot = { status: "loading" };

    it("flush() waits for the session check, then answers the version (never null for 'not known yet')", async () => {
      const win = webView();
      const store = fakeStore(loading);
      installBridge(store);
      let answer: { updatedAt: string | null } | null = null;
      const flushed = (win.linkyoApp as unknown as App).flush().then((value) => (answer = value));
      await vi.advanceTimersByTimeAsync(100);
      expect(store.flush).not.toHaveBeenCalled();
      expect(answer).toBeNull();
      store.set(signedIn());
      await vi.advanceTimersByTimeAsync(0);
      expect(store.flush).toHaveBeenCalledTimes(1);
      store.land("v2");
      await flushed;
      expect(answer).toEqual({ updatedAt: "v2" });
    });

    it("flush() and reload() reject when the store never finishes loading, instead of answering 'signed out'", async () => {
      const win = webView();
      const store = fakeStore(loading);
      installBridge(store);
      const app = win.linkyoApp as unknown as App;
      const flushed = expect(app.flush()).rejects.toThrow("storeLoading");
      // As the app reads it: the bare reason.
      const reloaded = app.reload().catch((error: unknown) => String(error));
      await vi.advanceTimersByTimeAsync(READY_WAIT + 1);
      await flushed;
      expect(await reloaded).toBe("storeLoading");
      expect(store.flush).not.toHaveBeenCalled();
      expect(store.reload).not.toHaveBeenCalled();
    });

    it("signOut() waits for the session check, then saves and ends the session", async () => {
      const win = webView();
      const store = fakeStore(loading);
      installBridge(store);
      const done = (win.linkyoApp as unknown as App).signOut();
      await vi.advanceTimersByTimeAsync(100);
      expect(store.logOut).not.toHaveBeenCalled();
      store.set(signedIn());
      await vi.advanceTimersByTimeAsync(0);
      store.land("v2");
      await vi.advanceTimersByTimeAsync(10);
      await done;
      expect(store.flush).toHaveBeenCalledTimes(1);
      expect(store.logOut).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot().status).toBe("signedOut");
    });

    it("signOut() ends nothing more when the check finds no session", async () => {
      const win = webView();
      const store = fakeStore(loading);
      installBridge(store);
      const done = (win.linkyoApp as unknown as App).signOut();
      store.set({ status: "signedOut" });
      await vi.advanceTimersByTimeAsync(0);
      await done;
      expect(store.flush).not.toHaveBeenCalled();
      expect(store.logOut).not.toHaveBeenCalled();
    });

    it("signOut() still ends the session when the store is loading after the wait", async () => {
      const win = webView();
      const store = fakeStore(loading);
      installBridge(store);
      const done = (win.linkyoApp as unknown as App).signOut();
      await vi.advanceTimersByTimeAsync(READY_WAIT + 10);
      await done;
      expect(store.flush).not.toHaveBeenCalled();
      expect(store.logOut).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot().status).toBe("signedOut");
    });
  });

  it("never throws when the app's handler is gone", () => {
    const win = webView();
    win.webkit = {
      messageHandlers: {
        linkyo: {
          postMessage: () => {
            throw new Error("gone");
          },
        },
      },
    };
    const store = fakeStore();
    expect(() => installBridge(store)).not.toThrow();
    expect(() => {
      store.set(signedIn({ sync: "saving" }));
      store.set({ status: "signedOut" });
    }).not.toThrow();
  });
});

describe("ready comes first (ADR 0087 decision 4)", () => {
  it("holds the save state until the interface half has posted ready for this account, then tells it", () => {
    // Before, the store's half posted saveState as soon as the store loaded, ahead of ready.
    withdrawReady();
    const win = webView();
    const store = fakeStore();
    installBridge(store);
    store.set(signedIn({ sync: "saving" }));
    expect(win.messages).toEqual([]);
    announceReady("a1");
    expect(win.messages).toEqual([{ type: "saveState", state: "saving", updatedAt: "v1" }]);
    store.set(signedIn({ sync: "saved", baseUpdatedAt: "v2" }));
    expect(win.messages.at(-1)).toEqual({ type: "saveState", state: "saved", updatedAt: "v2" });
  });

  it("another account's save state waits for the ready that names it", () => {
    const win = webView();
    const store = fakeStore();
    installBridge(store);
    expect(win.messages).toEqual([{ type: "saveState", state: "saved", updatedAt: "v1" }]);
    const other = signedIn({ account: { id: "a2", email: "noor@example.com", username: "noor", createdAt: "" }, baseUpdatedAt: "w1" });
    store.set(other);
    expect(win.messages).toHaveLength(1);
    announceReady("a2");
    expect(win.messages.at(-1)).toEqual({ type: "saveState", state: "saved", updatedAt: "w1" });
  });

  it("mounted again (the dashboard left and opened again): the save state is told again after the new ready", () => {
    const win = webView();
    const store = fakeStore();
    const first = installBridge(store);
    first();
    withdrawReady();
    installBridge(store);
    expect(win.messages).toEqual([{ type: "saveState", state: "saved", updatedAt: "v1" }]);
    announceReady("a1");
    expect(win.messages).toEqual([
      { type: "saveState", state: "saved", updatedAt: "v1" },
      { type: "saveState", state: "saved", updatedAt: "v1" },
    ]);
  });

  it("told again after every new ready, also for the same account and an unchanged state (a page restored from the back/forward cache mounts nothing again)", () => {
    // Before, an unchanged state was never told twice, so the app, waiting for the messages after the
    // ready of a restored page, never heard the save state.
    const win = webView();
    const store = fakeStore();
    installBridge(store);
    expect(win.messages).toEqual([{ type: "saveState", state: "saved", updatedAt: "v1" }]);
    // Left for the back/forward cache, then restored: the interface half posts ready again.
    withdrawReady();
    announceReady("a1");
    expect(win.messages).toEqual([
      { type: "saveState", state: "saved", updatedAt: "v1" },
      { type: "saveState", state: "saved", updatedAt: "v1" },
    ]);
    // Said again without a new ready (React's development checks remount the island): nothing more.
    announceReady("a1", false);
    expect(win.messages).toHaveLength(2);
  });
});

describe("an object the app froze or sealed (ADR 0087 asks for a plain one)", () => {
  const locks: [string, (app: LinkyoApp) => LinkyoApp][] = [
    ["frozen", (app) => Object.freeze(app)],
    ["sealed", (app) => Object.seal(app)],
    ["not extensible", (app) => Object.preventExtensions(app)],
  ];
  for (const [name, lock] of locks) {
    it(`${name}: never throws; a plain copy with the app's fields takes both halves' methods`, () => {
      const locked = lock({ platform: "ios", version: "1.0", bridge: 1 });
      const win = webView({ linkyoApp: locked });
      let cleanupStore = (): void => undefined;
      let cleanupUi = (): void => undefined;
      expect(() => {
        cleanupStore = installBridge(fakeStore());
        cleanupUi = installOnApp({ navigate: () => true, back: () => false });
      }).not.toThrow();
      expect(win.linkyoApp).not.toBe(locked);
      expect(win.linkyoApp).toMatchObject({ platform: "ios", version: "1.0", bridge: 1 });
      expect(Object.keys(win.linkyoApp ?? {}).sort()).toEqual(["back", "bridge", "flush", "navigate", "platform", "reload", "signOut", "version"]);
      cleanupStore();
      cleanupUi();
      expect(win.linkyoApp).toEqual({ platform: "ios", version: "1.0", bridge: 1 });
    });
  }

  it("a read-only window.linkyoApp: nothing is installed, nothing throws", () => {
    const win = webView();
    const locked = Object.freeze({ platform: "ios", version: "1.0", bridge: 1 });
    Object.defineProperty(win, "linkyoApp", { value: locked, writable: false, configurable: false });
    expect(() => installBridge(fakeStore())).not.toThrow();
    expect(() => installOnApp({ navigate: () => true })).not.toThrow();
    expect(win.linkyoApp).toBe(locked);
  });

  it("a method the app fixed on its object stays the app's; the others are installed", () => {
    const own = () => false;
    const app = { platform: "ios" } as LinkyoApp;
    Object.defineProperty(app, "navigate", { value: own, writable: false, enumerable: true });
    const win = webView({ linkyoApp: app });
    expect(() => installOnApp({ navigate: () => true, back: () => true })).not.toThrow();
    expect(win.linkyoApp?.navigate).toBe(own);
    expect(typeof win.linkyoApp?.back).toBe("function");
  });
});

describe("the two halves on window.linkyoApp, in either order", () => {
  // The dashboard layout mounts the store's half (StoreBridge) before the interface half
  // (AppModeIsland); a remount or a later screen can turn that around. Both install through
  // installOnApp: the same object, nobody's methods replaced, each half takes off only its own.
  const navigate = () => true;
  const back = () => false;
  const names = (app: LinkyoApp | undefined) => Object.keys(app ?? {}).sort();

  for (const order of ["store first", "interface first"] as const) {
    it(`${order}: one object with all five methods and the app's own fields; each cleanup removes only its own`, () => {
      const made: LinkyoApp = { platform: "ios", version: "1.0", bridge: 1 };
      const win = webView({ linkyoApp: made });
      const install = { store: () => installBridge(fakeStore()), ui: () => installOnApp({ navigate, back }) };
      const [first, second] = order === "store first" ? [install.store(), install.ui()] : [install.ui(), install.store()];
      expect(win.linkyoApp).toBe(made);
      expect(names(win.linkyoApp)).toEqual(["back", "bridge", "flush", "navigate", "platform", "reload", "signOut", "version"]);
      expect(win.linkyoApp?.navigate).toBe(navigate);
      first();
      expect(win.linkyoApp).toBe(made);
      expect(names(win.linkyoApp)).toEqual(order === "store first" ? ["back", "bridge", "navigate", "platform", "version"] : ["bridge", "flush", "platform", "reload", "signOut", "version"]);
      second();
      expect(win.linkyoApp).toEqual({ platform: "ios", version: "1.0", bridge: 1 });
    });

    it(`${order}, without the app's object: the first half makes it and the second uses the same one`, () => {
      const win = webView();
      const install = { store: () => installBridge(fakeStore()), ui: () => installOnApp({ navigate, back }) };
      if (order === "store first") install.store();
      else install.ui();
      const made = win.linkyoApp;
      expect(made).toBeDefined();
      if (order === "store first") install.ui();
      else install.store();
      expect(win.linkyoApp).toBe(made);
      expect(names(win.linkyoApp)).toEqual(["back", "flush", "navigate", "reload", "signOut"]);
    });
  }

  it("a half installed again (a remount) replaces only its own methods, and its old cleanup removes nothing", () => {
    const win = webView();
    const oldUi = installOnApp({ navigate, back });
    const store = installBridge(fakeStore());
    const navigate2 = () => true;
    const newUi = installOnApp({ navigate: navigate2, back });
    oldUi();
    // The old cleanup leaves the new navigate (it is no longer its own) and the store's methods.
    expect(win.linkyoApp?.navigate).toBe(navigate2);
    expect(typeof win.linkyoApp?.flush).toBe("function");
    newUi();
    store();
    expect(win.linkyoApp).toEqual({});
  });
});

describe("which half defines what", () => {
  // The contract (PLAN §1.5): the interface half has navigate and back, the store's half flush,
  // reload and signOut; neither file may define the other's (a second definition would replace it).
  const source = (file: string) => readFileSync(path.resolve(import.meta.dirname, file), "utf8");
  const defines = (text: string, name: string) => new RegExp(`(?:\\b${name}\\s*:|\\.${name}\\s*=|\\b(?:const|function)\\s+${name}\\b)`).test(text);

  it("bridge.ts and the island define no flush, reload or signOut", () => {
    for (const file of ["bridge.ts", "app-mode-island.tsx"]) {
      for (const name of ["flush", "reload", "signOut"]) expect(defines(source(file), name), `${file}: ${name}`).toBe(false);
    }
  });

  it("store-bridge.ts defines no navigate or back, and posts only through bridge.ts", () => {
    const text = source("store-bridge.ts");
    for (const name of ["navigate", "back"]) expect(defines(text, name), name).toBe(false);
    expect(text).not.toMatch(/webkit|messageHandlers|postMessage/);
    expect(text).toMatch(/from "\.\/bridge"/);
  });

  it("both halves install through installOnApp", () => {
    for (const file of ["store-bridge.ts", "app-mode-island.tsx"]) {
      const text = source(file);
      expect(text, file).toMatch(/installOnApp\(\{/);
      expect(text, file).not.toMatch(/linkyoApp\s*\?\?=|\.linkyoApp\s*=/);
    }
  });
});
