/**
 * The part of Linkyo an address belongs to, from its path without the language prefix: the creator
 * dashboard (/app, black and grey), the team area (/admin, teal) or the website. A "not found" or an
 * error page takes that part's colours and offers its way back.
 */
export type ErrorArea = "site" | "app" | "admin";

const within = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

export function areaOf(pathname: string): ErrorArea {
  if (within(pathname, "/app")) return "app";
  if (within(pathname, "/admin")) return "admin";
  return "site";
}

/** Orders and proposals exist only with real accounts; in the demo their addresses say so. */
export const isOrderPath = (pathname: string): boolean => within(pathname, "/app/orders") || within(pathname, "/app/proposals");

/** Where an area's main way back leads. */
export const AREA_HOME: Record<ErrorArea, "/" | "/app" | "/admin"> = { site: "/", app: "/app", admin: "/admin" };
