import { creatorTokens, tokens } from "@linkyo/tokens";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Button, cn, Icon, LogoGlyph } from "@linkyo/ui";
import { ArrowRight, BookOpenText, ChartNoAxesColumn, Expand, EyeOff, FolderKanban, Images, Info, Link2, Plus, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";

import { displayStyle } from "@/features/directions/poster/styles";
import { EXAMPLES } from "@/features/examples/catalog";
import { galleryItems } from "@/features/examples/gallery-items";
import { LOOKS, type LookId } from "@/features/examples/looks";
import { Link } from "@/i18n/navigation";

import { phoneSizes } from "../assets";
import { EXAMPLE_SHOTS, type ExampleShot } from "../examples";
import { PortfolioFields, type FieldTab } from "./fields";
import { pageHref, portfolioExamples, portfolioTemplates, professions, templateStartHref } from "./model";
import { LAPTOP_SHOTS, PROJECT_SHOTS } from "./shots";

const px = (n: number): string => `${n}px`;
/** `sizes` hints from layout tokens (no raw lengths in components). */
const sizes = {
  laptop: `(min-width: ${px(tokens.breakpoint.lg)}) ${px(Math.round(tokens.layout.content * 0.55))}, 90vw`,
  phone: `(min-width: ${px(tokens.breakpoint.lg)}) ${px(tokens.layout.menu)}, 36vw`,
} as const;

/** The opening's entrance order (mk-rise staggers by `--i`). */
const order = (n: number) => ({ "--i": n }) as CSSProperties;
const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
const label = (id: keyof typeof creatorTokens.templates) => creatorTokens.templates[id].label;

/** What a project page holds, each with its glyph (in the order a visitor reads a project). */
const PROJECT_PARTS: { key: string; icon: LucideIcon }[] = [
  { key: "figures", icon: ChartNoAxesColumn },
  { key: "story", icon: BookOpenText },
  { key: "pictures", icon: Images },
  { key: "large", icon: Expand },
  { key: "address", icon: Link2 },
  { key: "confidential", icon: EyeOff },
];

/**
 * A phone around a capture: an ink bezel and a rounded screen. No camera island: the captures start
 * at the page's first pixel (there is no status bar in them), so an island would cover the page.
 */
function DeviceFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("block rounded-xl border border-line-strong bg-ink p-2", className)}>
      <span className="relative isolate block aspect-phone overflow-hidden rounded-lg bg-canvas-muted">{children}</span>
    </span>
  );
}

function SectionHeader({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <header className="mk-reveal grid max-w-prose gap-4">
      <h2 id={id} className="text-h2 tracking-tight text-balance md:text-h1">
        {title}
      </h2>
      <p className="text-body-lg text-pretty text-fg-secondary">{lead}</p>
    </header>
  );
}

/**
 * /portfolio: the Portfolio section of the website (plan §4.1 a). Everything it lists comes from
 * code: the pages of the gallery's Portfolio category, the templates they use (names from the
 * tokens, lines from `templates.<id>.description`) and the captures in ./shots.ts, so a new portfolio
 * template or example appears here without a copy change.
 *
 * 1. The opening: the promise, and a real portfolio page on a laptop and a phone.
 * 2. The fields as tabs, each with its templates and example pages.
 * 3. What a project page can do, beside a real project page on a phone.
 * 4. The templates, each with "Start with this template".
 * 5. Questions, then one last call to sign up.
 */
