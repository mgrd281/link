import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { Icon } from "@linkyo/ui";
import { ArrowDown, ArrowRight, Info, Languages, LayoutGrid, Palette, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EXAMPLES } from "@/features/examples/catalog";
import { ExampleGallery, type GalleryItem } from "@/features/examples/gallery";
import { LOOKS, PEOPLE_LOOKS, type LookId } from "@/features/examples/looks";
import { MarketingFooter } from "@/features/marketing/footer";
import { MarketingHeader } from "@/features/marketing/header";
import { PREVIEWS } from "@/features/previews/registry";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "examples.meta" });
  return { title: { absolute: t("title") }, description: t("description") };
}

/** Prepares one card: the example's look resolved to CSS variables, its picture and first buttons. */
function item(slug: LookId): GalleryItem | null {
  const look = LOOKS[slug];
  const page = EXAMPLES[slug] ?? PREVIEWS[slug]?.pages[look.locale];
  if (!page) return null;
  const theme = resolveCreatorTheme(look.theme, { rtlScript: look.locale === "ar" });
  const photo = page.profile.hero ?? page.profile.avatar;
  const links = page.blocks.flatMap((block) => (block.type === "link" ? [block.title] : []));
  return {
    slug,
    name: page.profile.displayName,
    tagline: page.profile.tagline ?? page.profile.bio,
    category: look.category,
    locale: look.locale,
    style: theme.cssVars,
    photo: photo.src.startsWith("none:") ? null : photo.src,
    logo: page.profile.logo?.src ?? null,
    hero: theme.layout.hero,
    links,
    signup: `/signup?kind=${look.kind}&look=${slug}`,
  };
}

/**
 * A card for a real person's page (concept page or prepared preview), in the visitor's language
 * when the page exists in it.
 */
function personItem(slug: string, locale: string): GalleryItem | null {
  const preview = PREVIEWS[slug];
  const look = PEOPLE_LOOKS[slug];
  if (!preview || !look) return null;
  const pageLocale = (locale in preview.pages ? locale : Object.keys(preview.pages)[0]) as "de" | "en" | "ar" | undefined;
  const page = pageLocale ? preview.pages[pageLocale] : undefined;
  if (!page || !pageLocale) return null;
  const theme = resolveCreatorTheme(preview.theme, { rtlScript: pageLocale === "ar" });
  const photo = page.profile.hero ?? page.profile.avatar;
  return {
    slug,
    name: page.profile.displayName,
    tagline: page.profile.tagline ?? page.profile.bio,
    category: "people",
    locale: pageLocale,
    style: theme.cssVars,
    photo: photo.src.startsWith("none:") ? null : photo.src,
    logo: page.profile.logo?.src ?? null,
    hero: theme.layout.hero,
    links: page.blocks.flatMap((block) => (block.type === "link" ? [block.title] : [])),
    signup: `/signup?kind=${look.kind}&look=${slug}`,
    badge: preview.concept ? "concept" : "preview",
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
  const examples = (Object.keys(LOOKS) as LookId[]).map(item);
  const people = Object.keys(PEOPLE_LOOKS).map((slug) => personItem(slug, locale));
  const items = [...examples, ...people].filter((entry): entry is GalleryItem => entry !== null);

  const stats: { icon: LucideIcon; value: number; label: string }[] = [
    { icon: LayoutGrid, value: items.length, label: t("stats.examples") },
    { icon: Palette, value: TEMPLATE_IDS.length, label: t("stats.designs") },
    { icon: Languages, value: 3, label: t("stats.languages") },
  ];

  return (
    <>
      <MarketingHeader />
      <main id="main" className="mx-auto grid max-w-content grid-cols-1 gap-16 px-5 pt-12 pb-16 md:px-10 md:pt-20 md:pb-24">
        <ExampleGallery
          items={items}
          intro={
            <header className="mk-rise grid content-center gap-6">
              <p className="inline-flex items-center gap-2 justify-self-start rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-semibold text-fg-secondary shadow-e1">
                <span className="grid size-6 place-items-center rounded-full bg-selected text-selected-fg">
                  <Icon icon={Sparkles} size="sm" />
                </span>
                {t("eyebrow")}
              </p>
              <h1 className="text-h1 tracking-tight text-balance md:text-display">{t("title")}</h1>
              <p className="max-w-prose text-body-lg text-pretty text-fg-secondary">{t("lead")}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex h-control-lg items-center gap-2 rounded-full bg-primary px-5 text-body font-semibold text-primary-fg shadow-cta transition-[background-color,translate,scale] duration-micro hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:focus-ring active:translate-y-0 active:scale-pressed motion-reduce:hover:translate-y-0"
                >
                  {t("ctaButton")}
                  <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                </Link>
                <a
                  href="#gallery"
                  className="group inline-flex h-control-lg items-center gap-2 rounded-full border border-line-strong bg-surface px-5 text-body font-semibold text-fg shadow-e1 transition-colors duration-micro hover:bg-surface-elevated focus-visible:focus-ring active:scale-pressed"
                >
                  {t("browse")}
                  <Icon icon={ArrowDown} size="md" className="transition-transform duration-micro group-hover:translate-y-0.5" />
                </a>
              </div>
              <ul aria-label={t("stats.label")} className="grid grid-cols-3 gap-4 border-t border-line pt-6 sm:flex sm:gap-x-8">
                {stats.map((stat) => (
                  <li key={stat.label} className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <span aria-hidden className="grid size-control-md place-items-center rounded-lg bg-selected text-selected-fg">
                      <Icon icon={stat.icon} size="md" />
                    </span>
                    <span className="grid">
                      <span className="text-h3 leading-none tabular-nums">{stat.value}</span>
                      <span className="text-small text-fg-secondary">{stat.label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </header>
          }
        />

        <section className="relative isolate grid gap-6 overflow-hidden rounded-xl bg-primary p-6 text-primary-fg shadow-e2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-10">
          <div aria-hidden className="mk-glow absolute -end-16 -top-16 size-32 rounded-full bg-primary-hover blur-ambient" />
          <span aria-hidden className="relative grid size-control-xl place-items-center rounded-full bg-primary-fg text-primary">
            <Icon icon={WandSparkles} size="lg" />
          </span>
          <p className="relative text-h3 text-balance">{t("cta")}</p>
          <Link
            href="/signup"
            className="relative inline-flex h-control-lg items-center justify-center gap-2 justify-self-start rounded-full bg-primary-fg px-6 text-body font-semibold text-primary shadow-e1 transition-transform duration-micro hover:-translate-y-0.5 focus-visible:focus-ring active:scale-pressed md:justify-self-end"
          >
            {t("ctaButton")}
            <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
          </Link>
        </section>
        <p className="-mt-10 flex max-w-prose items-start gap-2 text-caption text-fg-tertiary">
          <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
          {t("fictional")}
        </p>
      </main>
      <MarketingFooter />
    </>
  );
}
