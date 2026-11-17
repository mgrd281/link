import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { GalleryDashboard } from "@/features/directions/gallery/dashboard";
import { loadSamplePage } from "@/features/directions/load";
import { MosaicDashboard } from "@/features/directions/mosaic/dashboard";
import { directionTheme, DIRECTIONS, isDirection } from "@/features/directions/registry";
import { StageDashboard } from "@/features/directions/stage/dashboard";
import { DirectionToolbar } from "@/features/directions/toolbar";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DIRECTIONS.map((direction) => ({ locale, direction })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("pageTitle") };
}

export default async function DashboardRoute({ params }: { params: Promise<{ locale: string; direction: string }> }) {
  const { locale, direction } = await params;
  if (!isDirection(direction)) notFound();
  setRequestLocale(locale);
  const page = await loadSamplePage(locale);
  const initial = { blocks: page.blocks, sizes: {}, theme: directionTheme[direction] };
  const pageHref = `/${locale}/directions/${direction}?chrome=0`;
  const Dashboard = direction === "gallery" ? GalleryDashboard : direction === "stage" ? StageDashboard : MosaicDashboard;
  return (
    <>
      <Dashboard initial={initial} profile={page.profile} pageHref={pageHref} />
      <Suspense>
        <DirectionToolbar direction={direction} view="dashboard" />
      </Suspense>
    </>
  );
}
