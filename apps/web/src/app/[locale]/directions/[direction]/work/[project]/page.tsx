import { colorSchemeOf, isTemplate, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { defaultTheme } from "@/features/directions/load";
import { findProject, ProjectPage } from "@/features/directions/poster/project-page";
import { portfolioSample, portfolioSampleLong } from "@/features/directions/poster/sample";
import { isCreatorPreset } from "@/features/directions/preset";
import { isThemeMode } from "@/features/directions/registry";
import { LinkyoDock } from "@/features/directions/shared/dock";
import { NOINDEX } from "@/lib/seo";

interface RouteProps {
  params: Promise<{ locale: string; direction: string; project: string }>;
  searchParams: Promise<{ template?: string; preset?: string; mode?: string; chrome?: string; page?: string }>;
}

/**
 * The project pages of the portfolio sample (`/directions/poster?page=portfolio`), in any template
 * (`?template=`) and language: the one place where every template × language of a project page can
 * be looked at (each example page exists in one language and one template). `?page=portfolio-long`
 * shows the sample with the longest texts a page can hold.
 */
async function resolveRoute({ params, searchParams }: RouteProps) {
  const { locale, direction, project: slug } = await params;
  if (direction !== "poster") return null;
  const { template, preset, mode, chrome, page: which } = await searchParams;
  const page = which === "portfolio-long" ? portfolioSampleLong(locale) : portfolioSample(locale);
  const lookup = findProject(page, slug);
  if (lookup?.kind !== "found") return null;
  const look = isTemplate(template) ? { template } : isCreatorPreset(preset) ? { preset } : defaultTheme("poster", page);
  const theme = resolveCreatorTheme(isThemeMode(mode) ? { ...look, mode } : look, { rtlScript: locale === "ar" });
  // The same query on every address of the sample: its cards, the bar's way back and the next project.
  const query = new URLSearchParams();
  if (chrome === "0") query.set("chrome", "0");
  if (isTemplate(template)) query.set("template", template);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const portfolio = new URLSearchParams(query);
  portfolio.set("page", which === "portfolio-long" ? "portfolio-long" : "portfolio");
  return { locale, page, project: lookup.project, theme, suffix, bare: chrome === "0", back: `/${locale}/directions/poster?${portfolio.toString()}#${lookup.project.slug}` };
}

export async function generateMetadata(props: RouteProps): Promise<Metadata> {
  const route = await resolveRoute(props);
  if (!route) return { robots: NOINDEX };
  return { title: { absolute: `${route.project.title} · ${route.page.profile.displayName}` }, description: route.project.summary, robots: NOINDEX };
}

export async function generateViewport(props: RouteProps): Promise<Viewport> {
  const route = await resolveRoute(props);
  if (!route) return {};
  return { themeColor: route.theme.palette.bg, colorScheme: colorSchemeOf(route.theme.palette.mode) };
}

export default async function SampleProjectRoute(props: RouteProps) {
  const route = await resolveRoute(props);
  if (!route) notFound();
  const { locale, page, project, theme, suffix, bare, back } = route;
  setRequestLocale(locale);
  const t = await getTranslations("preview");
  // Without the review toolbar (?chrome=0) the sample shows exactly what visitors get, Linkyo bar included.
  const dock = bare ? <LinkyoDock title={t("sampleDockTitle")} cta={t("sampleDockCta")} href="/signup" closeLabel={t("dockClose")} /> : undefined;
  return (
    <>
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      <ProjectPage page={page} theme={theme} project={project} base={`/${locale}/directions/poster/work`} suffix={suffix} backHref={back} dock={dock} />
    </>
  );
}
