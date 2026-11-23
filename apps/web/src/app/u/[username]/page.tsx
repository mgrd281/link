import { hasAiContent } from "@linkyo/blocks";
import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { CreatorLegal, hasCreatorLegal } from "@/features/creator/creator-legal";
import { loadPublicPage } from "@/features/creator/public-page";
import { PosterRenderer } from "@/features/directions/poster/renderer";
import { pageUrl } from "@/lib/page-url";
import { siteUrl } from "@/lib/site-url";

interface Props {
  params: Promise<{ username: string }>;
}

/** The page's language as Open Graph names it (language_TERRITORY). */
const OG_LOCALES: Record<string, string> = { de: "de_DE", en: "en_US", ar: "ar_AR" };

// Rendered on the first visit, then served from the cache and refreshed at most once a minute:
// saves go from the browser straight to the database, so a change shows up about a minute later
// (on a quiet page, on the visit after the next one). What takes a page off the web or moves it
// (account deleted or suspended, address changed) drops the cached copy at once: features/creator/revalidate.ts.
export const revalidate = 60;
export function generateStaticParams(): { username: string }[] {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const found = await loadPublicPage(username);
  if (!found) return { robots: { index: false, follow: false } };
  const { profile } = found.page;
  // Their own line (tagline, else bio), at most 160 characters.
  const line = [profile.tagline, profile.bio].map((text) => text?.trim() ?? "").find(Boolean) ?? "";
  const description = line.length > 160 ? `${line.slice(0, 159).trimEnd()}…` : line;
  const said = description ? { description } : {};
  return {
    metadataBase: siteUrl(),
    title: profile.displayName,
    ...said,
    icons: { icon: "/favicon.svg" },
    alternates: { canonical: pageUrl(username) },
    openGraph: { title: profile.displayName, ...said, type: "profile", siteName: "Linkyo", url: pageUrl(username), locale: OG_LOCALES[profile.locale] ?? "de_DE" },
    twitter: { card: "summary_large_image", title: profile.displayName, ...said },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false, email: false, address: false },
    // Machine-readable marking of AI-written content (AI Act Art. 50(2)): an AI block, or a name,
    // tagline or bio an AI draft wrote. The blocks and texts themselves carry data-ai-generated.
    ...(hasAiContent(found.page) ? { other: { "ai-generated": "partial" } } : {}),
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { username } = await params;
  const found = await loadPublicPage(username);
  const base: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
  if (!found) return base;
  const theme = resolveCreatorTheme(found.theme, { rtlScript: found.page.profile.locale === "ar" });
  return { ...base, themeColor: theme.palette.bg, colorScheme: colorSchemeOf(theme.palette.mode) };
}

/**
 * A creator's public page at `/<username>`: what they published, in their template and language.
 * Nothing on it sets a cookie or loads from another origin (pictures come through our optimizer).
 */
export default async function CreatorRoute({ params }: Props) {
  const { username } = await params;
  const found = await loadPublicPage(username);
  if (!found) notFound();
  const { page, legal } = found;
  const locale = page.profile.locale;
  setRequestLocale(locale);
  const theme = resolveCreatorTheme(found.theme, { rtlScript: locale === "ar" });
  const site = siteUrl().origin;
  return (
    <>
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      <PosterRenderer
        page={page}
        theme={theme}
        footerLinks={{
          ...(hasCreatorLegal(legal) ? { imprint: "#imprint" } : {}),
          privacy: `${site}/${locale}/datenschutz#creator-pages`,
          report: `${site}/${locale}/impressum#melden`,
        }}
      />
      <CreatorLegal legal={legal} theme={theme} locale={locale} />
    </>
  );
}
