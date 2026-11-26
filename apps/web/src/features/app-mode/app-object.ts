import type { AppWindow, LinkyoApp } from "./app-mode";

/*
 * The web's methods on `window.linkyoApp` (ADR 0087, 0088). Apart from `./app-mode.ts`, which every page
 * that reads the app signal carries (the website, creator pages through the bridge's core, the root
 * error page): only the dashboard installs methods, so only its chunks load this.
 */

/**
 * `window.linkyoApp`, created when the app's script has not made it (it is made first in the app; a
 * missing object must not break the web's methods). Call only in app mode, in the browser.
 */
export function linkyoApp(): LinkyoApp {
  const own = window as AppWindow;
  const current = own.linkyoApp;
  if (current && typeof current === "object") return current;
  const created: LinkyoApp = {};
  own.linkyoApp = created;
  return created;
}

/** The methods the web puts on `window.linkyoApp`: each half names only its own. */
export type AppMethods = Partial<Pick<LinkyoApp, "navigate" | "back" | "flush" | "reload" | "signOut">>;

/**
 * Puts methods on `window.linkyoApp` (made if missing; the object is never replaced) and answers how
 * to take them off again: only those still the ones put there. The interface half (`navigate`, `back`,
 * `./app-mode-island.tsx`) and the store's half (`flush`, `reload`, `signOut`, `./store-bridge.ts`)
 * both install through here, so neither replaces the object or removes the other's methods, whatever
 * order they are installed and taken off in. Call only in app mode, in the browser.
 */
export function installOnApp(methods: AppMethods): () => void {
  const app = linkyoApp();
  Object.assign(app, methods);
  return () => {
    for (const [name, method] of Object.entries(methods)) if (app[name] === method) Reflect.deleteProperty(app, name);
  };
}
