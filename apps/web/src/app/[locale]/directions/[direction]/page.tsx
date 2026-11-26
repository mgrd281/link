import { colorSchemeOf, isProjectsStyle, isTemplate, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { DirectionRenderer } from "@/features/directions/direction-renderer";
import { defaultTheme, loadSamplePage } from "@/features/directions/load";
import { browserThemeColor, rootBackground } from "@/features/directions/poster/browser-top";
import { PosterRenderer } from "@/features/directions/poster/renderer";
import { portfolioSample, portfolioSampleLong } from "@/features/directions/poster/sample";
import { isCreatorPreset } from "@/features/directions/preset";
import { DIRECTIONS, isDirection, isThemeMode } from "@/features/directions/registry";
import { LinkyoDock } from "@/features/directions/shared/dock";
import { DirectionToolbar } from "@/features/directions/toolbar";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DIRECTIONS.map((direction) => ({ locale, direction })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; direction: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const page = await loadSamplePage(locale);
  return { title: page.profile.displayName, description: page.profile.bio };
}

interface RouteProps {
  params: Promise<{ locale: string; direction: string }>;
  searchParams: Promise<{ preset?: string; mode?: string; template?: string; chrome?: string; page?: string; projects?: string }>;
}

/**
 * Page + resolved theme for a request. Any preset works with any direction and either mode.
 * Poster also shows the portfolio sample (`?page=portfolio`; `portfolio-long` fills it with the
 * longest texts a page can hold), and takes the owner's choice of work layout (`?projects=`), so
 * every template, language and layout of a portfolio can be looked at.
 */
async function resolveRoute({ params, searchParams }: RouteProps) {
  const { locale, direction } = await params;
  if (!isDirection(direction)) notFound();
  const { preset, mode, template, chrome, page: sample, projects } = await searchParams;
  const portfolio = direction === "poster" && (sample === "portfolio" || sample === "portfolio-long");
  const page = portfolio ? (sample === "portfolio-long" ? portfolioSampleLong(locale) : portfolioSample(locale)) : await loadSamplePage(locale, direction);
  const look = isTemplate(template) ? { template } : isCreatorPreset(preset) ? { preset } : defaultTheme(direction, page);
  const config = portfolio && isProjectsStyle(projects) ? { ...look, projects } : look;
  const theme = resolveCreatorTheme(isThemeMode(mode) ? { ...config, mode } : config, { rtlScript: locale === "ar" });
  // Cards of the sample lead to the sample's project pages, in the same template and without the toolbar.
  const query = new URLSearchParams();
  if (chrome === "0") query.set("chrome", "0");
  if (isTemplate(template)) query.set("template", template);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return { locale, direction, page, theme, portfolio: portfolio ? { base: `/${locale}/directions/poster/work`, suffix } : null };
}

/**
 * Browser chrome (status bar, address bar, overscroll) takes the creator's page color, or on phones
 * and tablets the bleed hero's own (./browser-top.ts).
 */
export async function generateViewport(props: RouteProps): Promise<Viewport> {
  const { direction, page, theme } = await resolveRoute(props);
  return { themeColor: direction === "poster" ? browserThemeColor(page.profile, theme) : theme.palette.bg, colorScheme: colorSchemeOf(theme.palette.mode) };
}

export default async function CreatorPageRoute(props: RouteProps) {
  const { locale, direction, page, theme, portfolio } = await resolveRoute(props);
  setRequestLocale(locale);
  // Without the review toolbar (?chrome=0) the sample shows exactly what visitors get, Linkyo bar included.
  const bare = (await props.searchParams).chrome === "0";
  const t = await getTranslations("preview");
  const dock = bare ? <LinkyoDock title={t("sampleDockTitle")} cta={t("sampleDockCta")} href="/signup" closeLabel={t("dockClose")} /> : undefined;

  return (
    <>
      {/* Safari 26 tints its toolbars from the page background, so the root must match the top of the creator page. */}
      <style>{direction === "poster" ? rootBackground(page.profile, theme) : `html,body{background-color:${theme.palette.bg}}`}</style>
      {portfolio ? (
        <PosterRenderer page={page} theme={theme} dock={dock} projectBase={portfolio.base} projectSuffix={portfolio.suffix} />
      ) : (
        <DirectionRenderer direction={direction} page={page} theme={theme} dock={dock} />
      )}
      <Suspense>
        <DirectionToolbar direction={direction} view="page" activeTemplate={theme.template} />
      </Suspense>
    </>
  );
}
