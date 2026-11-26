import { routeInfo, SETTINGS_HREF, TAB_HREF, type RouteTitle, type TabKey } from "@/features/app/routes";
import { routing, type Locale } from "@/i18n/routing";

/**
 * What the `route` message says about a dashboard path (without the language): the screen's name (a
 * message key under `app`) and where back leads, both from the dashboard's one table of places
 * (features/app/routes.ts). A screen outside that table (the welcome flow, "View my page", the AI
 * builder, an order, a proposal) has no name there: the app names it itself, and back is the app's.
 */
export function routeParts(pathname: string, origin: TabKey): { title: RouteTitle | null; back: string | null } {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const info = routeInfo(path);
  // routeInfo answers Start for any path it does not know; only /app itself is Start.
  const known = path === TAB_HREF.home || info.title !== "nav.home";
  if (!known) return { title: null, back: null };
  const back = info.parent === "origin" ? TAB_HREF[origin] : info.parent === SETTINGS_HREF ? SETTINGS_HREF : null;
  return { title: info.title, back };
}

/** Longest path `navigate` takes (a block id and a query fit easily). */
const MAX_PATH = 2048;

/**
 * Where `linkyoApp.navigate(path)` leads: a path of this site (`/de/app/editor?edit=…`, or without
 * the language, `/app/design`), split into its language and the rest, for the client router. Null for
 * anything else: another host, a protocol-relative or backslashed address, a non-string.
 */
export function navigationTarget(path: unknown, origin: string): { locale: Locale | null; href: string } | null {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(path, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  const [, first = "", ...rest] = url.pathname.split("/");
  const locale = routing.locales.find((candidate) => candidate === first) ?? null;
  const pathname = locale ? `/${rest.join("/")}` : url.pathname;
  return { locale, href: `${pathname}${url.search}${url.hash}` };
}
