import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { Badge, Icon } from "@linkyo/ui";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/site-header";
import { DirectionLinks } from "@/features/directions/direction-links";
import { DirectionRenderer } from "@/features/directions/direction-renderer";
import { loadSamplePage } from "@/features/directions/load";
import { directionTheme, DIRECTIONS, type DirectionId } from "@/features/directions/registry";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "directions" });
  return { title: t("title") };
}

/** A phone-shaped, non-interactive snapshot of a direction (the real renderer, scaled by container queries). */
async function Snapshot({
  direction,
  locale,
  template,
}: {
  direction: DirectionId;
  locale: string;
  template?: CreatorTemplateId;
}) {
  const page = await loadSamplePage(locale, direction);
  const config = template ? { template } : directionTheme[direction];
  const theme = resolveCreatorTheme(config, { rtlScript: locale === "ar" });
  return (
    <div
      className="aspect-short border-line relative overflow-hidden rounded-xl border"
      aria-hidden
      inert
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <DirectionRenderer direction={direction} page={page} theme={theme} preview />
      </div>
      <div className="from-canvas absolute inset-x-0 bottom-0 h-24 bg-linear-to-t to-transparent" />
    </div>
  );
}

function Traits({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2 pt-1">
      {items.map((trait) => (
        <li key={trait} className="text-small text-fg-secondary flex items-start gap-2">
          <Icon icon={Check} size="sm" className="text-success-strong mt-0.5" />
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
  const tTemplates = await getTranslations("templates");
  const earlier = DIRECTIONS.filter((direction) => direction !== "poster");

  return (
    <>
      <SiteHeader active="directions" />
      <main id="main" className="max-w-content mx-auto grid gap-16 px-5 py-16">
        <header className="grid gap-4">
          <h1 className="text-display tracking-display">{t("title")}</h1>
          <p className="text-body-lg text-fg-secondary max-w-prose">{t("lead")}</p>
        </header>

        <section
          aria-labelledby="poster-title"
          className="border-line bg-surface grid gap-10 rounded-xl border p-5 md:p-8"
        >
          <div
            role="region"
            aria-label={t("poster.templatesLabel")}
            tabIndex={0}
            className="focus-visible:focus-ring -mx-5 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8 lg:mx-0 lg:overflow-visible lg:px-0"
          >
            <ul className="grid auto-cols-[44%] grid-flow-col gap-4 sm:auto-cols-[30%] lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-5">
              {TEMPLATE_IDS.map((id) => (
                <li key={id} className="grid content-start gap-2">
                  <Snapshot direction="poster" locale={locale} template={id} />
                  <p className="text-small font-semibold">{creatorTokens.templates[id].label}</p>
                  <p className="text-caption text-fg-secondary">{tTemplates(`${id}.description`)}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid max-w-prose content-center gap-4">
            <Badge tone="primary" dot className="justify-self-start">
              {t("yourPick")}
            </Badge>
            <h2 id="poster-title" className="text-h1">
              {t("poster.name")}
            </h2>
            <p className="text-body-lg font-medium">{t("poster.tagline")}</p>
            <p className="text-body text-fg-secondary">{t("poster.description")}</p>
            <Traits items={t.raw("poster.traits") as string[]} />
            <DirectionLinks
              direction="poster"
              pageLabel={t("viewPage")}
              dashboardLabel={t("viewDashboard")}
            />
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
                  <p className="text-caption text-fg-tertiary font-mono">0{index + 1}</p>
                  <h3 className="text-h2">{t(`${direction}.name`)}</h3>
                  <p className="text-body font-medium">{t(`${direction}.tagline`)}</p>
                  <p className="text-body text-fg-secondary">{t(`${direction}.description`)}</p>
                  <Traits items={t.raw(`${direction}.traits`) as string[]} />
                </div>
                <DirectionLinks
                  direction={direction}
                  pageLabel={t("viewPage")}
                  dashboardLabel={t("viewDashboard")}
                />
              </li>
            ))}
          </ol>
        </section>
        <p className="text-body text-fg-secondary">{t("pick")}</p>
      </main>
    </>
  );
}
