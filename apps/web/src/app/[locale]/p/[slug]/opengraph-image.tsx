import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { previewPage, PREVIEWS } from "@/features/previews/registry";
import { OG_SIZE, ogCard } from "@/features/share/og-card";
import { pageAddress } from "@/lib/page-url";

/** The link preview of a page: its photo, name and address in its own template. */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Linkyo";

export function generateStaticParams() {
  return Object.entries(PREVIEWS).flatMap(([slug, preview]) => Object.keys(preview.pages).map((locale) => ({ locale, slug })));
}
export const dynamicParams = false;

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) notFound();
  const t = await getTranslations({ locale, namespace: "preview" });
  const name = found.page.profile.displayName;
  // Examples and concept pages say what they are, in the card too.
  const sample = found.preview.sample;
  const kind = sample?.category
    ? (await getTranslations({ locale, namespace: "examples.categories" }))(sample.category)
    : sample
      ? (await getTranslations({ locale, namespace: "app.welcome.kinds" }))(`${sample.kind}.label`)
      : "";
  const badge = sample ? t("sampleBadge", { kind }) : found.preview.concept ? t("conceptBadge", { name }) : undefined;
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  return ogCard({ page: found.page, theme, address: pageAddress(slug), badge });
}
