import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import { PUBLIC_PATHS } from "@/lib/seo";

/** The public pages, each in German, English and Arabic, with their language versions linked. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const url = (locale: string, path: string) => new URL(`/${locale}${path}`, base).toString();
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: url(locale, path),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
      alternates: { languages: Object.fromEntries(routing.locales.map((code) => [code, url(code, path)])) },
    })),
  );
}
