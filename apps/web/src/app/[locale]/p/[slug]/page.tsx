import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { browserThemeColor, rootBackground } from "@/features/directions/poster/browser-top";
import { PosterRenderer } from "@/features/directions/poster/renderer";
import { previewChrome, sampleLabel } from "@/features/previews/preview-chrome";
import { previewPage, PREVIEWS } from "@/features/previews/registry";
import { rotationTurn, withRotationClip } from "@/features/previews/rotation";
import { RotationAddress } from "@/features/previews/rotation-address";
import { ROTATION_PARAM } from "@/features/previews/rotation-param";

import "../../../creator-motion.css";

/** The page's language as Open Graph names it (language_TERRITORY). */
const OG_LOCALES: Record<string, string> = { de: "de_DE", en: "en_US", ar: "ar_AR" };

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export function generateStaticParams() {
  return Object.entries(PREVIEWS).flatMap(([slug, preview]) =>
    Object.keys(preview.pages).map((locale) => ({ locale, slug })),
  );
}

// Other addresses are rendered on request: an example asked for in another language answers with a
// permanent redirect to its own (below), anything else "not found".
export const dynamicParams = true;
// Re-rendered every few minutes so day-relative details (tonight's live) stay current.
export const revalidate = 300;

/**
 * Where an example page lives when it is asked for in a language it does not have (W-09): examples
 * exist in their own language only, so /en/p/ronja-feldkamp leads to /de/p/ronja-feldkamp. Only
 * examples move: a private preview stays "not found" in other languages.
 */
function exampleHome(slug: string, locale: string): string | null {
  const preview = Object.hasOwn(PREVIEWS, slug) ? PREVIEWS[slug] : undefined;
  if (!preview?.sample || preview.pages[locale as keyof typeof preview.pages]) return null;
  const own = Object.keys(preview.pages)[0];
  return own ? `/${own}/p/${slug}` : null;
}

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
  // The page's color, or on phones and tablets the bleed hero's own (features/directions/poster/browser-top.ts).
  return { themeColor: browserThemeColor(found.page.profile, theme), colorScheme: colorSchemeOf(theme.palette.mode) };
}

/**
 * A creator page prepared for one person, clearly labelled as a private preview, or an example page
 * for a kind of creator (a fictional person), labelled as an example.
 */
export default async function PreviewRoute({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const found = previewPage(slug, locale);
  if (!found) {
    const home = exampleHome(slug, locale);
    if (home) permanentRedirect(home);
    notFound();
  }
  setRequestLocale(locale);
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  // Linkyo's label (with the photographers' credit on a portfolio) and dock: features/previews/preview-chrome.tsx.
  const chrome = await previewChrome({ preview: found.preview, page: found.page, slug, locale, theme });
  // A page that takes turns with clips (Sevag's) shows the clip its address names and names the next
  // one there once it has loaded, so a refresh brings the next clip (features/previews/rotation.ts).
  // Only such a page reads the address, so it alone is rendered per visit; every other preview stays
  // a prerendered page.
  const rotation = found.preview.motionRotation;
  const turn = rotation?.length ? rotationTurn(rotation, (await searchParams)[ROTATION_PARAM]) : null;
  const page = turn ? withRotationClip(found.page, turn.clip) : found.page;
  return (
    <>
      {/* The bleed hero's label lies over the picture (labelInFlow), so its colour is the top's. */}
      <style>{rootBackground(page.profile, theme)}</style>
      {chrome.above}
      <PosterRenderer page={page} theme={theme} overlay={chrome.overlay} dock={chrome.dock} projectBase={`/${locale}/p/${slug}`} />
      {turn ? <RotationAddress next={turn.next.key} /> : null}
    </>
  );
}
