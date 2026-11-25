import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SITE_COUNTS } from "@/features/examples/looks";
import { pageCard } from "@/features/share/page-card";
import { localeAlternates, PAGE_DESCRIPTIONS } from "@/lib/seo";

import { SITE_PAGES, type SitePageKey } from "./site-pages";

/**
 * A site page's title, description and language versions. The description is the one lib/seo.ts
 * names for the path (`PAGE_DESCRIPTIONS`), so the uniqueness test reads what the page says.
 */
export async function sitePageMetadata(locale: string, page: SitePageKey): Promise<Metadata> {
  const path = SITE_PAGES[page];
  const t = await getTranslations({ locale });
  return {
    title: { absolute: t(`sitePages.${page}.meta.title`) },
    description: t(PAGE_DESCRIPTIONS[path], SITE_COUNTS),
    alternates: localeAlternates(path, locale),
  };
}

/** A site page's link preview: its name and title on the site's teal card (features/share/page-card.tsx). */
export async function sitePageImage(locale: string, page: SitePageKey) {
  const t = await getTranslations({ locale, namespace: `sitePages.${page}` });
  return pageCard({ kicker: t("eyebrow"), title: t("title"), rtl: locale === "ar" });
}
