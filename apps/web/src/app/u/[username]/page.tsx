import { hasAiContent } from "@linkyo/blocks";
import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { CreatorLegal, hasCreatorLegal } from "@/features/creator/creator-legal";
import { PausedPage } from "@/features/creator/paused-page";
import { indexable, loadPublicPage, searchTexts } from "@/features/creator/public-page";
import { browserThemeColor, rootBackground } from "@/features/directions/poster/browser-top";
import { PosterRenderer } from "@/features/directions/poster/renderer";
import { documentsView } from "@/features/documents/view";
import { pageAddress, pageUrl } from "@/lib/page-url";
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
  // The owner's search title and description (Settings › Sichtbarkeit), else the name and their own
  // line (tagline, else bio), at most 160 characters. A paused page says only its name.
  const { title, description } = searchTexts(profile, found.paused);
  const said = description ? { description } : {};
  // Paused, or "Auf Suchmaschinen zeigen" off: search engines are asked to leave the page out.
  const index = indexable(found);
  return {
    metadataBase: siteUrl(),
    title,
    ...said,
    icons: { icon: "/favicon.svg" },
    alternates: { canonical: pageUrl(username) },
    openGraph: { title, ...said, type: "profile", siteName: "Linkyo", url: pageUrl(username), locale: OG_LOCALES[profile.locale] ?? "de_DE" },
    twitter: { card: "summary_large_image", title, ...said },
    robots: { index, follow: index },
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
  // The page's color, or on phones and tablets the bleed hero's own (features/directions/poster/browser-top.ts).
  return { ...base, themeColor: browserThemeColor(found.page.profile, theme), colorScheme: colorSchemeOf(theme.palette.mode) };
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
  // Paused by its owner: the name, the photo and one calm sentence (no block, no counter, noindex above).
  if (found.paused) {
    return (
      <>
        <style>{rootBackground(page.profile, theme)}</style>
        <PausedPage page={page} theme={theme} privacyHref={`${site}/${locale}/datenschutz#creator-pages`} />
      </>
    );
  }
  // An application page (Laufbahn) offers its Lebenslauf and Anschreiben as PDFs at /<username>/cv and
  // /<username>/letter (features/documents): their addresses, page counts and miniatures.
  const { username: name } = page.profile;
  const documents = await documentsView(page, {
    base: `/${name}`,
    signposted: theme.layout.headings === "signpost",
    now: new Date(),
    asOf: found.updatedAt,
    publicAddress: pageAddress(name),
  });
  return (
    <>
      <style>{rootBackground(page.profile, theme)}</style>
      <PosterRenderer
        page={page}
        theme={theme}
        // Cards of projects with a page of their own lead to /<username>/<slug>.
        projectBase={`/${page.profile.username}`}
        documents={documents}
        footerLinks={{
          ...(hasCreatorLegal(legal) ? { imprint: "#imprint" } : {}),
          privacy: `${site}/${locale}/datenschutz#creator-pages`,
          // The report form, with this page's address filled in (DSA Art. 16).
          report: `${site}/${locale}/melden?url=${encodeURIComponent(pageUrl(name))}`,
        }}
      />
      <CreatorLegal legal={legal} theme={theme} locale={locale} />
    </>
  );
}
