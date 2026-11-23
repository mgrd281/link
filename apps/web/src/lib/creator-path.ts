import { isProjectSlug, isUsernameFormat, RESERVED_USERNAMES } from "@linkyo/blocks/rules";

import { routing } from "@/i18n/routing";

/**
 * Creator pages live at the root: `/<username>`, and their projects one level down at
 * `/<username>/<slug>`. The proxy rewrites those addresses to the internal routes `/u/<username>`
 * and `/u/<username>/<slug>` (their own root layout, in the page's language) before next-intl sees
 * them, so the addresses people share stay short and no language prefix or cookie is involved. Pure:
 * the proxy passes whether real accounts are on.
 */

const LOCALES: readonly string[] = routing.locales;

/** The one segment of a path like "/mila" or "/mila/", or null for "/", "/a/b" and the like. */
function singleSegment(pathname: string): string | null {
  const match = /^\/([^/]+)\/?$/.exec(pathname);
  return match?.[1] ?? null;
}

/** The two segments of a path like "/mila/hafenlicht" or "/mila/hafenlicht/", or null for any other depth. */
export function twoSegments(pathname: string): [string, string] | null {
  const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  return match?.[1] && match[2] ? [match[1], match[2]] : null;
}

/** A segment that could be someone's page: a valid address, not a language and not a product route. */
function isCreatorName(segment: string): boolean {
  return isUsernameFormat(segment) && !LOCALES.includes(segment) && !RESERVED_USERNAMES.has(segment);
}

/**
 * "/mila" → "/u/mila" and "/mila/hafenlicht" → "/u/mila/hafenlicht" when real accounts are on, the
 * first part could be someone's page and the second a project's address; otherwise null. Every
 * first-level route of the app is a reserved name (and "p" and "i" are too short for one), so a
 * product route is never taken for a project.
 */
export function creatorRewrite(pathname: string, enabled: boolean): string | null {
  if (!enabled) return null;
  const segment = singleSegment(pathname);
  if (segment !== null) return isCreatorName(segment) ? `/u/${segment}` : null;
  const pair = twoSegments(pathname);
  if (pair === null) return null;
  const [name, project] = pair;
  return isCreatorName(name) && isProjectSlug(project) ? `/u/${name}/${project}` : null;
}

/**
 * "/Mila" → "/mila" and "/Mila/Hafenlicht" → "/mila/hafenlicht" (a permanent redirect): addresses
 * are lowercase, people type them as they like.
 */
export function creatorRedirect(pathname: string): string | null {
  const segment = singleSegment(pathname);
  if (segment !== null) {
    if (segment === segment.toLowerCase()) return null;
    const lower = segment.toLowerCase();
    return isCreatorName(lower) ? `/${lower}` : null;
  }
  const pair = twoSegments(pathname);
  if (pair === null) return null;
  const [name, project] = pair;
  if (name === name.toLowerCase() && project === project.toLowerCase()) return null;
  const lowerName = name.toLowerCase();
  const lowerProject = project.toLowerCase();
  return isCreatorName(lowerName) && isProjectSlug(lowerProject) ? `/${lowerName}/${lowerProject}` : null;
}
