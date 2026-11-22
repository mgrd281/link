import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { LegalPage, legalMetadata } from "@/features/legal/legal-page";
import { datenschutz } from "@/features/legal/texts";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "privacy", "/datenschutz");
}

/** Datenschutzerklärung, including creator pages (#creator-pages). A draft for the lawyer. */
export default async function DatenschutzPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} title="privacy" doc={datenschutz()} />;
}
