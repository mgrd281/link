import { isUsernameFormat, RESERVED_USERNAMES } from "@linkyo/blocks/rules";

import { routing } from "@/i18n/routing";

/**
 * Creator pages live at the root: `/<username>`. The proxy rewrites that address to the internal
 * route `/u/<username>` (its own root layout, in the page's language) before next-intl sees it, so
 * the address people share stays short and no language prefix or cookie is involved. Pure: the
 * proxy passes whether real accounts are on.
 */

const LOCALES: readonly string[] = routing.locales;

/** The one segment of a path like "/mila" or "/mila/", or null for "/", "/a/b" and the like. */
function singleSegment(pathname: string): string | null {
  const match = /^\/([^/]+)\/?$/.exec(pathname);
  return match?.[1] ?? null;
}

/** A segment that could be someone's page: a valid address, not a language and not a product route. */
function isCreatorName(segment: string): boolean {
  return isUsernameFormat(segment) && !LOCALES.includes(segment) && !RESERVED_USERNAMES.has(segment);
}

/** "/mila" → "/u/mila" when real accounts are on and "mila" could be someone's page; otherwise null. */
export function creatorRewrite(pathname: string, enabled: boolean): string | null {
  if (!enabled) return null;
  const segment = singleSegment(pathname);
  return segment !== null && isCreatorName(segment) ? `/u/${segment}` : null;
}

/** "/Mila" → "/mila" (a permanent redirect): addresses are lowercase, people type them as they like. */
export function creatorRedirect(pathname: string): string | null {
  const segment = singleSegment(pathname);
  if (segment === null || segment === segment.toLowerCase()) return null;
  const lower = segment.toLowerCase();
  return isCreatorName(lower) ? `/${lower}` : null;
}
