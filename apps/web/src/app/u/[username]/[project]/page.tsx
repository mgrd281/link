import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { hasCreatorLegal } from "@/features/creator/creator-legal";
import { loadPublicPage } from "@/features/creator/public-page";
import { findProject, isAiProject, ProjectPage } from "@/features/directions/poster/project-page";
import { projectUrl } from "@/lib/page-url";
import { siteUrl } from "@/lib/site-url";

interface Props {
  params: Promise<{ username: string; project: string }>;
}

/** The page's language as Open Graph names it (language_TERRITORY). */
const OG_LOCALES: Record<string, string> = { de: "de_DE", en: "en_US", ar: "ar_AR" };

// As the page itself: rendered on the first visit, then served from the cache and refreshed at most
// once a minute (app/u/[username]/page.tsx).
export const revalidate = 60;
export function generateStaticParams(): { username: string; project: string }[] {
  return [];
}

async function load(params: Props["params"]) {
  const { username, project: slug } = await params;
  // Cached per request: the layout, the metadata and the page read the database once.
  const found = await loadPublicPage(username);
  if (!found) return null;
  const lookup = findProject(found.page, slug);
  return lookup ? { username, found, lookup } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await load(params);
  if (loaded?.lookup.kind !== "found") return { robots: { index: false, follow: false } };
  const { username, found, lookup } = loaded;
  const { project } = lookup;
  const { profile } = found.page;
  const title = `${project.title} · ${profile.displayName}`;
  const url = projectUrl(username, project.slug);
  return {
    metadataBase: siteUrl(),
    title,
    description: project.summary,
    icons: { icon: "/favicon.svg" },
    alternates: { canonical: url },
    openGraph: { title, description: project.summary, type: "article", siteName: "Linkyo", url, locale: OG_LOCALES[profile.locale] ?? "de_DE" },
    twitter: { card: "summary_large_image", title, description: project.summary },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false, email: false, address: false },
    // Machine-readable marking of AI-written content (AI Act Art. 50(2)); the page's root carries it too.
    ...(isAiProject(project) ? { other: { "ai-generated": "partial" } } : {}),
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const loaded = await load(params);
  const base: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
  if (!loaded) return base;
  const theme = resolveCreatorTheme(loaded.found.theme, { rtlScript: loaded.found.page.profile.locale === "ar" });
  return { ...base, themeColor: theme.palette.bg, colorScheme: colorSchemeOf(theme.palette.mode) };
}

/**
 * A project's own page at `/<username>/<slug>` (rewritten here by proxy.ts). An earlier address of
 * the project (`was`) answers with a temporary redirect to the current one, as a relative path:
 * an owner may take an old address back, and a cached permanent redirect would then loop. Hidden,
 * scheduled-out and unknown projects answer "not found" with the way back to the page.
 */
export default async function CreatorProjectRoute({ params }: Props) {
  const loaded = await load(params);
  if (!loaded) notFound();
  const { username, found, lookup } = loaded;
  if (lookup.kind === "moved") redirect(`/${username}/${lookup.slug}`);
  const { page } = found;
  const locale = page.profile.locale;
  setRequestLocale(locale);
  const theme = resolveCreatorTheme(found.theme, { rtlScript: locale === "ar" });
  const site = siteUrl().origin;
  return (
    <>
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      <ProjectPage
        page={page}
        theme={theme}
        project={lookup.project}
        base={`/${username}`}
        backHref={`/${username}#${lookup.project.slug}`}
        footerLinks={{
          // The creator's imprint lives on their page.
          ...(hasCreatorLegal(found.legal) ? { imprint: `/${username}#imprint` } : {}),
          privacy: `${site}/${locale}/datenschutz#creator-pages`,
          // The report form names this project's page (DSA Art. 16: the exact address).
          report: `${site}/${locale}/melden?url=${encodeURIComponent(projectUrl(username, lookup.project.slug))}`,
        }}
      />
    </>
  );
}
