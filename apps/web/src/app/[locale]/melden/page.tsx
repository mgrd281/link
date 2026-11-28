import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReportPage, reportsAccepting } from "@/features/moderation/report-page";
import { NOINDEX } from "@/lib/seo";

/**
 * Rendered again at most every five minutes: whether reports can be taken is the database's answer
 * (the migration may arrive after the build), so the page follows it without a deploy.
 */
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "report.meta" });
  // A form, not a page to find: left out of search results and the sitemap.
  return { title: { absolute: t("title") }, description: t("description"), robots: NOINDEX };
}

/** /melden: the public report form behind every creator page's "Melden" (DSA Art. 16). Sets no cookie. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReportPage locale={locale} accepting={await reportsAccepting()} />;
}
