import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SITE_COUNTS } from "@/features/examples/looks";
import { MarketingHome } from "@/features/marketing/home";
import { localeAlternates } from "@/lib/seo";
import { supabaseEnabled } from "@/lib/supabase/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  // With real accounts nothing is counted yet: the description promises no analytics. The counts
  // ("14 Designs · 91 Beispielseiten") come from code, so a new template never touches the copy.
  const description = supabaseEnabled ? t("real.metaDescription") : t("meta.description", SITE_COUNTS);
  return { title: { absolute: t("meta.title") }, description, alternates: localeAlternates("", locale) };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MarketingHome />;
}
