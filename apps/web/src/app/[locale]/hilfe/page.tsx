import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { HelpPage } from "@/features/marketing/pages/help-page";
import { sitePageMetadata } from "@/features/marketing/pages/meta";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return sitePageMetadata(locale, "help");
}

/** /hilfe: the help articles (features/help), searchable in every language. Static; it sets no cookie. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HelpPage locale={locale} />;
}
