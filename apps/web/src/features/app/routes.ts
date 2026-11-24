/*
 * The dashboard's places, in one table: the name each screen shows in the bars, the tab it belongs
 * to, where "back" leads and the rail place (section) it lives under. Settings is pushed over the
 * tab it was opened from (its "origin"), and its panes and Invite are pushed over Settings, as
 * in iOS. "Arbeiten" (/app/work) is a second view of the Page tab, beside the content list.
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

/** "Arbeiten": the page's projects as covers, a second view of the Page tab (beside "Inhalte"). */
export const WORK_HREF = "/app/work";

/** The invite program's screen. Code, data and URLs say "referral"; only the copy says "invite". */
export const INVITE_HREF = "/app/invite";

/** A place in the wide-screen rail: the four tabs, Invite and Settings. */
export type SectionKey = TabKey | "invite" | "settings";

export const SECTION_HREF: Record<SectionKey, string> = { ...TAB_HREF, invite: INVITE_HREF, settings: SETTINGS_HREF };

/** A message key under `app`. */
export type RouteTitle =
  | "nav.home"
  | "nav.page"
  | "nav.design"
  | "nav.analytics"
  | "nav.work"
  | "nav.settings"
  | "settings.panes.account"
  | "settings.panes.address"
  | "settings.panes.legal"
  | "settings.panes.plan"
  | "invite.title";

export interface RouteInfo {
  title: RouteTitle;
  /** The tab this screen is; null for pushed screens. */
  tab: TabKey | null;
  /** Where back leads: the tab Settings was opened from, Settings itself, or nowhere (a tab). */
  parent: "origin" | typeof SETTINGS_HREF | null;
  /** The rail place this screen belongs to; the section panel lists its parts. */
  section: SectionKey;
}

const ROUTES: Record<string, RouteInfo> = {
  "/app": { title: "nav.home", tab: "home", parent: null, section: "home" },
  "/app/editor": { title: "nav.page", tab: "page", parent: null, section: "page" },
  // A view of the Page tab, not a pushed screen: the tab bar and the rail keep Page marked, no back link.
  "/app/work": { title: "nav.work", tab: "page", parent: null, section: "page" },
  "/app/design": { title: "nav.design", tab: "design", parent: null, section: "design" },
  "/app/analytics": { title: "nav.analytics", tab: "analytics", parent: null, section: "analytics" },
  "/app/settings": { title: "nav.settings", tab: null, parent: "origin", section: "settings" },
  "/app/settings/account": { title: "settings.panes.account", tab: null, parent: SETTINGS_HREF, section: "settings" },
  "/app/settings/address": { title: "settings.panes.address", tab: null, parent: SETTINGS_HREF, section: "settings" },
  "/app/settings/legal": { title: "settings.panes.legal", tab: null, parent: SETTINGS_HREF, section: "settings" },
  // The plan and billing pane (Stage 3, WP3.5 builds its screen).
  "/app/settings/plan": { title: "settings.panes.plan", tab: null, parent: SETTINGS_HREF, section: "settings" },
  // Phones reach Invite from a Settings row (always there), so back leads to Settings, like the
  // legal notice opened from Home. Wide screens reach it from the rail and show no back link.
  "/app/invite": { title: "invite.title", tab: null, parent: SETTINGS_HREF, section: "invite" },
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
  if (isSettingsPath(path)) return { title: "nav.settings", tab: null, parent: SETTINGS_HREF, section: "settings" };
  return { title: "nav.home", tab: "home", parent: null, section: "home" };
}

/**
 * The tab the phone's tab bar marks: the tab being opened (tapped, its screen still loading), else
 * the screen's own tab. A pushed screen (Settings, its panes, Invite) belongs to no tab, so the bar
 * marks none: it does not claim that Settings is "Stats" because Settings was opened from there.
 * Back still leads to that tab (`RouteInfo.parent`).
 */
export function markedTab(pathname: string, pendingTab?: TabKey | null): TabKey | null {
  return pendingTab ?? routeInfo(pathname).tab;
}

/**
 * The places whose parts the section panel lists on wide screens (ADR 0063, narrowed by the
 * "dashboard on laptops" decision): only places with four or more parts, or with parts that are
 * pages of their own (Settings). Home, Page (with Arbeiten) and Design have two or three parts and
 * use the width for their content instead; Design keeps its own tabs in its card. Stats lists its
 * parts only while there are numbers to show (`counted`).
 */
export function hasSectionPanel(section: SectionKey, counted: boolean): boolean {
  if (section === "analytics") return counted;
  return section === "invite" || section === "settings";
}

/** The Design screen's tabs, in order. The selected one lives in the URL (`?tab=`). */
export const DESIGN_TABS = ["color", "fonts", "buttons"] as const;
export type DesignTab = (typeof DESIGN_TABS)[number];

/** The tab a `?tab=` value names; no value or an unknown one is the first tab, Color. */
export const designTabFrom = (value: string | null): DesignTab => DESIGN_TABS.find((tab) => tab === value) ?? "color";

/**
 * The ids the section panel jumps to. Each target takes focus (`tabIndex={-1}`), and only these are
 * honoured as a `#hash` when a screen loads.
 */
export const NAV_ANCHORS = {
  homeNext: "home-next",
  homeLink: "home-link",
  homeTodo: "home-todo",
  homeWeek: "stats-title",
  pageProfile: "page-profile",
  pageContent: "blocks-title",
  designTemplate: "design-template",
  designCustomize: "design-customize",
  statsViews: "views-chart-title",
  statsLinks: "top-links-title",
  statsSources: "sources-title",
  statsCountries: "countries-title",
  statsDevices: "devices-title",
  inviteLink: "invite-link",
  inviteRewards: "invite-rewards",
  invitePeople: "invite-people",
  inviteRules: "invite-rules",
} as const;
