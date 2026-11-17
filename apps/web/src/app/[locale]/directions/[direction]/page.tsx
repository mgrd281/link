import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { DirectionRenderer } from "@/features/directions/direction-renderer";
import { loadSamplePage } from "@/features/directions/load";
import { isCreatorPreset } from "@/features/directions/preset";
import { directionTheme, DIRECTIONS, isDirection } from "@/features/directions/registry";
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
  searchParams: Promise<{ preset?: string }>;
}) {
  const { locale, direction } = await params;
  if (!isDirection(direction)) notFound();
  setRequestLocale(locale);
  const { preset } = await searchParams;
  const page = await loadSamplePage(locale);
  // Any preset works with any direction: the toolbar proves layout and theme are independent.
  const theme = resolveCreatorTheme(isCreatorPreset(preset) ? { preset } : directionTheme[direction], { rtlScript: locale === "ar" });

  return (
    <>
      <DirectionRenderer direction={direction} page={page} theme={theme} />
      <Suspense>
        <DirectionToolbar direction={direction} view="page" />
      </Suspense>
    </>
  );
}
