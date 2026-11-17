import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Badge, Icon } from "@linkyo/ui";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/site-header";
import { DirectionLinks } from "@/features/directions/direction-links";
import { DirectionRenderer } from "@/features/directions/direction-renderer";
import { loadSamplePage } from "@/features/directions/load";
import { directionTheme, DIRECTIONS, type DirectionId } from "@/features/directions/registry";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "directions" });
  return { title: t("title") };
}

/** A phone-shaped, non-interactive snapshot of a direction (the real renderer, scaled by container queries). */
async function Snapshot({ direction, locale, mode }: { direction: DirectionId; locale: string; mode?: "light" | "dark" }) {
  const page = await loadSamplePage(locale, direction);
  const config = directionTheme[direction];
  const theme = resolveCreatorTheme(mode ? { ...config, mode } : config, { rtlScript: locale === "ar" });
  return (
    <div className="relative aspect-short overflow-hidden rounded-xl border border-line shadow-e2" aria-hidden inert>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <DirectionRenderer direction={direction} page={page} theme={theme} preview />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-canvas to-transparent" />
    </div>
  );
}

function Traits({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2 pt-1">
      {items.map((trait) => (
        <li key={trait} className="flex items-start gap-2 text-small text-fg-secondary">
          <Icon icon={Check} size="sm" className="mt-0.5 text-success-strong" />
          {trait}
        </li>
      ))}
    </ul>
  );
}

export default async function DirectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("directions");
  const earlier = DIRECTIONS.filter((direction) => direction !== "poster");

  return (
    <>
      <SiteHeader active="directions" />
      <main id="main" className="mx-auto grid max-w-content gap-16 px-5 py-16">
        <header className="grid gap-4">
          <h1 className="text-display tracking-display">{t("title")}</h1>
          <p className="max-w-prose text-body-lg text-fg-secondary">{t("lead")}</p>
        </header>

        <section aria-labelledby="poster-title" className="grid items-center gap-10 rounded-xl border border-line bg-surface p-5 shadow-e1 md:p-8 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <Snapshot direction="poster" locale={locale} mode="light" />
            <Snapshot direction="poster" locale={locale} mode="dark" />
          </div>
          <div className="grid content-center gap-4">
            <Badge tone="primary" dot className="justify-self-start">
              {t("yourPick")}
            </Badge>
            <h2 id="poster-title" className="text-h1">
              {t("poster.name")}
            </h2>
            <p className="text-body-lg font-medium">{t("poster.tagline")}</p>
            <p className="text-body text-fg-secondary">{t("poster.description")}</p>
            <Traits items={t.raw("poster.traits") as string[]} />
            <DirectionLinks direction="poster" pageLabel={t("viewPage")} dashboardLabel={t("viewDashboard")} />
          </div>
        </section>

        <section aria-labelledby="earlier-title" className="grid gap-8">
          <h2 id="earlier-title" className="text-h2">
            {t("earlier")}
          </h2>
          <ol className="grid gap-8 lg:grid-cols-3">
            {earlier.map((direction, index) => (
              <li key={direction} className="grid content-start gap-6">
                <Snapshot direction={direction} locale={locale} />
                <div className="grid gap-3">
                  <p className="font-mono text-caption text-fg-tertiary">0{index + 1}</p>
                  <h3 className="text-h2">{t(`${direction}.name`)}</h3>
                  <p className="text-body font-medium">{t(`${direction}.tagline`)}</p>
                  <p className="text-body text-fg-secondary">{t(`${direction}.description`)}</p>
                  <Traits items={t.raw(`${direction}.traits`) as string[]} />
                </div>
                <DirectionLinks direction={direction} pageLabel={t("viewPage")} dashboardLabel={t("viewDashboard")} />
              </li>
            ))}
          </ol>
        </section>
        <p className="text-body text-fg-secondary">{t("pick")}</p>
      </main>
    </>
  );
}