export async function PortfolioLanding({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "portfolioLanding" });
  const tTemplates = await getTranslations({ locale, namespace: "templates" });
  const tCategories = await getTranslations({ locale, namespace: "examples.categories" });
  const { examples: cards } = await galleryItems(locale);
  const card = new Map(cards.map((item) => [item.slug, item]));
  const nameOf = (slug: LookId) => EXAMPLES[slug]?.profile.displayName ?? slug;

  // The opening shows the first portfolio page with both a laptop and a phone picture.
  const lead = portfolioExamples().find((slug) => slug in LAPTOP_SHOTS && slug in EXAMPLE_SHOTS);
  const laptopShot = lead ? LAPTOP_SHOTS[lead] : undefined;
  const phoneShot = lead ? EXAMPLE_SHOTS[lead as ExampleShot] : undefined;
  // "What a project page can do" shows a project page of the first page that has one pictured.
  const projectOwner = portfolioExamples().find((slug) => slug in PROJECT_SHOTS);
  const projectShot = projectOwner ? PROJECT_SHOTS[projectOwner] : undefined;
  const projectTitle =
    projectOwner && projectShot
      ? EXAMPLES[projectOwner]?.blocks.flatMap((block) => (block.type === "project" && block.slug === projectShot.project ? [block.title] : []))[0]
      : undefined;

  const templates = portfolioTemplates();
  const tabs: FieldTab[] = professions().map((field) => {
    const ids = [...new Set(field.examples.map((slug) => LOOKS[slug].theme.template))];
    return {
      key: field.key,
      label: t(`fields.${field.key}`),
      pages: field.examples.flatMap((slug) => {
        const item = card.get(slug);
        return item
          ? [{ item, href: pageHref(slug), open: t("fields.view", { name: nameOf(slug) }), template: t.rich("fields.template", { name: label(LOOKS[slug].theme.template), bdi }) }]
          : [];
      }),
      // "Start with Folio" leads to the same look from every tab and from the template row.
      templates: ids.map((id) => ({
        id,
        name: label(id),
        description: tTemplates(`${id}.description`),
        start: templateStartHref(id),
        startLabel: t.rich("fields.start", { name: label(id), bdi }),
      })),
    };
  });
  // Each answer through t.rich: Latin names and numbers in Arabic answers sit in <bdi>.
  const faq = (t.raw("faq.items") as unknown[]).map((_, index) => ({
    key: `faq-${String(index)}`,
    q: t.rich(`faq.items.${String(index)}.q`, { bdi }),
    a: t.rich(`faq.items.${String(index)}.a`, { bdi }),
  }));

  return (
    <>
      {/* 1. The opening. */}
      <section aria-labelledby="portfolio-title" className="overflow-x-clip">
        <div className="mx-auto grid w-full max-w-content grid-cols-1 items-center gap-10 px-5 pt-8 pb-12 md:px-10 md:pt-12 md:pb-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:py-16">
          <div className="grid min-w-0 justify-items-start gap-5 md:gap-6">
            <p className="mk-rise inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-semibold text-fg-secondary" style={order(0)}>
              <span aria-hidden className="grid size-6 place-items-center rounded-full bg-selected text-selected-fg">
                <Icon icon={FolderKanban} size="sm" />
              </span>
              {t("hero.eyebrow")}
            </p>
            <h1 id="portfolio-title" className="max-w-full text-h1 tracking-display text-balance md:text-display lg:text-display-sm">
              <span className="mk-rise block" style={order(1)}>
                {t("hero.title1")}
              </span>
              <span className="mk-rise block text-link" style={order(2)}>
                {t("hero.title2")}
              </span>
            </h1>
            <p className="mk-rise max-w-prose text-body text-pretty text-fg-secondary md:text-body-lg" style={order(3)}>
              {t("hero.lead")}
            </p>
            {/* Phones: two equal, full-width buttons, as in an app; wider screens: side by side. */}
            <div className="mk-rise grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap" style={order(4)}>
              <Button asChild variant="primary" size="cta" className="group">
                <Link href="/signup">
                  {t("hero.start")}
                  <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                </Link>
              </Button>
              {lead ? (
                <Button asChild variant="tinted" size="cta">
                  <a href={pageHref(lead)}>
                    {/* One flex item: the button's gap would otherwise open around the <bdi>. */}
                    <span>{t.rich("hero.open", { name: nameOf(lead), bdi })}</span>
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          {lead && laptopShot && phoneShot ? (
            <figure className="grid min-w-0 gap-4">
              {/* A real page on a laptop with the same page on a phone in front: one link to it. */}
              {/* The captures are of a left-to-right page: the frames keep their places in Arabic too,
                  so the phone covers the photo side of the laptop picture, not the start of its lines. */}
              <a
                href={pageHref(lead)}
                aria-label={t("hero.frames", { name: nameOf(lead) })}
                dir="ltr"
                className="group grid rounded-xl focus-visible:focus-ring"
              >
                <span className="col-start-1 row-start-1 me-12 self-start sm:me-20 lg:me-16">
                  <span className="block rounded-t-xl border border-line-strong bg-ink p-1 sm:p-2">
                    <span className="relative block overflow-hidden rounded-md bg-canvas-muted">
                      <Image src={laptopShot} alt="" sizes={sizes.laptop} placeholder="blur" priority className="block h-auto w-full" />
                    </span>
                  </span>
                  <span aria-hidden className="-mx-3 block h-3 rounded-b-xl border border-t-0 border-line-strong bg-canvas-muted sm:-mx-5 sm:h-4" />
                </span>
                <span className="col-start-1 row-start-1 mt-12 w-1/3 self-end justify-self-end transition-[translate] duration-standard ease-standard group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:mt-20 lg:w-3/10">
                  <DeviceFrame className="p-1 sm:p-2">
                    <Image src={phoneShot} alt="" fill sizes={sizes.phone} placeholder="blur" priority className="object-cover object-top" />
                  </DeviceFrame>
                </span>
              </a>
              <figcaption className="text-caption text-pretty text-fg-tertiary">
                {t.rich("hero.caption", { name: nameOf(lead), template: label(LOOKS[lead].theme.template), bdi })}
              </figcaption>
            </figure>
          ) : null}
        </div>
      </section>

      {/* 2. The fields. */}
      <section id="fields" aria-labelledby="fields-title" className="mx-auto w-full max-w-content scroll-mt-24 px-5 py-12 md:px-10 md:py-24">
        <SectionHeader id="fields-title" title={t("fields.title")} lead={t("fields.lead")} />
        <PortfolioFields tabs={tabs} label={t("fields.label")} chip={tCategories("portfolio")} />
      </section>

      {/* 3. What a project page can do. */}
      <section aria-labelledby="project-title" className="mx-auto w-full max-w-content px-5 md:px-10">
        <div className="grid gap-10 overflow-hidden rounded-xl bg-canvas-muted p-6 md:p-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-x-16 lg:gap-y-10 lg:p-16">
          <div className="lg:col-start-2">
            <SectionHeader id="project-title" title={t("project.title")} lead={t("project.lead")} />
          </div>
          {projectOwner && projectShot ? (
            <a
              href={`${pageHref(projectOwner)}/${projectShot.project}`}
              aria-label={t("project.open", { title: projectTitle ?? projectShot.project })}
              className="group mx-auto block w-3/5 max-w-preview-compact rounded-xl focus-visible:focus-ring sm:w-1/2 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:w-3/4 lg:self-center"
            >
              <DeviceFrame className="transition-[translate] duration-standard ease-standard group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                <Image
                  src={projectShot.image}
                  alt=""
                  fill
                  sizes={phoneSizes.story}
                  placeholder="blur"
                  className="object-cover object-top"
                />
              </DeviceFrame>
            </a>
          ) : null}
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:col-start-2">
            {PROJECT_PARTS.map((part) => (
              // Phones: the glyph beside the words; two columns: the glyph above them.
              <li key={part.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-1 sm:grid-cols-1 sm:content-start sm:gap-y-2">
                <span aria-hidden className="row-span-2 grid size-control-md place-items-center rounded-full bg-surface text-link sm:row-span-1">
                  <Icon icon={part.icon} size="md" />
                </span>
                <h3 className="text-body-lg font-semibold">{t(`project.items.${part.key}.title`)}</h3>
                <p className="text-body text-pretty text-fg-secondary">{t.rich(`project.items.${part.key}.body`, { bdi })}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. The templates. */}
      <section aria-labelledby="portfolio-templates-title" className="mx-auto w-full max-w-content px-5 py-12 md:px-10 md:py-24">
        <SectionHeader id="portfolio-templates-title" title={t("templates.title")} lead={t("templates.lead")} />
        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {templates.map((template) => {
            const theme = resolveCreatorTheme({ template: template.id }, { rtlScript: locale === "ar" });
            const start = templateStartHref(template.id);
            return (
              <li key={template.id} className="grid grid-rows-[auto_1fr] overflow-hidden rounded-xl border border-line bg-surface">
                {/* The template's name in its own colours and display face (the engine keeps them AA). */}
                <div style={theme.cssVars} className="grid content-end gap-3 bg-creator-bg p-5 pt-12 text-creator-fg md:aspect-video">
                  <h3 className="font-creator-display text-h1 leading-none" style={displayStyle}>
                    {label(template.id)}
                  </h3>
                  <span aria-hidden className="h-1 w-1/4 rounded-full bg-creator-accent" />
                </div>
                <div className="grid content-start justify-items-start gap-4 p-5">
                  <p className="text-body text-pretty text-fg-secondary">{tTemplates(`${template.id}.description`)}</p>
                  <div className="grid gap-1">
                    <p className="text-caption font-semibold text-fg-secondary">{t("templates.examples")}</p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {template.examples.map((slug) => (
                        <li key={slug}>
                          <a
                            href={pageHref(slug)}
                            className="-mx-1 inline-flex min-h-touch-target items-center rounded-sm px-1 text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring md:min-h-0"
                          >
                            <bdi>{nameOf(slug)}</bdi>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button asChild variant="tinted" size="lg" className="mt-auto rounded-full font-semibold">
                    <Link href={start}>
                      <span>{t.rich("templates.start", { name: label(template.id), bdi })}</span>
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <Link
          href="/templates?category=portfolio#gallery"
          className="group mt-8 -mx-2 inline-flex min-h-touch-target items-center gap-2 rounded-full px-2 text-body font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed"
        >
          {t("templates.gallery")}
          <Icon icon={ArrowRight} size="sm" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
        </Link>
      </section>

      {/* 5. Questions. */}
      <section aria-labelledby="portfolio-faq-title" className="mx-auto grid w-full max-w-content grid-cols-1 gap-8 px-5 pb-12 md:px-10 md:pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <h2 id="portfolio-faq-title" className="mk-reveal text-h2 tracking-tight text-balance md:text-h1 lg:sticky lg:top-24 lg:self-start">
          {t("faq.title")}
        </h2>
        <div className="divide-y divide-line border-y border-line">
          {faq.map((item) => (
            <details key={item.key} className="group mk-faq">
              <summary className="-mx-3 flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-md px-3 py-4 text-body-lg font-semibold text-balance outline-none transition-colors duration-micro focus-visible:focus-ring active:bg-pressed [&::-webkit-details-marker]:hidden">
                {/* One flex item: the summary spreads its children apart, and a <bdi> is a child too. */}
                <span>{item.q}</span>
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-canvas-muted text-fg-secondary transition-[rotate,background-color,color] duration-standard ease-standard group-open:rotate-45 group-open:bg-primary group-open:text-primary-fg motion-reduce:transition-none">
                  <Icon icon={Plus} size="sm" />
                </span>
              </summary>
              <p className="pe-12 pb-5 text-body text-pretty text-fg-secondary">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 6. The last word, in the brand colour. */}
      <section aria-labelledby="portfolio-final-title" className="mx-auto w-full max-w-content px-5 md:px-10">
        <div className="relative isolate grid justify-items-center gap-6 overflow-hidden rounded-xl bg-primary px-5 py-16 text-center text-primary-fg md:px-10 md:py-24">
          <LogoGlyph className="pointer-events-none absolute -end-12 -top-12 h-auto w-2/5 rotate-12 text-primary-hover md:-end-16 md:-top-20 md:w-1/4 rtl:-rotate-12" />
          <h2 id="portfolio-final-title" className="relative text-h1 tracking-tight text-balance md:text-display">
            {t("final.title")}
          </h2>
          <p className="relative max-w-prose text-body-lg text-pretty">{t("final.lead")}</p>
          <Link
            href="/signup"
            className="relative inline-flex h-control-xl w-full items-center justify-center gap-2 rounded-full bg-primary-fg px-6 text-body font-semibold text-primary transition-transform duration-micro hover:-translate-y-0.5 focus-visible:focus-ring active:scale-pressed motion-reduce:hover:translate-y-0 sm:w-auto"
          >
            {t("final.cta")}
            <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
          </Link>
        </div>
        <p className="mt-6 flex max-w-prose items-start gap-2 text-caption text-fg-tertiary">
          <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
          {t("fictional")}
        </p>
      </section>
    </>
  );
}
