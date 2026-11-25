import type { MetadataRoute } from "next";

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

/**
 * The public pages, each in every language: the sitemap lists them (app/sitemap.ts), e2e/routes.ts
 * checks them, and each has a description of its own (`PAGE_DESCRIPTIONS`).
 */
export const PUBLIC_PATHS = ["", "/templates", "/portfolio", "/funktionen", "/hilfe", "/kontakt", "/ueber-uns", "/changelog", "/sicherheit", "/signup"] as const;

/** Public only where contracts can be made (payments on): the page service. */
export const PAID_PATHS = ["/service"] as const;

export type PublicPath = (typeof PUBLIC_PATHS)[number] | (typeof PAID_PATHS)[number];

/** The public pages of this build: the page service joins once payments are on. */
export function publicPaths({ payments }: { payments: boolean }): PublicPath[] {
  return [...PUBLIC_PATHS, ...(payments ? PAID_PATHS : [])];
}

/**
 * Where each public page's meta description lives (a message key): every page says what is on it
 * in its own words, never the home page's (W-05). `{ designs, pages }` are the counts from code
 * (SITE_COUNTS); the page service's takes its prices. lib/seo.test.ts fails on a missing or repeated
 * description in any language.
 */
export const PAGE_DESCRIPTIONS: Record<PublicPath, string> = {
  "": "marketing.meta.description",
  "/templates": "examples.meta.description",
  "/portfolio": "portfolioLanding.meta.description",
  "/funktionen": "sitePages.features.meta.description",
  "/hilfe": "sitePages.help.meta.description",
  "/kontakt": "sitePages.contact.meta.description",
  "/ueber-uns": "sitePages.about.meta.description",
  "/changelog": "sitePages.changelog.meta.description",
  "/sicherheit": "sitePages.security.meta.description",
  "/signup": "sitePages.signup.description",
  "/service": "service.meta.description",
};

/**
 * The descriptions for a build that counts no pages (`siteState().statistics` false): the pages whose
 * description names the cookie-free statistics say what is on them without it.
 */
export const PAGE_DESCRIPTIONS_UNCOUNTED: Partial<Record<PublicPath, string>> = {
  "": "marketing.real.metaDescription",
  "/funktionen": "sitePages.features.meta.descriptionOff",
  "/changelog": "sitePages.changelog.meta.descriptionOff",
};

/** A public page's description (a message key) as this build counts pages. */
export function pageDescription(path: PublicPath, { statistics }: { statistics: boolean }): string {
  return (statistics ? undefined : PAGE_DESCRIPTIONS_UNCOUNTED[path]) ?? PAGE_DESCRIPTIONS[path];
}

/**
 * The sitemap: every public page in German, English and Arabic, each entry naming its language
 * versions (and German as the default for other languages).
 */
export function sitemapEntries({ base, payments }: { base: URL; payments: boolean }): MetadataRoute.Sitemap {
  const url = (locale: string, path: string) => new URL(`/${locale}${path}`, base).toString();
  return publicPaths({ payments }).flatMap((path) =>
    routing.locales.map((locale) => ({
      url: url(locale, path),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
      alternates: {
        languages: { ...Object.fromEntries(routing.locales.map((code) => [code, url(code, path)])), "x-default": url(routing.defaultLocale, path) },
      },
    })),
  );
}
