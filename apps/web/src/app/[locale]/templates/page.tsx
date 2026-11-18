import { resolveCreatorTheme } from "@linkyo/tokens/creator";
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

  return (
    <>
      <MarketingHeader />
      <main id="main" className="mx-auto grid max-w-content grid-cols-1 gap-10 px-5 pt-12 pb-16 md:px-10 md:pt-20">
        <ExampleGallery
          items={items}
          featured={["rafael-duarte", "adam-nour", "baeckerei-sonnenkorn"]}
          intro={
            <header className="grid max-w-prose gap-5">
              <p className="inline-flex items-center gap-2 justify-self-start rounded-full bg-selected px-3 py-1 text-small font-semibold text-selected-fg">{t("eyebrow")}</p>
              <h1 className="text-h1 tracking-tight text-balance md:text-display">{t("title")}</h1>
              <p className="text-body-lg text-pretty text-fg-secondary">{t("lead")}</p>
              <p className="text-small text-fg-tertiary">{t("count", { count: items.length })}</p>
            </header>
          }
        />
        <p className="max-w-prose text-caption text-fg-tertiary">{t("fictional")}</p>
        <section className="grid justify-items-start gap-4 rounded-xl border border-line bg-surface p-6 shadow-e1 md:flex md:items-center md:justify-between">
          <p className="text-body-lg font-semibold text-balance">{t("cta")}</p>
          <Link
            href="/signup"
            className="inline-flex h-control-lg shrink-0 items-center rounded-full bg-primary px-6 text-body font-semibold text-primary-fg shadow-e1 hover:bg-primary-hover focus-visible:focus-ring"
          >
            {t("ctaButton")}
          </Link>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
