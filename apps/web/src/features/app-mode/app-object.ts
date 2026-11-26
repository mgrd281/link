import type { AppWindow, LinkyoApp } from "./app-mode";

/*
 * The web's methods on `window.linkyoApp` (ADR 0087, 0088). Apart from `./app-mode.ts`, which every page
 * that reads the app signal carries (the website, creator pages through the bridge's core, the root
 * error page): only the dashboard installs methods, so only its chunks load this.
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
