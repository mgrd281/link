import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { AboutPage } from "@/features/marketing/pages/about-page";
import { sitePageMetadata } from "@/features/marketing/pages/meta";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return sitePageMetadata(locale, "about");
}

/** /ueber-uns: why Linkyo exists and what it stands for. No team, numbers or quotes that do not exist. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AboutPage locale={locale} />;
}
