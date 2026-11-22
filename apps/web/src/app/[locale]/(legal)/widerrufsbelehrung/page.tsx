import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { LegalPage, legalMetadata } from "@/features/legal/legal-page";
import { widerrufsbelehrung } from "@/features/legal/texts";
import { paymentsEnabled } from "@/lib/flags";
import { siteUrl } from "@/lib/site-url";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!paymentsEnabled) return {};
  return legalMetadata(locale, "cancellationPolicy", "/widerrufsbelehrung");
}

/**
 * Widerrufsbelehrung with the model withdrawal form. Only where contracts can be made: without
 * payments the page does not exist (404).
 */
export default async function WiderrufsbelehrungPage({ params }: Props) {
  const { locale } = await params;
  if (!paymentsEnabled) notFound();
  setRequestLocale(locale);
  return <LegalPage locale={locale} title="cancellationPolicy" doc={widerrufsbelehrung(siteUrl().origin)} />;
}
