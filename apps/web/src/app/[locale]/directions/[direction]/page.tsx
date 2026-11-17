import { colorSchemeOf, isTemplate, resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { DirectionRenderer } from "@/features/directions/direction-renderer";
import { defaultTheme, loadSamplePage } from "@/features/directions/load";
import { isCreatorPreset } from "@/features/directions/preset";
import { DIRECTIONS, isDirection, isThemeMode } from "@/features/directions/registry";
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
  searchParams: Promise<{ preset?: string; mode?: string; template?: string }>;
}

/** Page + resolved theme for a request. Any preset works with any direction and either mode. */
async function resolveRoute({ params, searchParams }: RouteProps) {
  const { locale, direction } = await params;
  if (!isDirection(direction)) notFound();
  const { preset, mode, template } = await searchParams;
  const page = await loadSamplePage(locale, direction);
  const config = isTemplate(template) ? { template } : isCreatorPreset(preset) ? { preset } : defaultTheme(direction, page);
  const theme = resolveCreatorTheme(isThemeMode(mode) ? { ...config, mode } : config, { rtlScript: locale === "ar" });
  return { locale, direction, page, theme };
}

/** Browser chrome (status bar, address bar, overscroll) takes the creator's page color. */
export async function generateViewport(props: RouteProps): Promise<Viewport> {
  const { theme } = await resolveRoute(props);
  return { themeColor: theme.palette.bg, colorScheme: colorSchemeOf(theme.palette.mode) };
}

export default async function CreatorPageRoute(props: RouteProps) {
  const { locale, direction, page, theme } = await resolveRoute(props);
  setRequestLocale(locale);

  return (
    <>
      {/* Safari 26 tints its toolbars from the page background, so the root must match the creator page. */}
      <style>{`html,body{background-color:${theme.palette.bg}}`}</style>
      <DirectionRenderer direction={direction} page={page} theme={theme} />
      <Suspense>
        <DirectionToolbar direction={direction} view="page" activeTemplate={theme.template} />
      </Suspense>
    </>
  );
}
