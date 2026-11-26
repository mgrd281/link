/**
 * App mode: the dashboard inside Linkyo's iPhone app (ADR draft "app mode"). The app shows the web
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
  [method: string]: unknown;
}

/** The global the app shares with the page (read through a cast: other modules may type it too). */
export type AppWindow = Window & { linkyoApp?: LinkyoApp };

/** The platform the app named on `<html data-app>`, or null in a browser (and on the server). */
export function appPlatform(): AppPlatform | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.app;
  return APP_PLATFORMS.find((platform) => platform === value) ?? null;
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
