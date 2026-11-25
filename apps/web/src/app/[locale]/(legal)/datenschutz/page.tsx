import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { LegalPage, legalMetadata } from "@/features/legal/legal-page";
import { datenschutz } from "@/features/legal/texts";
import { analyticsEnabled } from "@/lib/flags";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "privacy", "/datenschutz");
}

/**
 * Datenschutzerklärung, including creator pages (#creator-pages). A draft for the lawyer. It describes
 * the cookie-free counting (#statistik) only while the counting runs (LINKYO_ANALYTICS), so the page
 * says what the site does: on Vercel an environment change comes with a new build, and with it this text.
 */
export default async function DatenschutzPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} title="privacy" doc={datenschutz({ statistics: analyticsEnabled() })} />;
}
