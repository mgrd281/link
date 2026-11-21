/*
 * The dashboard's places, in one table: the name each screen shows in the bars, the tab it belongs
 * to, and where "back" leads. Settings is pushed over the tab it was opened from (its "origin"),
 * and its three panes are pushed over Settings, as in iOS.
 */

export type TabKey = "home" | "page" | "design" | "analytics";

export const TABS: readonly TabKey[] = ["home", "page", "design", "analytics"];

export const TAB_HREF: Record<TabKey, string> = {
  home: "/app",
  page: "/app/editor",
  design: "/app/design",
  analytics: "/app/analytics",
};

export const SETTINGS_HREF = "/app/settings";

/** A message key under `app`. */
export type RouteTitle =
  | "nav.home"
  | "nav.page"
  | "nav.design"
  | "nav.analytics"
  | "nav.settings"
  | "settings.panes.account"
  | "settings.panes.address"
  | "settings.panes.legal";

export interface RouteInfo {
  title: RouteTitle;
  /** The tab this screen is; null for pushed screens. */
  tab: TabKey | null;
  /** Where back leads: the tab Settings was opened from, Settings itself, or nowhere (a tab). */
  parent: "origin" | typeof SETTINGS_HREF | null;
}

const ROUTES: Record<string, RouteInfo> = {
  "/app": { title: "nav.home", tab: "home", parent: null },
  "/app/editor": { title: "nav.page", tab: "page", parent: null },
  "/app/design": { title: "nav.design", tab: "design", parent: null },
  "/app/analytics": { title: "nav.analytics", tab: "analytics", parent: null },
  "/app/settings": { title: "nav.settings", tab: null, parent: "origin" },
  "/app/settings/account": { title: "settings.panes.account", tab: null, parent: SETTINGS_HREF },
  "/app/settings/address": { title: "settings.panes.address", tab: null, parent: SETTINGS_HREF },
  "/app/settings/legal": { title: "settings.panes.legal", tab: null, parent: SETTINGS_HREF },
};

/** Session storage: the last dashboard path ("Fertig" on the own page returns there). */
export const LAST_APP_PATH_KEY = "linkyo.lastAppPath";

/** Session storage: the tab Settings was opened from. */
export const ORIGIN_TAB_KEY = "linkyo.originTab";

/** A path "Fertig" may lead back to: inside the dashboard, not the own page itself. */
export const isReturnPath = (path: string | null): path is string =>
  !!path && (path === "/app" || path.startsWith("/app/")) && path !== "/app/preview" && !path.startsWith("/app/preview/");

/** Settings and everything under it. */
export const isSettingsPath = (pathname: string): boolean => pathname === SETTINGS_HREF || pathname.startsWith(`${SETTINGS_HREF}/`);

/** What the shell shows for a path (without the locale prefix). Unknown paths count as Start. */
export function routeInfo(pathname: string): RouteInfo {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const known = ROUTES[path];
  if (known) return known;
  if (isSettingsPath(path)) return { title: "nav.settings", tab: null, parent: SETTINGS_HREF };
  return { title: "nav.home", tab: "home", parent: null };
}
