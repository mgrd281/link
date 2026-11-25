import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { brandCard } from "@/features/share/brand-card";
import { OG_SIZE } from "@/features/share/og-card";

/** The link preview of the site: home, gallery and every page without its own card. */
export const size = OG_SIZE;
export const contentType = "image/jpeg";
export const alt = "Linkyo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.hero" });
  return brandCard({ kicker: t("kicker"), title1: t("title1"), title2: t("title2"), rtl: locale === "ar" });
}
