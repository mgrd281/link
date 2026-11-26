import type { AppWindow, LinkyoApp } from "./app-mode";

/*
 * The web's methods on `window.linkyoApp` (ADR 0087, 0088), and the order of the bridge's first
 * messages. Apart from `./app-mode.ts`, which every page that reads the app signal carries (the
 * website, creator pages through the bridge's core, the root error page): only the dashboard installs
 * methods, so only its chunks load this.
 */

/**
 * `window.linkyoApp`, where the web may add its methods: the app's own object (it is made first in the
 * app), or one the web makes when it is missing. An object the app froze, sealed or made
 * non-extensible cannot take methods: it is replaced by a plain copy of its fields (the platform, the
 * version, the bridge version), so the app's object never breaks the dashboard (ADR 0087 asks for a
 * plain, extensible object). Null when even that is impossible (the app made `window.linkyoApp`
 * read-only). Call only in app mode, in the browser.
 */
export function linkyoApp(): LinkyoApp | null {
  const own = window as AppWindow;
  const current = own.linkyoApp;
  if (current && typeof current === "object" && Object.isExtensible(current)) return current;
  const made: LinkyoApp = current && typeof current === "object" ? { ...current } : {};
  try {
    own.linkyoApp = made;
  } catch {
    return null;
  }
  return own.linkyoApp === made ? made : null;
}

/** The methods the web puts on `window.linkyoApp`: each half names only its own. */
export type AppMethods = Partial<Pick<LinkyoApp, "navigate" | "back" | "flush" | "reload" | "signOut">>;

/**
 * Puts methods on `window.linkyoApp` (made if missing, see `linkyoApp`) and answers how to take them
 * off again: only those still the ones put there. The interface half (`navigate`, `back`,
 * `./app-mode-island.tsx`) and the store's half (`flush`, `reload`, `signOut`, `./store-bridge.ts`)
 * both install through here, so neither replaces the object or removes the other's methods, whatever
 * order they are installed and taken off in. Never throws: a method the app's object will not take
 * is left out. Call only in app mode, in the browser.
 */
export function installOnApp(methods: AppMethods): () => void {
  const app = linkyoApp();
  if (!app) return () => undefined;
  const put: [string, unknown][] = [];
  for (const [name, method] of Object.entries(methods)) {
    try {
      app[name] = method;
      if (app[name] === method) put.push([name, method]);
    } catch {
      // A property the app fixed on its object: it stays the app's.
    }
  }
  return () => {
    for (const [name, method] of put) if (app[name] === method) Reflect.deleteProperty(app, name);
  };
}

// ─── The order of the first messages ─────────────────────────────────────────────────────────

/**
 * The account the dashboard's last `ready` named (null: signed out); undefined before its first
 * `ready` and after the dashboard was left. The interface half (`./app-mode-island.tsx`) posts `ready`,
 * then `route`; the store's half (`./store-bridge.ts`) holds an account's `saveState` until the
 * `ready` that names that account, so `ready` is always the first message after the dashboard mounts
 * (ADR 0087 decision 4).
 */
let announced: string | null | undefined;
/**
 * How many `ready` messages this document has posted. The app re-reads the state from the messages
 * after every `ready`, so the store's half tells its save state again after each one, also when it
 * names the same account (a page restored from the back/forward cache mounts nothing again).
 */
let readies = 0;
const waiting = new Set<() => void>();

/**
 * The interface half posted `ready` for this account (`posted`: false when it only says again what
 * this mount already told the app, as React's development checks remount it): what waited may post now.
 */
export function announceReady(accountId: string | null, posted = true): void {
  announced = accountId;
  if (posted) readies += 1;
  for (const listener of [...waiting]) listener();
}

/** How many `ready` messages this document has posted (the store's half tells its save state after each). */
export const readyCount = (): number => readies;

/** The dashboard was left (the interface half unmounted): the next mount posts `ready` first again. */
export function withdrawReady(): void {
  announced = undefined;
}

/** The account the last `ready` named, null for signed out, undefined for none since the dashboard mounted. */
export const readyFor = (): string | null | undefined => announced;

/** Calls `listener` after every `ready`; answers how to stop. */
export function onReady(listener: () => void): () => void {
  waiting.add(listener);
  return () => {
    waiting.delete(listener);
  };
}
