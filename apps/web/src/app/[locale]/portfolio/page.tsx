import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MarketingFooter } from "@/features/marketing/footer";
import { MarketingHeader } from "@/features/marketing/header";
import { PortfolioLanding } from "@/features/marketing/portfolio/landing";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portfolioLanding.meta" });
  return { title: { absolute: t("title") }, description: t("description"), alternates: localeAlternates("/portfolio", locale) };
}

/**
 * /portfolio: the Portfolio section of the website. Photographers, designers, architects,
 * developers and makers see the portfolio templates on real example pages, what a project page
 * holds, and start with a template. Static, in every language; it sets no cookie.
 */
export default async function PortfolioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <MarketingHeader current="portfolio" />
      <main id="main" className="grid grid-cols-1">
        <PortfolioLanding locale={locale} />
      </main>
      <MarketingFooter />
    </>
  );
}
