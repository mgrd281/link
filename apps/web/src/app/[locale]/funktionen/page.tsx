import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { FeaturesPage } from "@/features/marketing/pages/features-page";
import { sitePageMetadata } from "@/features/marketing/pages/meta";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return sitePageMetadata(locale, "features");
}

/** /funktionen: what a creator gets today, in five groups, each with a real picture or a live preview. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FeaturesPage locale={locale} />;
}
