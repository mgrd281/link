import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SITE_COUNTS } from "@/features/examples/looks";
import { MarketingHome } from "@/features/marketing/home";
import { plainTags } from "@/features/marketing/pages/text";
import { billingQuestions, faqQuestions, type MessageRef } from "@/features/marketing/pricing";
import { siteState } from "@/features/marketing/site-state";
import { homeStructuredData } from "@/features/marketing/structured-data";
import { jsonLd } from "@/lib/json-ld";
import { localeAlternates } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

type Locale = "de" | "en" | "ar";

/**
 * The home page's description. Where creator pages are not counted (real accounts with the counter
 * off), it promises no analytics. The counts ("14 Designs · 91 Beispielseiten") come from code, so a
 * new template never touches the copy.
 */
async function description(locale: string): Promise<string> {
  const t = await getTranslations({ locale, namespace: "marketing" });
  return siteState().statistics ? t("meta.description", SITE_COUNTS) : t("real.metaDescription");
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  return { title: { absolute: t("meta.title") }, description: await description(locale), alternates: localeAlternates("", locale) };
}

/** The home page's structured data (lib tests parse it): the same FAQ and offers the page shows. */
async function structuredData(locale: Locale): Promise<{ type: string; json: string }[]> {
  const t = await getTranslations({ locale, namespace: "marketing" });
  const state = siteState();
  const plain = ({ key, values }: MessageRef) => t.markup(key, { ...values, ...plainTags });
  const questions = [...faqQuestions(state, (t.raw("faq.items") as unknown[]).length), ...billingQuestions(state, locale)];
  const blocks = homeStructuredData({
    base: siteUrl(),
    locale,
    description: await description(locale),
    names: { free: t("pricing.free.name"), pro: t("pricing.pro.name") },
    faq: questions.map(({ q, a }) => ({ q: plain(q), a: plain(a) })),
    state,
  });
  return blocks.map((block) => ({ type: String(block["@type"]), json: jsonLd(block) }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const blocks = await structuredData(locale as Locale);
  return (
    <>
      {blocks.map(({ type, json }) => (
        // The JSON is serialised by jsonLd(): nothing in it can end the script element.
        <script key={type} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
      ))}
      <MarketingHome />
    </>
  );
}
