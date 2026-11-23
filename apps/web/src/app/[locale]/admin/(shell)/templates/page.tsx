import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TemplatesScreen, type DesignCard } from "@/features/admin/templates-screen";
import { galleryItems } from "@/features/examples/gallery-items";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("templates") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tTemplates = await getTranslations("templates");
  const designs: DesignCard[] = TEMPLATE_IDS.map((id: CreatorTemplateId) => ({
    id,
    label: creatorTokens.templates[id].label,
    description: tTemplates(`${id}.description`),
    style: resolveCreatorTheme({ template: id }, { rtlScript: locale === "ar" }).cssVars,
  }));
  const { examples, people } = await galleryItems(locale);
  return <TemplatesScreen designs={designs} examples={examples} people={people} />;
}
