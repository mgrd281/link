/**
 * An address of ours in a language ("/signup?kind=music" → "/de/signup?kind=music", "/" → "/de"): what
 * the router's localized link renders with `localePrefix: "always"` (i18n/routing.ts; next-intl's
 * `prefixPathname`), for plain links on creator pages, which carry no router link code (ADR 0008).
 * `href` is one of our own paths, starting with "/".
 */
export function localePath(href: string, locale: string): string {
  return `/${locale}${/^\/(\?.*)?$/.test(href) ? href.slice(1) : href}`;
}
