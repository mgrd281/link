import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { ChangelogPage } from "@/features/marketing/pages/changelog-page";
import { sitePageMetadata } from "@/features/marketing/pages/meta";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return sitePageMetadata(locale, "changelog");
}

/** /changelog: what reached the live site, dated, newest first (features/marketing/pages/changelog.ts). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ChangelogPage locale={locale} />;
}
