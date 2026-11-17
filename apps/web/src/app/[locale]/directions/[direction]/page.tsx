import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata } from "next";
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

export default async function CreatorPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; direction: string }>;
  searchParams: Promise<{ preset?: string; mode?: string }>;
}) {
  const { locale, direction } = await params;
  if (!isDirection(direction)) notFound();
  setRequestLocale(locale);
  const { preset, mode } = await searchParams;
  const page = await loadSamplePage(locale, direction);
  // Any preset works with any direction and either mode: the toolbar proves layout and theme are independent.
  const config = isCreatorPreset(preset) ? { preset } : defaultTheme(direction, page);
  const theme = resolveCreatorTheme(isThemeMode(mode) ? { ...config, mode } : config, { rtlScript: locale === "ar" });

  return (
    <>
      <DirectionRenderer direction={direction} page={page} theme={theme} />
      <Suspense>
        <DirectionToolbar direction={direction} view="page" activeMode={theme.palette.mode} />
      </Suspense>
    </>
  );
}
