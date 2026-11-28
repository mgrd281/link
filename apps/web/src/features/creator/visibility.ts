import { SEARCH_DESCRIPTION_MAX, type Page, type Profile } from "@linkyo/blocks";

/*
 * Settings › Sichtbarkeit as the public page reads it (D-09): the paused page, the texts search engines
 * and link cards show, and whether search engines may index the page. Pure: the creator routes use it
 * through public-page.ts, and the dashboard's previews (settings/visibility-screen.tsx) directly.
 */

/** The part of a public page these helpers read (`PublicPage` in public-page.ts). */
interface Shown {
  page: Page;
  paused?: boolean | undefined;
}

/**
 * What a paused page still shows: the name and the photo, in the page's language, with no line, no
 * numbers, no hero and no block. The visibility settings stay (the metadata reads the pause).
 */
export function pausedPage(page: Page): Page {
  const { username, displayName, avatar, verified, locale, visibility } = page.profile;
  return { profile: { username, displayName, bio: "", avatar, verified, locale, ...(visibility ? { visibility } : {}) }, blocks: [] };
}

/** A text that says something, trimmed; undefined for none or only spaces. */
const filled = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
};

/** Text cut to `max` characters at most, with an ellipsis when it was longer. */
const clipped = (line: string, max: number) => (Array.from(line).length > max ? `${Array.from(line).slice(0, max - 1).join("").trimEnd()}…` : line);

/**
 * How search engines and link cards name the page (Settings › Sichtbarkeit): the owner's search title
 * and description, else the name and the creator's own line (tagline, else bio, at most 160
 * characters). A paused page has no description.
 */
export function searchTexts(profile: Profile, paused = false): { title: string; description: string } {
  const own = profile.visibility;
  const title = filled(own?.title) ?? profile.displayName;
  if (paused) return { title, description: "" };
  const line = [own?.description, profile.tagline, profile.bio].map((value) => value?.trim() ?? "").find(Boolean) ?? "";
  return { title, description: clipped(line, SEARCH_DESCRIPTION_MAX) };
}

/**
 * The page as its link card draws it (`ogCard` shows the name and the tagline, else the bio): the
 * search title and description in their place, so the card says what the search result says. A paused
 * page keeps its name and photo only (`pausedPage` left no line).
 */
export function cardPage(found: Shown): Page {
  const { profile } = found.page;
  const own = profile.visibility;
  const title = filled(own?.title);
  const description = found.paused ? undefined : filled(own?.description);
  if (!title && !description) return found.page;
  return { ...found.page, profile: { ...profile, ...(title ? { displayName: title } : {}), ...(description ? { tagline: description } : {}) } };
}

/** Whether search engines may index the page and follow its links: not while paused, not when the owner said no. */
export const indexable = (found: Shown): boolean => !found.paused && found.page.profile.visibility?.search !== false;

