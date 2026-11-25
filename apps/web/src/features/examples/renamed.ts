/**
 * Example people who gave way to others. An old address leads to the new person's page for good, the
 * page and each of its project pages alike, from any language: the projects kept their addresses, so a
 * link someone shared still opens the same work.
 *
 * The redirects live in next.config.ts (`renamedExampleRedirects`), so they answer before any route
 * renders: a redirect thrown from a cached page render (the project pages revalidate) would send its
 * Location header twice. This file stays free of the catalog so the config can import it.
 */
export const RENAMED_EXAMPLES = {
  // 2026-11-25, at the founder's request: other people on the two Arabic portfolio pages.
  "rana-al-khatib": { slug: "freya-nilsen", locale: "ar" },
  "naya-aldabbas": { slug: "elena-novak", locale: "ar" },
} as const satisfies Record<string, { slug: string; locale: string }>;

export interface PermanentRedirect {
  source: string;
  destination: string;
  permanent: true;
}

/**
 * The permanent redirects for next.config.ts: `/<any language>/p/<old>[/…]` → `/<its language>/p/<new>[/…]`.
 * Two rules per person: with one optional-rest rule, Vercel leaves a trailing slash on the page's
 * own address (`/ar/p/<new>/`), which costs a second redirect.
 */
export function renamedExampleRedirects(locales: readonly string[]): PermanentRedirect[] {
  const language = `:locale(${locales.join("|")})`;
  return Object.entries(RENAMED_EXAMPLES).flatMap(([old, next]) => {
    const target = `/${next.locale}/p/${next.slug}`;
    return [
      { source: `/${language}/p/${old}`, destination: target, permanent: true as const },
      { source: `/${language}/p/${old}/:rest+`, destination: `${target}/:rest+`, permanent: true as const },
    ];
  });
}
