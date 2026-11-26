/**
 * App mode: the dashboard inside Linkyo's iPhone app (ADR 0087). The app shows the web
 * dashboard in one WKWebView and draws its own bars, so the web hides its own chrome, every purchase
 * surface and the install hints there, and talks to the app through `./bridge.ts`.
 *
 * The signal comes from the app, before the first paint (a document-start script):
 * - `<html data-app="ios">`, which the CSS rules in `app/globals.css` (`:root[data-app="ios"]`) key on;
 * - `window.linkyoApp = { platform, version, bridge: 1 }`, where the web adds `navigate` and `back`
 *   (`./app-mode-island.tsx`) and the store adds `flush`, `reload` and `signOut` (`./store-bridge.ts`);
 * - and `LinkyoApp/<version>` in the user agent, for the server (the analytics filter).
 *
 * The signal only hides interface. It grants nothing: any page can set an attribute on itself, so no
 * check of rights, price or data may ever read it.
 */

/**
 * The platforms whose shell sets `data-app` (only the iPhone app so far). `app/globals.css` keys its
 * rules on the same values (`:root[data-app="ios"]`): a new platform is added in both places, so the
 * chrome never hides where the purchase links still show.
 */
export const APP_PLATFORMS = ["ios"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

/** What the app puts on `window.linkyoApp`, and what the web adds to it. Every field may be missing. */
export interface LinkyoApp {
  platform?: unknown;
  version?: unknown;
  bridge?: unknown;
  /** Opens a path of this site with the client router (no reload); false for a path it refuses. */
  navigate?: (path: string) => boolean;
  /** Goes to where the screen's "back" leads (`route.back`); false where there is nowhere to go. */
  back?: () => boolean;
  /** Saves everything waiting and answers the page's version on the server (`./store-bridge.ts`). */
  flush?: () => Promise<{ updatedAt: string | null }>;
  /** Reads the page again after the app changed it (`./store-bridge.ts`). */
  reload?: () => Promise<void>;
  /** Saves, then ends the web view's session (`./store-bridge.ts`). */
  signOut?: () => Promise<void>;
  [method: string]: unknown;
}

/** The global the app shares with the page (read through a cast: other modules may type it too). */
export type AppWindow = Window & { linkyoApp?: LinkyoApp };

/**
 * The platform the app named on `<html data-app>`, or null in a browser (and on the server). Where the
 * attribute is gone, the platform the app named on `window.linkyoApp` (see `keepAppSignal`).
 */
export function appPlatform(): AppPlatform | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.app ?? (typeof window === "undefined" ? undefined : (window as AppWindow).linkyoApp?.platform);
  return APP_PLATFORMS.find((platform) => platform === value) ?? null;
}

/**
 * Puts `<html data-app>` back where React took it off. When React renders a whole document in the
 * browser (the server's stream stopped at an error or a "not found" in a layout, as for a dashboard
 * address that can never exist: `features/errors/gated-routes.ts`), it takes `<html>` over with only the
 * attributes it renders, after the app's document-start script ran, and that script does not run again.
 * The object the app put on `window` stays, and names the platform: the attribute is set from it, so
 * the CSS (`:root[data-app="ios"]`) applies again. Does nothing in a browser.
 */
export function keepAppSignal(): void {
  const platform = appPlatform();
  if (platform && document.documentElement.dataset.app !== platform) document.documentElement.dataset.app = platform;
}

/** True inside Linkyo's app (`<html data-app>` names a known platform). */
export const inAppMode = (): boolean => appPlatform() !== null;

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
