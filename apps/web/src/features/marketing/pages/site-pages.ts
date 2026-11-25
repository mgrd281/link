import type { PublicPath } from "@/lib/seo";

/** The website's own pages (WP4.2), by their message namespace `sitePages.<key>`, and where they live. */
export const SITE_PAGES = {
  help: "/hilfe",
  contact: "/kontakt",
  features: "/funktionen",
  about: "/ueber-uns",
  changelog: "/changelog",
  security: "/sicherheit",
} as const satisfies Record<string, PublicPath>;

export type SitePageKey = keyof typeof SITE_PAGES;
