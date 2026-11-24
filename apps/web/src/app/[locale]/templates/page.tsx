import { Button, Icon, LogoGlyph } from "@linkyo/ui";
import { ArrowDown, ArrowRight, Info, LayoutTemplate } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ExampleGallery } from "@/features/examples/gallery";
import { galleryItems, visitorFirst } from "@/features/examples/gallery-items";
import { SITE_COUNTS } from "@/features/examples/looks";
import { MarketingFooter } from "@/features/marketing/footer";
import { MarketingHeader } from "@/features/marketing/header";
import { PageWall } from "@/features/marketing/page-wall";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "examples.meta" });
  return {
    title: { absolute: t("title") },
    // "14 Designs · 91 Beispielseiten": both numbers come from code (SITE_COUNTS).
    description: t("description", SITE_COUNTS),
    alternates: localeAlternates("/templates", locale),
  };
}

/**
 * /templates: the example gallery. Fictional people and businesses, each page in its own look, then
 * pages of well-known people (labelled concepts and previews, at the founder's request).
 */
export default async function TemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("examples");
  const { examples: all, people } = await galleryItems(locale);
  // The visitor's own language every other card.
  const examples = visitorFirst(all, locale);
  const items = [...examples, ...people];

  // One vocabulary everywhere: designs (the templates) and example pages (the cards below).
  const stats = [
    { value: SITE_COUNTS.designs, label: t("stats.designs", { count: SITE_COUNTS.designs }) },
    { value: SITE_COUNTS.pages, label: t("stats.examples", { count: SITE_COUNTS.pages }) },
    { value: 3, label: t("stats.languages", { count: 3 }) },
  ];

  return (
    <>
      <MarketingHeader edge={false} current="templates" />
      <main id="main" className="max-w-content mx-auto grid grid-cols-1 gap-16 px-5 pt-12 md:px-10">
        <ExampleGallery
          items={items}
          // The same tilted wall of pages as beside the sign-in form, standing still: a full-bleed band
          // on phones, a framed panel as tall as the intro beside it on wide screens. Rendered here, on
          // the server: it ships no script.
          wall={
            <PageWall
              eager
              sizes="(min-width: 64rem) 7rem, 24vw"
              className="border-line -mx-5 aspect-video border-y md:-mx-10 lg:mx-0 lg:aspect-auto lg:min-h-(--container-sidebar) lg:rounded-xl lg:border"
            />
          }
          intro={
            <header className="mk-settle grid content-center gap-6">
              <p className="border-line bg-surface text-small text-fg-secondary inline-flex items-center gap-2 justify-self-start rounded-full border py-1 ps-1 pe-3 font-semibold">
                <span className="bg-selected text-selected-fg grid size-6 place-items-center rounded-full">
                  <Icon icon={LayoutTemplate} size="sm" />
                </span>
                {t("eyebrow")}
              </p>
              <h1 className="text-h1 md:text-display lg:text-display-sm tracking-tight text-balance">
                {t("title", { count: SITE_COUNTS.pages })}
              </h1>
              <p className="text-body text-fg-secondary md:text-body-lg max-w-prose text-pretty">
                {t("lead")}
              </p>
              {/* Phones: two equal, full-width buttons, as in an app; wider screens: side by side. */}
              <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                <Button
                  asChild
                  variant="primary"
                  size="xl"
                  className="group sm:h-control-lg rounded-full font-semibold sm:px-5"
                >
                  <Link href="/signup">
                    {t("ctaButton")}
                    <Icon
                      icon={ArrowRight}
                      size="md"
                      className="duration-micro transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                    />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="tinted"
                  size="xl"
                  className="group sm:h-control-lg rounded-full font-semibold sm:px-5"
                >
                  <a href="#gallery">
                    {t("browse")}
                    <Icon
                      icon={ArrowDown}
                      size="md"
                      className="duration-micro transition-transform group-hover:translate-y-0.5"
                    />
                  </a>
                </Button>
              </div>
              {/* Three figures: on a narrow phone the last one wraps instead of running off the screen. */}
              <ul aria-label={t("stats.label")} className="border-line flex flex-wrap gap-x-6 gap-y-2 border-t pt-5 sm:gap-x-8 sm:pt-6">
                {stats.map((stat) => (
                  <li key={stat.label} className="flex items-baseline gap-2">
                    <span className="text-h2 tracking-tight tabular-nums">{stat.value}</span>
                    <span className="text-small text-fg-secondary">{stat.label}</span>
                  </li>
                ))}
              </ul>
            </header>
          }
        />

        <p className="text-caption text-fg-tertiary -mt-10 flex max-w-prose items-start gap-2">
          <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
          {t("fictional")}
        </p>
        <section
          aria-labelledby="templates-cta"
          className="bg-primary text-primary-fg relative isolate grid gap-6 overflow-hidden rounded-xl p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-10"
        >
          <LogoGlyph className="text-primary-hover pointer-events-none absolute -end-10 -top-12 h-auto w-1/3 rotate-12 md:w-1/6 rtl:-rotate-12" />
          <div className="relative grid gap-2">
            <h2 id="templates-cta" className="text-h2 tracking-tight text-balance">
              {t("ctaTitle")}
            </h2>
            <p className="text-body-lg text-pretty">{t("ctaLead")}</p>
          </div>
          <Link
            href="/signup"
            className="h-control-xl bg-primary-fg text-body text-primary duration-micro focus-visible:focus-ring active:scale-pressed md:h-control-lg relative inline-flex w-full items-center justify-center gap-2 rounded-full px-6 font-semibold transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:w-auto sm:justify-self-start md:justify-self-end"
          >
            {t("ctaButton")}
            <Icon icon={ArrowRight} size="md" />
          </Link>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
