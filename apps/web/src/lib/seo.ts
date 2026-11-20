import { routing } from "@/i18n/routing";

/**
 * What search engines may do with a page. Public marketing pages are indexed; private areas (the
 * dashboard, the team area), sign-in screens, internal pages (design system, prototypes) and the
 * example and concept pages (fictional people, and unofficial pages of real ones) are not.
 */
export const NOINDEX = { index: false, follow: false } as const;

/**
 * The same page in each language, for search engines (hreflang) and the canonical address of this
 * one. German is the default ("x-default").
 */
export function localeAlternates(path: string, locale: string) {
  const at = (code: string) => `/${code}${path}`;
  return {
    canonical: at(locale),
    languages: { ...Object.fromEntries(routing.locales.map((code) => [code, at(code)])), "x-default": at(routing.defaultLocale) },
  };
}

/** The public pages listed in the sitemap, each in every language. */
export const PUBLIC_PATHS = ["", "/templates", "/signup"] as const;
