import { isBlockActive } from "@linkyo/blocks";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { findProject } from "@/features/directions/poster/project-page";
import { sampleLabel } from "@/features/previews/preview-chrome";
import { previewPage, PREVIEWS } from "@/features/previews/registry";
import { OG_SIZE, ogProjectCard } from "@/features/share/og-card";
import { pageAddress } from "@/lib/page-url";

/** The link preview of an example's project: its cover, result or title in the example's template, labelled as an example. */
export const size = OG_SIZE;
export const contentType = "image/jpeg";
export const alt = "Linkyo";

export function generateStaticParams() {
  const now = new Date();
  return Object.entries(PREVIEWS).flatMap(([slug, preview]) =>
    Object.entries(preview.pages).flatMap(([locale, page]) =>
      page.blocks.flatMap((block) => (block.type === "project" && isBlockActive(block, now) ? [{ locale, slug, project: block.slug }] : [])),
    ),
  );
}

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string; project: string }> }) {
  const { locale, slug, project: projectSlug } = await params;
  const found = previewPage(slug, locale);
  const lookup = found ? findProject(found.page, projectSlug) : null;
  if (!found || lookup?.kind !== "found") notFound();
  const sample = found.preview.sample;
  const t = await getTranslations({ locale, namespace: "preview" });
  const name = found.page.profile.displayName;
  const badge = sample ? t("sampleBadge", { kind: await sampleLabel(locale, sample) }) : found.preview.concept ? t("conceptBadge", { name }) : undefined;
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  return ogProjectCard({ page: found.page, project: lookup.project, theme, address: `${pageAddress(slug)}/${lookup.project.slug}`, badge });
}
