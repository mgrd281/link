import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { Button, Icon, LogoGlyph } from "@linkyo/ui";
import { ArrowDown, ArrowRight, Info, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EXAMPLES } from "@/features/examples/catalog";
import { ExampleGallery, type GalleryItem } from "@/features/examples/gallery";
import { GALLERY_LEAD, LOOKS, PEOPLE_LOOKS, PEOPLE_ORDER, type LookId } from "@/features/examples/looks";
import { MarketingFooter } from "@/features/marketing/footer";
import { MarketingHeader } from "@/features/marketing/header";
import { PageWall } from "@/features/marketing/page-wall";
import { PREVIEWS } from "@/features/previews/registry";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "examples.meta" });
  const count = Object.keys(LOOKS).length + Object.keys(PEOPLE_LOOKS).length;
  return { title: { absolute: t("title") }, description: t("description", { count }), alternates: localeAlternates("/templates", locale) };
}

type Translate = (key: string) => string;

/**
 * Words a visitor may search for, in all three languages: the kind of page ("Entwickler:in",
 * "lawyer", "مصمّم") and the category. Pages are written in their own language, so without these an
 * English visitor searching "lawyer" would not find the German lawyer's page.
 */
function keywords(kind: string, category: string, kinds: Translate[], categories: Translate[]): string {
  return [...(kind === "other" ? [] : kinds.map((k) => k(`${kind}.label`))), ...categories.map((k) => k(category))].join(" ");
}

/** Prepares one card: the example's look resolved to CSS variables, its picture and first buttons. */
function item(slug: LookId, kinds: Translate[], categories: Translate[]): GalleryItem | null {
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
    focal: photo.focal,
    logo: page.profile.logo?.src ?? null,
    hero: theme.layout.hero,
    links,
    keywords: keywords(look.kind, look.category, kinds, categories),
    signup: `/signup?kind=${look.kind}&look=${slug}`,
  };
}

/**
 * A card for a real person's page (concept page or prepared preview), in the visitor's language
 * when the page exists in it.
 */
function personItem(slug: string, locale: string, kinds: Translate[], categories: Translate[]): GalleryItem | null {
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
    focal: photo.focal,
    logo: page.profile.logo?.src ?? null,
    hero: theme.layout.hero,
    links: page.blocks.flatMap((block) => (block.type === "link" ? [block.title] : [])),
    keywords: keywords(look.kind, "people", kinds, categories),
    signup: `/signup?kind=${look.kind}&look=${slug}`,
    badge: preview.concept ? "concept" : "preview",
  };
}

/**
 * The visitor's own language every other card, without hiding the others: an Arabic visitor no
 * longer meets a German and an English page first. The order within each group stays.
 */
function visitorFirst(list: GalleryItem[], locale: string): GalleryItem[] {
  const mine = list.filter((entry) => entry.locale === locale);
  const rest = list.filter((entry) => entry.locale !== locale);
  const out: GalleryItem[] = [];
  while (mine.length > 0 || rest.length > 0) {
    const a = mine.shift();
    if (a) out.push(a);
    const b = rest.shift();
    if (b) out.push(b);
  }
  return out;
}

/**
 * /templates: the example gallery. Fictional people and businesses, each page in its own look, then
 * pages of well-known people (labelled concepts and previews, at the founder's request).
 */
