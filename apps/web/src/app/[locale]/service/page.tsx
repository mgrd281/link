import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MarketingFooter } from "@/features/marketing/footer";
import { MarketingHeader } from "@/features/marketing/header";
import { formatEuro, PRICES } from "@/features/payments/prices";
import { ServicePage } from "@/features/payments/service-page";
import { TestBanner } from "@/features/payments/test-banner";
import { paymentsEnabled } from "@/lib/flags";
import { localeAlternates } from "@/lib/seo";

type Locale = "de" | "en" | "ar";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!paymentsEnabled) return {};
  const t = await getTranslations({ locale, namespace: "service.meta" });
  const price = (id: "service-start" | "service-premium") => formatEuro(PRICES[id].amountCents, locale as Locale);
  return {
    title: t("title"),
    description: t("description", { start: price("service-start"), premium: price("service-premium") }),
    alternates: localeAlternates("/service", locale),
  };
}

/** The page service: only where contracts can be made (payments on); otherwise it does not exist. */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!paymentsEnabled) notFound();
  setRequestLocale(locale);
  return (
    <>
      <MarketingHeader />
      <TestBanner />
      <ServicePage />
      <MarketingFooter />
    </>
  );
}
