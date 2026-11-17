import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Icon } from "@linkyo/ui";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/site-header";
import { DirectionLinks } from "@/features/directions/direction-links";
import { DirectionRenderer } from "@/features/directions/direction-renderer";
import { loadSamplePage } from "@/features/directions/load";
import { directionTheme, DIRECTIONS } from "@/features/directions/registry";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "directions" });
  return { title: t("title") };
}

export default async function DirectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("directions");
  const page = await loadSamplePage(locale);

  return (
    <>
      <SiteHeader active="directions" />
      <main id="main" className="mx-auto grid max-w-content gap-12 px-5 py-16">
        <header className="grid gap-4">
          <h1 className="text-display tracking-display">{t("title")}</h1>
          <p className="max-w-prose text-body-lg text-fg-secondary">{t("lead")}</p>
        </header>
        <ol className="grid gap-8 lg:grid-cols-3">
          {DIRECTIONS.map((direction, index) => {
            const theme = resolveCreatorTheme(directionTheme[direction], { rtlScript: locale === "ar" });
            const traits = t.raw(`${direction}.traits`) as string[];
            return (
              <li key={direction} className="grid content-start gap-6">
                <div className="relative aspect-short overflow-hidden rounded-xl border border-line shadow-e2" aria-hidden inert>
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <DirectionRenderer direction={direction} page={page} theme={theme} preview />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-canvas to-transparent" />
                </div>
                <div className="grid gap-3">
                  <p className="font-mono text-caption text-fg-tertiary">0{index + 1}</p>
                  <h2 className="text-h2">{t(`${direction}.name`)}</h2>
                  <p className="text-body font-medium">{t(`${direction}.tagline`)}</p>
                  <p className="text-body text-fg-secondary">{t(`${direction}.description`)}</p>
                  <ul className="grid gap-2 pt-1">
                    {traits.map((trait) => (
                      <li key={trait} className="flex items-start gap-2 text-small text-fg-secondary">
                        <Icon icon={Check} size="sm" className="mt-0.5 text-success-strong" />
                        {trait}
                      </li>
                    ))}
                  </ul>
                </div>
                <DirectionLinks direction={direction} pageLabel={t("viewPage")} dashboardLabel={t("viewDashboard")} />
              </li>
            );
          })}
        </ol>
        <p className="text-body text-fg-secondary">{t("pick")}</p>
      </main>
    </>
  );
}