export default async function TemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("examples");
  const codes = ["de", "en", "ar"] as const;
  const kinds = await Promise.all(codes.map((code) => getTranslations({ locale: code, namespace: "app.welcome.kinds" })));
  const categories = await Promise.all(codes.map((code) => getTranslations({ locale: code, namespace: "examples.categories" })));
  // The most vivid pages first, then the rest; the visitor's own language every other card.
  const order = [...GALLERY_LEAD, ...(Object.keys(LOOKS) as LookId[]).filter((slug) => !GALLERY_LEAD.includes(slug))];
  const examples = visitorFirst(
    order.map((slug) => item(slug, kinds, categories)).filter((entry): entry is GalleryItem => entry !== null),
    locale,
  );
  const people = [...PEOPLE_ORDER, ...Object.keys(PEOPLE_LOOKS).filter((slug) => !PEOPLE_ORDER.includes(slug))]
    .map((slug) => personItem(slug, locale, kinds, categories))
    .filter((entry): entry is GalleryItem => entry !== null);
  const items = [...examples, ...people];

  const stats = [
    { value: TEMPLATE_IDS.length, label: t("stats.designs", { count: TEMPLATE_IDS.length }) },
    { value: 3, label: t("stats.languages", { count: 3 }) },
  ];

  return (
    <>
      <MarketingHeader />
      <main id="main" className="mx-auto grid max-w-content grid-cols-1 gap-16 px-5 pt-12 md:px-10">
        <ExampleGallery
          items={items}
          // The same tilted wall of pages as beside the sign-in form, standing still: a full-bleed band
          // on phones, a framed panel as tall as the intro beside it on wide screens. Rendered here, on
          // the server: it ships no script.
          wall={
            <PageWall
              eager
              sizes="(min-width: 64rem) 7rem, 24vw"
              className="-mx-5 aspect-video border-y border-line md:-mx-10 lg:mx-0 lg:aspect-auto lg:min-h-(--container-sidebar) lg:rounded-xl lg:border"
            />
          }
          intro={
            <header className="mk-settle grid content-center gap-6">
              <p className="inline-flex items-center gap-2 justify-self-start rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-semibold text-fg-secondary">
                <span className="grid size-6 place-items-center rounded-full bg-selected text-selected-fg">
                  <Icon icon={Sparkles} size="sm" />
                </span>
                {t("eyebrow")}
              </p>
              <h1 className="text-h1 tracking-tight text-balance md:text-display lg:text-display-sm">{t("title", { count: items.length })}</h1>
              <p className="max-w-prose text-body text-pretty text-fg-secondary md:text-body-lg">{t("lead")}</p>
              {/* Phones: two equal, full-width buttons, as in an app; wider screens: side by side. */}
              <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                <Button asChild variant="primary" size="xl" className="group rounded-full font-semibold sm:h-control-lg sm:px-5">
                  <Link href="/signup">
                    {t("ctaButton")}
                    <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild variant="tinted" size="xl" className="group rounded-full font-semibold sm:h-control-lg sm:px-5">
                  <a href="#gallery">
                    {t("browse")}
                    <Icon icon={ArrowDown} size="md" className="transition-transform duration-micro group-hover:translate-y-0.5" />
                  </a>
                </Button>
              </div>
              <ul aria-label={t("stats.label")} className="flex gap-8 border-t border-line pt-5 sm:pt-6">
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

        <p className="-mt-10 flex max-w-prose items-start gap-2 text-caption text-fg-tertiary">
          <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
          {t("fictional")}
        </p>
        <section aria-labelledby="templates-cta" className="relative isolate grid gap-6 overflow-hidden rounded-xl bg-primary p-6 text-primary-fg md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-10">
          <LogoGlyph className="pointer-events-none absolute -end-10 -top-12 h-auto w-1/3 rotate-12 text-primary-hover md:w-1/6 rtl:-rotate-12" />
          <div className="relative grid gap-2">
            <h2 id="templates-cta" className="text-h2 tracking-tight text-balance">
              {t("ctaTitle")}
            </h2>
            <p className="text-body-lg text-pretty">{t("ctaLead")}</p>
          </div>
          <Link
            href="/signup"
            className="relative inline-flex h-control-lg items-center justify-center gap-2 justify-self-start rounded-full bg-primary-fg px-6 text-body font-semibold text-primary transition-transform duration-micro hover:-translate-y-0.5 focus-visible:focus-ring active:scale-pressed md:justify-self-end"
          >
            {t("ctaButton")}
            <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
          </Link>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
