import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PosterRenderer } from "@/features/directions/poster/renderer";
import { previewChrome, sampleLabel } from "@/features/previews/preview-chrome";
import { previewPage, PREVIEWS } from "@/features/previews/registry";
import { nextInRotation } from "@/features/previews/rotation";

/** The page's language as Open Graph names it (language_TERRITORY). */
const OG_LOCALES: Record<string, string> = { de: "de_DE", en: "en_US", ar: "ar_AR" };

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return Object.entries(PREVIEWS).flatMap(([slug, preview]) =>
    Object.keys(preview.pages).map((locale) => ({ locale, slug })),
  );
}

export const dynamicParams = false;
// Re-rendered every few minutes so day-relative details (tonight's live) stay current.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) return {};
  const t = await getTranslations({ locale, namespace: "preview" });
  const sample = found.preview.sample;
  const label = sample ? await sampleLabel(locale, sample) : "";
  const { profile } = found.page;
  const name = profile.displayName;
  // WhatsApp, iMessage and LinkedIn print og:title and og:description under the card: the person's
  // name comes first, and examples and concepts still say what they are.
  // A page shown as the person's own (bare) is titled like one: the name, then the role.
  const own = found.preview.bare ? [name, profile.tagline?.trim()].filter(Boolean).join(" · ") : null;
  const ogTitle = own ?? (sample ? t("ogTitle.sample", { name, kind: label }) : found.preview.concept ? t("ogTitle.concept", { name }) : t("ogTitle.prepared", { name }));
  // Their own line (tagline, else bio); without one the site's description stays.
  const line = [profile.tagline, profile.bio].map((text) => text?.trim() ?? "").find(Boolean) ?? "";
  const description = line.length > 160 ? `${line.slice(0, 159).trimEnd()}…` : line;
  const said = description ? { description } : {};
  return {
    title: {
      absolute: own ?? (sample ? t("sampleTitle", { kind: label }) : found.preview.concept ? t("conceptTitle", { name }) : t("title", { name })),
    },
    ...said,
    openGraph: { title: ogTitle, ...said, type: "profile", siteName: "Linkyo", locale: OG_LOCALES[locale] ?? "en_US" },
    twitter: { card: "summary_large_image", title: ogTitle, ...said },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) return {};
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  return { themeColor: theme.palette.bg, colorScheme: colorSchemeOf(theme.palette.mode) };
}

/**
 * A creator page prepared for one person, clearly labelled as a private preview, or an example page
 * for a kind of creator (a fictional person), labelled as an example.
 */
export default async function PreviewRoute({ params }: Props) {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) notFound();
  setRequestLocale(locale);
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  // Linkyo's label (with the photographers' credit on a portfolio) and dock: features/previews/preview-chrome.tsx.
  const chrome = await previewChrome({ preview: found.preview, page: found.page, slug, locale, theme });
  // A page that takes turns with clips (Sevag's) is rendered for every visit, so a refresh brings the
  // next clip; every other preview stays a cached page.
  const rotation = found.preview.motionRotation;
  if (rotation?.length) await connection();
  const page = rotation?.length ? nextInRotation(found.page, rotation) : found.page;
  return (
    <>
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      {chrome.above}
      <PosterRenderer page={page} theme={theme} overlay={chrome.overlay} dock={chrome.dock} projectBase={`/${locale}/p/${slug}`} />
    </>
  );
}
