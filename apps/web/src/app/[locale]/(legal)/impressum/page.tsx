import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { LegalPage, legalMetadata } from "@/features/legal/legal-page";
import { impressum } from "@/features/legal/texts";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "imprint", "/impressum");
}

/** Impressum (§ 5 DDG), with where to report content (#melden). A draft until the company data is in. */
export default async function ImpressumPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} title="imprint" doc={impressum()} />;
}
