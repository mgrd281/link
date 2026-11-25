import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { sitePageMetadata } from "@/features/marketing/pages/meta";
import { SecurityPage } from "@/features/marketing/pages/security-page";

/**
 * Rendered again at most once an hour: the page says whether the AI assistant and the counting are
 * switched on, and those are server switches a build may not see (turbo hands only some variables to
 * `next build`), so a fresh render on the server keeps the sentences true.
 */
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return sitePageMetadata(locale, "security");
}

/** /sicherheit: what the code does with data. A legal promise carries the lawyer's review marker. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SecurityPage locale={locale} />;
}
