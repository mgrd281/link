"use client";

import { useEffect } from "react";

import { accountStore, handOverPendingEdits } from "@/features/account/store";
import type { AccountSnapshot, AccountStore } from "@/features/account/types";

import { inAppMode } from "./app-mode";
import { installOnApp, onReady, readyCount, readyFor } from "./app-object";
import { inMainFrame, post, type SaveState } from "./bridge";

/**
 * The store half of the bridge to the iPhone app (PLAN §1.5, ADR 0088). Only in app mode
 * (`inAppMode()`: the native shell sets `data-app` on <html> before the first paint) and only in the
 * main frame, the same rules as every other message (`./bridge.ts`):
 *
 * - native → web: `window.linkyoApp.flush()` saves everything waiting and answers `{ updatedAt }`, the
 *   page's version the native write builds on (an opaque string: sent back exactly as received);
 *   `reload()` reads the page again after that write; `signOut()` saves, then ends this session (the
 *   WebView's own, PLAN D3). Right after the web view opens, all three first wait for the store's
 *   session check: until then "no version" would read as signed out, and a sign-out would end nothing;
 * - web → native, through `post()`: `saveState { state, updatedAt }` whenever the save state changes
 *   ("conflict": a save was refused because the page changed elsewhere, and the newer version is shown
 *   now), and `signedOut` when the session ends.
 *
 * `data-app` only decides whether these are installed; it grants nothing (every write still goes
 * through the account's own session and the server's rules). The interface half (navigate, back,
 * route and the other messages) is `./bridge.ts` and `./app-mode-island.tsx`; both halves install
 * through `installOnApp`, so neither replaces the other's methods, whichever mounts first.
 */

export type BridgeStore = Pick<AccountStore, "demo" | "subscribe" | "getSnapshot" | "flush" | "reload" | "logOut">;

/** How long `signOut()` waits for the session to end (offline, it ends only on this device: native then clears the WebView's data). */
export const SIGN_OUT_WAIT = 10_000;
/** How long the bridge waits for the store's first session check (the web view has just opened). */
export const READY_WAIT = 10_000;

type Status = AccountSnapshot["status"];

/**
 * A refused call as the app reads it. WebKit hands a rejected `callAsyncJavaScript` promise to the app
 * as an error that carries the rejection's string form (`userInfo[WKJavaScriptExceptionMessage]`); a
 * plain Error's is "Error: saveFailed". This one's is the bare reason ("saveFailed"), the word ADR 0088
 * §4 lists. It is still an Error, with the reason as its message.
 */
export class BridgeRejection extends Error {
  override name = "BridgeRejection";

  override toString(): string {
    return this.message;
  }
}

/** Every rejection of a bridge method, whatever threw it, reaches the app as the bare reason. */
const bare = <T>(work: () => Promise<T>): Promise<T> =>
  work().catch((error: unknown) => {
    throw error instanceof BridgeRejection ? error : new BridgeRejection(error instanceof Error ? error.message : String(error));
  });

/**
 * Resolves once the store's status is one `reached` accepts (checked after `begin` and on every
 * change), and rejects with `reason` after `limit` ms.
 */
function until(store: BridgeStore, reached: (status: Status) => boolean, reason: string, limit: number, begin: () => void = () => undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      unsubscribe?.();
      reject(new Error(reason));
    }, limit);
    const check = () => {
      if (!reached(store.getSnapshot().status)) return;
      window.clearTimeout(timer);
      unsubscribe?.();
      resolve();
    };
    unsubscribe = store.subscribe(check);
    begin();
    check();
  });
}

/** The store knows whether there is a session: at once, except right after the web view opened. */
const ready = (store: BridgeStore): Promise<void> =>
  store.getSnapshot().status === "loading" ? until(store, (status) => status !== "loading", "storeLoading", READY_WAIT) : Promise.resolve();

/** Saves what is waiting (best effort), then signs out and waits until the session has ended here. */
async function signOut(store: BridgeStore, handOver: () => void): Promise<void> {
  handOver();
  // Still loading after the wait: signed in or not, the session (if any) is ended all the same.
  if (store.getSnapshot().status === "loading") await ready(store).catch(() => undefined);
  if (store.getSnapshot().status === "signedOut") return;
  // Signing out never waits on a save that cannot succeed: what was saved stays, the rest is gone with the session.
  if (store.getSnapshot().status === "signedIn") await store.flush().catch(() => undefined);
  if (store.getSnapshot().status === "signedOut") return;
  await until(store, (status) => status === "signedOut", "signOutTimeout", SIGN_OUT_WAIT, () => {
    store.logOut();
  });
}

/**
 * Installs `flush`, `reload` and `signOut` on `window.linkyoApp` (made if missing) and reports the save
 * state to the app. Outside app mode, and in a frame, it installs nothing. Answers the cleanup.
 */
export function installStoreBridge(store: BridgeStore = accountStore, handOver: () => void = handOverPendingEdits): () => void {
  if (!inAppMode() || !inMainFrame()) return () => undefined;
  const uninstall = installOnApp({
    // The editor's change from the last moment goes to the store first, then everything is saved.
    // `{ updatedAt: null }` means signed out; a store still loading after the wait rejects instead.
    flush: (): Promise<{ updatedAt: string | null }> =>
      bare(async () => {
        handOver();
        await ready(store);
        return store.flush();
      }),
    reload: (): Promise<void> =>
      bare(async () => {
        handOver();
        await ready(store);
        return store.reload();
      }),
    signOut: (): Promise<void> => bare(() => signOut(store, handOver)),
  });

  const first = store.getSnapshot();
  let conflicts = first.status === "signedIn" ? (first.conflicts ?? 0) : 0;
  let signedIn = false;
  let last: string | null = null;
  const report = () => {
    const snapshot = store.getSnapshot();
    if (snapshot.status === "signedIn") {
      // The app hears an account's save state only after the `ready` that names it (the interface
      // half posts it, ADR 0087 decision 4): `ready` is always the first message.
      if (readyFor() !== snapshot.account.id) return;
      signedIn = true;
      const seen = snapshot.conflicts ?? 0;
      const state: SaveState = seen > conflicts ? "conflict" : (snapshot.sync ?? "saved");
      conflicts = seen;
      // Real accounts: the version on the server; the demo saves at once, so its page's own time.
      const updatedAt = snapshot.baseUpdatedAt ?? (store.demo ? snapshot.site.updatedAt : null);
      // After every `ready` the app reads the state again: told once more, even unchanged.
      const key = `${String(readyCount())}|${state}|${updatedAt ?? ""}`;
      if (key === last) return;
      last = key;
      post({ type: "saveState", state, updatedAt });
    } else if (snapshot.status === "signedOut" && signedIn) {
      signedIn = false;
      last = null;
      post({ type: "signedOut" });
    }
  };
  const unsubscribe = store.subscribe(report);
  const stopWaiting = onReady(report);
  report();
  return () => {
    unsubscribe();
    stopWaiting();
    // Only ours: the interface half keeps its own methods.
    uninstall();
  };
}

/** Mounted once in the dashboard layout: the store half of the bridge, in the iPhone app only. */
export function StoreBridge(): null {
  useEffect(() => installStoreBridge(), []);
  return null;
}
