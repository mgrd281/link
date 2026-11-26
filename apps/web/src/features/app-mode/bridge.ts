import { inAppMode } from "./app-mode";

/*
 * The web's half of the bridge to Linkyo's iPhone app (ADR draft "app mode", contract version 1).
 * Messages go to `webkit.messageHandlers.linkyo`, which the app installs; it accepts them only from
 * the main frame of our own host. The web posts only in app mode and only from the main frame, and
 * posting never throws: in a browser every call here answers false and the caller does what it did
 * before (a download link, the system share sheet, copy).
 *
 * Downloads and shares with a file are in `./bridge-files.ts`; this core also reaches creator pages
 * (`lib/haptics.ts`, the share button and the live reminder), so it stays small. The other direction, `window.linkyoApp`:
 * `navigate` and `back` (`./app-mode-island.tsx`), `flush`, `reload` and `signOut` (`./store-bridge.ts`,
 * the store's half).
 */

/** The handler's name: `webkit.messageHandlers.linkyo`. */
export const HANDLER = "linkyo";

/** A file handed to the app, its bytes as base64 (no data: prefix). */
export interface BridgeFile {
  name: string;
  mime: string;
  base64: string;
}

/** What the web tells the app. Every message is a plain object with a `type`. */
export type BridgeMessage =
  /** The web is listening (`navigate`, `back` installed) and knows the session: after load and when it changes. */
  | { type: "ready"; signedIn: boolean; accountId: string | null }
  /** The dashboard shows another screen: its path (with the language), its name and where back leads (null: nowhere, or a screen the web does not name). */
  | { type: "route"; path: string; title: string | null; back: string | null }
  /** Opens the system share sheet with a link, words and/or a file. */
  | { type: "share"; title?: string | undefined; text?: string | undefined; url?: string | undefined; file?: BridgeFile | undefined }
  /** A file the web would download (an export, a CSV, a picture): the app offers to save or share it. */
  | ({ type: "download" } & BridgeFile)
  /** A light tap of haptic feedback, from a user's tap. */
  | { type: "haptic"; style: "light" }
  /**
   * The block sheet that `?edit=<id>` opened was closed (saved, cancelled or the block deleted); with
   * `missing`, at once: the page has no block of that id (deleted elsewhere), so no sheet opened.
   */
  | { type: "editClosed"; id: string; missing?: true | undefined }
  /** Opens an address of ours outside the app, in Safari. */
  | { type: "openExternal"; url: string }
  /**
   * The save state changed (`./store-bridge.ts`): "conflict" when a save was refused because the page
   * changed elsewhere and the newer version is shown now; `updatedAt` is the page's version on the
   * server, an opaque string the app sends back exactly as received (null: not known).
   */
  | { type: "saveState"; state: SaveState; updatedAt: string | null }
  /** The web view's session ended (`./store-bridge.ts`). */
  | { type: "signedOut" };

/** The store's save state, as `saveState` reports it. */
export type SaveState = "saving" | "saved" | "error" | "conflict";

interface Handler {
  postMessage: (body: unknown) => void;
}

type WebkitWindow = Window & { webkit?: { messageHandlers?: Record<string, Handler | undefined> } };

/**
 * The page itself, not a frame inside another (an embed, a page shown inside another): only the main
 * frame speaks for the app or takes its calls. False on the server and where the window cannot be read.
 */
export function inMainFrame(): boolean {
  try {
    return typeof window !== "undefined" && window.top === window.self;
  } catch {
    return false;
  }
}

/** The app's handler, when this page may post to it: app mode, the main frame, a handler that exists. */
function handler(): Handler | null {
  try {
    if (!inMainFrame() || !inAppMode()) return null;
    const found = (window as WebkitWindow).webkit?.messageHandlers?.[HANDLER];
    return found && typeof found.postMessage === "function" ? found : null;
  } catch {
    return null;
  }
}

/** True where messages reach the app: decide with it before doing the browser's way. */
export const bridgeAvailable = (): boolean => handler() !== null;

/** Sends one message to the app. False when it was not sent (a browser, a frame, an error); never throws. */
export function post(message: BridgeMessage): boolean {
  const target = handler();
  if (!target) return false;
  try {
    // Plain data only: undefined fields are dropped, so the app reads a clean dictionary.
    target.postMessage(JSON.parse(JSON.stringify(message)) as unknown);
    return true;
  } catch {
    return false;
  }
}

/** Bytes as base64 (no data: prefix), in slices: one call with every byte would overflow the stack. */
export function base64OfBytes(bytes: Uint8Array): string {
  const SLICE = 0x8000;
  let binary = "";
  for (let at = 0; at < bytes.length; at += SLICE) binary += String.fromCharCode(...bytes.subarray(at, at + SLICE));
  return btoa(binary);
}

/** In the app: a light haptic tap played by the app. False in a browser (lib/haptics.ts does its own). */
export const appHaptic = (): boolean => post({ type: "haptic", style: "light" });

/** In the app: opens an address of this site in Safari. False in a browser (the link opens as a link). */
export function openExternal(path: string): boolean {
  if (!bridgeAvailable()) return false;
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    return post({ type: "openExternal", url: url.href });
  } catch {
    return false;
  }
}
