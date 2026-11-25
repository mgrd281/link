import { Badge, cn, Icon, icons } from "@linkyo/ui";
import type { LucideIcon } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import { phoneSizes } from "../assets";
import { EXAMPLE_SHOTS } from "../examples";
import { AnalyticsCard, Languages, ReadableColors } from "../features";
import { SECTION_TITLE } from "../headings";
import { PROJECT_SHOTS } from "../portfolio/shots";
import { FinalCta } from "../sections";
import { siteState } from "../site-state";
import { SITE_NUMBERS } from "./numbers";
import { SitePage, standaloneLink } from "./site-page";
import { bdi } from "./text";

type GroupKey = "page" | "portfolio" | "design" | "statistics" | "privacy";

/** The groups in reading order, each with its anchor, its glyph and where it leads. */
const GROUPS: { key: GroupKey; id: string; icon: LucideIcon; href: string; points: boolean }[] = [
  { key: "page", id: "seite", icon: icons.page, href: "/templates", points: true },
  { key: "portfolio", id: "portfolio", icon: icons.portfolio, href: "/portfolio", points: true },
  { key: "design", id: "design", icon: icons.design, href: "/templates", points: true },
  { key: "statistics", id: "statistik", icon: icons.analytics, href: "/sicherheit#statistik", points: true },
  // Privacy shows its facts beside it instead of points.
  { key: "privacy", id: "datenschutz", icon: icons.security, href: "/sicherheit", points: false },
];

/** The privacy group's facts, as a creator page shows them when it opens (asserted by e2e/creator-privacy-app.spec.ts). */
const FACTS = ["cookies", "trackers", "embeds", "hosting"] as const;

/** A phone around a capture of a real page: an ink bezel and a rounded screen (as on /portfolio). */
function Phone({ shot, alt }: { shot: StaticImageData; alt: string }) {
  return (
    <span className="mx-auto block w-3/5 max-w-preview-compact rounded-xl border border-line-strong bg-ink p-2 sm:w-1/2 lg:w-3/5">
      <span className="relative isolate block aspect-phone overflow-hidden rounded-lg bg-canvas-muted">
        <Image src={shot} alt={alt} fill sizes={phoneSizes.side} placeholder="blur" className="object-cover object-top" />
      </span>
    </span>
  );
}

/**
 * /funktionen: what a creator gets today, in five groups (the page, portfolio, design, statistics,
 * privacy). Each shows the thing itself: a real page captured from the product, the live theme engine,
 * the analytics card with its sample numbers, or what a creator page does when it opens; and each leads
 * on (to the gallery, the Portfolio page or the security page). Where creator pages are not counted,
 * the statistics group says it is planned instead of claiming it.
 */
export async function FeaturesPage({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "sitePages.features" });
  const state = siteState();
  const project = PROJECT_SHOTS["ronja-feldkamp"];
  const pictures: Record<GroupKey, ReactNode> = {
    page: <Phone shot={EXAMPLE_SHOTS["juno-kade"]} alt={t("groups.page.picture")} />,
    portfolio: project ? <Phone shot={project.image} alt={t("groups.portfolio.picture")} /> : null,
    design: (
      <div className="grid w-full max-w-prose gap-6">
        <ReadableColors />
        <Languages />
      </div>
    ),
    statistics: <AnalyticsCard />,
    privacy: (
      <figure className="grid w-full max-w-prose gap-4 rounded-xl border border-line bg-surface-elevated p-5 sm:p-6">
        <figcaption className="text-small font-semibold">{t("groups.privacy.caption")}</figcaption>
        <dl className="divide-y divide-line">
          {FACTS.map((fact) => (
            <div key={fact} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <dt className="text-body text-fg-secondary">{t(`groups.privacy.facts.${fact}.label`)}</dt>
              <dd className="text-body font-semibold">{t(`groups.privacy.facts.${fact}.value`)}</dd>
            </div>
          ))}
        </dl>
      </figure>
    ),
  };
  return (
    <SitePage current="features" icon={icons.features} eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")}>
      <nav aria-label={t("nav")} className="mx-auto w-full max-w-content px-5 md:px-10">
        <ul className="flex flex-wrap gap-2">
          {GROUPS.map((group) => (
            <li key={group.key}>
              <a
                href={`#${group.id}`}
                className="inline-flex min-h-touch-target items-center gap-2 rounded-full bg-canvas-muted px-4 text-small font-semibold text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring active:bg-pressed"
              >
                <Icon icon={group.icon} size="sm" className="text-link" />
                {t(`groups.${group.key}.title`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto grid w-full max-w-content gap-4 px-5 pt-8 md:px-10 md:pt-12">
        {GROUPS.map((group, index) => {
          const points = group.points ? (t.raw(`groups.${group.key}.points`) as unknown[]) : null;
          const planned = group.key === "statistics" && !state.statistics;
          return (
            <section
              key={group.key}
              id={group.id}
              aria-labelledby={`${group.id}-title`}
              className="mk-reveal grid scroll-mt-24 items-center gap-8 overflow-hidden rounded-xl bg-canvas-muted p-6 md:p-10 lg:grid-cols-2 lg:gap-12"
            >
              <div className={cn("grid content-start justify-items-start gap-4", index % 2 === 1 && "lg:order-last")}>
                <span aria-hidden className="grid size-control-md place-items-center rounded-full bg-tinted text-tinted-fg">
                  <Icon icon={group.icon} size="md" />
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h2 id={`${group.id}-title`} className={SECTION_TITLE}>
                    {t(`groups.${group.key}.title`)}
                  </h2>
                  {planned ? <Badge tone="outline">{t("planned")}</Badge> : null}
                </div>
                <p className="max-w-prose text-body-lg text-pretty text-fg-secondary">{t.rich(`groups.${group.key}.lead`, { ...SITE_NUMBERS, bdi })}</p>
                {points ? (
                  <ul className="grid gap-2">
                    {points.map((_, point) => (
                      <li key={`${group.key}-${String(point)}`} className="flex items-start gap-3 text-body">
                        <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
                          <Icon icon={icons.confirm} size="sm" />
                        </span>
                        <span className="min-w-0">{t.rich(`groups.${group.key}.points.${String(point)}`, { ...SITE_NUMBERS, bdi })}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link href={group.href} className={standaloneLink}>
                  {t(`groups.${group.key}.action`)}
                  <Icon icon={icons.next} size="sm" />
                </Link>
              </div>
              <div className="grid min-w-0 justify-items-center">{pictures[group.key]}</div>
            </section>
          );
        })}
      </div>
      <div className="pt-12 md:pt-24">
        <FinalCta />
      </div>
    </SitePage>
  );
}
