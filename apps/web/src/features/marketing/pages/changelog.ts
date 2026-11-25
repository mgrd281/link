/**
 * The changelog of /changelog: what reached the live site, newest first. The dates are the days the
 * work landed on the production branch (git history, UTC; docs/DECISIONS has the decisions behind
 * them). Only what visitors and creators can use on the live site is listed: switched-off parts
 * (payments, the AI builder) have no entry until they are switched on.
 *
 * The words live in the messages under `sitePages.changelog.entries.<key>` (`title` and `items`, a
 * list of lines). A new entry goes on top.
 */
export interface ChangelogEntry {
  /** ISO day, `YYYY-MM-DD`. */
  date: string;
  key: string;
  /** Where to read more on this site, if anywhere. */
  href?: "/portfolio" | "/templates" | "/sicherheit" | "/hilfe";
}

export const CHANGELOG = [
  { date: "2026-11-25", key: "statistics", href: "/sicherheit" },
  { date: "2026-11-25", key: "polish" },
  { date: "2026-11-24", key: "portfolioTemplates", href: "/portfolio" },
  { date: "2026-11-24", key: "arabicAndLaptops" },
  { date: "2026-11-24", key: "portfolioSection", href: "/portfolio" },
  { date: "2026-11-23", key: "projects", href: "/portfolio" },
  { date: "2026-11-22", key: "realAccounts" },
  { date: "2026-11-21", key: "dashboard" },
] as const satisfies readonly ChangelogEntry[];

export type ChangelogKey = (typeof CHANGELOG)[number]["key"];

/** A day as people read it, in their language, with Western digits (the site's rule for Arabic too). */
export function formatDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC", numberingSystem: "latn" }).format(new Date(`${date}T12:00:00Z`));
}
