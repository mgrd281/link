import { isBlockActive } from "@linkyo/blocks";
import { colorSchemeOf, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { findProject, isAiProject, ProjectPage } from "@/features/directions/poster/project-page";
import { previewChrome } from "@/features/previews/preview-chrome";
import { previewPage, PREVIEWS } from "@/features/previews/registry";
import { NOINDEX } from "@/lib/seo";

import "../../../../creator-motion.css";

interface Props {
  params: Promise<{ locale: string; slug: string; project: string }>;
}

/** Every active project of every example page, in that page's language. */
export function generateStaticParams() {
  const now = new Date();
  return Object.entries(PREVIEWS).flatMap(([slug, preview]) =>
    Object.entries(preview.pages).flatMap(([locale, page]) =>
      page.blocks.flatMap((block) => (block.type === "project" && isBlockActive(block, now) ? [{ locale, slug, project: block.slug }] : [])),
    ),
  );
}

// An unknown example or project renders this segment's own "not found" page (with the way back),
// not the site's generic one.
export const dynamicParams = true;
export const revalidate = 300;

async function load(params: Props["params"]) {
  const { locale, slug, project: projectSlug } = await params;
  const found = previewPage(slug, locale);
  if (!found) return null;
  const lookup = findProject(found.page, projectSlug);
  if (!lookup) return null;
  return { locale, slug, found, lookup };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await load(params);
  if (loaded?.lookup.kind !== "found") return { robots: NOINDEX };
  const { project } = loaded.lookup;
  const title = `${project.title} · ${loaded.found.page.profile.displayName}`;
  return {
    title: { absolute: title },
    description: project.summary,
    openGraph: { title, description: project.summary, type: "article", siteName: "Linkyo" },
    twitter: { card: "summary_large_image", title, description: project.summary },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    ...(isAiProject(project) ? { other: { "ai-generated": "partial" } } : {}),
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const loaded = await load(params);
  if (!loaded) return {};
  const theme = resolveCreatorTheme(loaded.found.preview.theme, { rtlScript: loaded.locale === "ar" });
  return { themeColor: theme.palette.bg, colorScheme: colorSchemeOf(theme.palette.mode) };
}

/**
 * A project of an example page (`/<locale>/p/<slug>/<project>`), labelled as an example like its
 * portfolio. The bar leads back to the card this project came from.
 */
export default async function ExampleProjectRoute({ params }: Props) {
  const loaded = await load(params);
  if (!loaded) notFound();
  const { locale, slug, found, lookup } = loaded;
  const base = `/${locale}/p/${slug}`;
  if (lookup.kind === "moved") redirect(`${base}/${lookup.slug}`);
  setRequestLocale(locale);
  const { project } = lookup;
  const theme = resolveCreatorTheme(found.preview.theme, { rtlScript: locale === "ar" });
  const chrome = await previewChrome({ preview: found.preview, page: found.page, slug, locale, theme, path: `/${project.slug}` });
  return (
    <>
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      <ProjectPage page={found.page} theme={theme} project={project} base={base} backHref={`${base}#${project.slug}`} overlay={chrome.badge} dock={chrome.dock} />
    </>
  );
}
