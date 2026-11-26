"use client";

import { useEffect } from "react";

import { accountStore, handOverPendingEdits } from "@/features/account/store";
import type { AccountStore } from "@/features/account/types";

/**
 * The store half of the bridge to the iPhone app (PLAN §1.5, ADR draft-app-sync). Only in app mode
 * (the native shell sets `data-app` on <html> before the first paint) and only in the main frame:
 *
 * - native → web: `window.linkyoApp.flush()` saves everything waiting and answers `{ updatedAt }`, the
 *   page's version the native write builds on; `reload()` reads the page again after that write;
 *   `signOut()` saves, then ends this session (the WebView's own, PLAN D3);
 * - web → native: `saveState { state, updatedAt }` whenever the save state changes ("conflict": a save
 *   was refused because the page changed elsewhere, and the newer version is shown now), and
 *   `signedOut` when the session ends.
 *
 * `data-app` only decides whether these are installed; it grants nothing (every write still goes
 * through the account's own session and the server's rules). The interface half (navigate, back,
 * route and the other messages) is `./bridge.ts`.
 */

export type SaveState = "saving" | "saved" | "error" | "conflict";

export type StoreMessage = { type: "saveState"; state: SaveState; updatedAt: string | null } | { type: "signedOut" };

/** What this file uses of the page's window: the app's object, WebKit's handler and the root's data attributes. */
export interface AppWindow {
  top: unknown;
  document: { documentElement: { dataset: Record<string, string | undefined> } };
  linkyoApp?: Record<string, unknown> | undefined;
  webkit?: { messageHandlers?: { linkyo?: { postMessage: (message: unknown) => void } | undefined } | undefined } | undefined;
  setTimeout: (handler: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
}

export type BridgeStore = Pick<AccountStore, "demo" | "subscribe" | "getSnapshot" | "flush" | "reload" | "logOut">;

/** How long `signOut()` waits for the session to end (offline, it ends only on this device: native then clears the WebView's data). */
export const SIGN_OUT_WAIT = 10_000;

/** In the iPhone app (the native shell marks <html> before the first paint), in the page itself rather than a frame. */
export function inApp(win: AppWindow): boolean {
  return Boolean(win.document.documentElement.dataset.app) && win.top === win;
}

/** Tells the app; does nothing outside it and never throws (the page works the same without the app). */
export function postToApp(win: AppWindow, message: StoreMessage): void {
  try {
    if (inApp(win)) win.webkit?.messageHandlers?.linkyo?.postMessage(message);
  } catch {
    // A handler that is gone (the app is closing) changes nothing for the page.
  }
}

/** Saves what is waiting (best effort), then signs out and waits until the session has ended here. */
async function signOut(win: AppWindow, store: BridgeStore, handOver: () => void): Promise<void> {
  handOver();
  // Signing out never waits on a save that cannot succeed: what was saved stays, the rest is gone with the session.
  await store.flush().catch(() => undefined);
  if (store.getSnapshot().status !== "signedIn") return;
  await new Promise<void>((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    const timer = win.setTimeout(() => {
      unsubscribe?.();
      reject(new Error("signOutTimeout"));
    }, SIGN_OUT_WAIT);
    unsubscribe = store.subscribe(() => {
      if (store.getSnapshot().status !== "signedOut") return;
      win.clearTimeout(timer);
      unsubscribe?.();
      resolve();
    });
    store.logOut();
  });
}

/**
 * Installs `flush`, `reload` and `signOut` on `window.linkyoApp` (made if missing) and reports the save
 * state to the app. Outside app mode it installs nothing. Answers the cleanup.
 */
export function installStoreBridge(win: AppWindow, store: BridgeStore = accountStore, handOver: () => void = handOverPendingEdits): () => void {
  if (!inApp(win)) return () => undefined;
  win.linkyoApp ??= {};
  const app = win.linkyoApp;
  const methods = {
    // The editor's change from the last moment goes to the store first, then everything is saved.
    flush: (): Promise<{ updatedAt: string | null }> => {
      handOver();
      return store.flush();
    },
    reload: (): Promise<void> => {
      handOver();
      return store.reload();
    },
    signOut: (): Promise<void> => signOut(win, store, handOver),
  };
  Object.assign(app, methods);

  const first = store.getSnapshot();
  let conflicts = first.status === "signedIn" ? (first.conflicts ?? 0) : 0;
  let signedIn = false;
  let last: string | null = null;
  const report = () => {
    const snapshot = store.getSnapshot();
    if (snapshot.status === "signedIn") {
      signedIn = true;
      const seen = snapshot.conflicts ?? 0;
      const state: SaveState = seen > conflicts ? "conflict" : (snapshot.sync ?? "saved");
      conflicts = seen;
      // Real accounts: the version on the server; the demo saves at once, so its page's own time.
      const updatedAt = snapshot.baseUpdatedAt ?? (store.demo ? snapshot.site.updatedAt : null);
      const key = `${state}|${updatedAt ?? ""}`;
      if (key === last) return;
      last = key;
      postToApp(win, { type: "saveState", state, updatedAt });
    } else if (snapshot.status === "signedOut" && signedIn) {
      signedIn = false;
      last = null;
      postToApp(win, { type: "signedOut" });
    }
  };
  const unsubscribe = store.subscribe(report);
  report();
  return () => {
    unsubscribe();
    // Only ours: the interface half keeps its own methods.
    for (const [name, method] of Object.entries(methods)) if (app[name] === method) Reflect.deleteProperty(app, name);
  };
}

/** Mounted once in the dashboard layout: the store half of the bridge, in the iPhone app only. */
export function StoreBridge(): null {
  useEffect(() => installStoreBridge(window), []);
  return null;
}
