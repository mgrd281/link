import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { getTranslations } from "next-intl/server";

import { PREVIEWS } from "@/features/previews/registry";

import { EXAMPLES } from "./catalog";
import type { GalleryItem } from "./gallery-card";
import { GALLERY_LEAD, LOOKS, PEOPLE_LOOKS, PEOPLE_ORDER, type LookId } from "./looks";

/*
 * The cards of the /templates gallery, prepared on the server. The team console's "Vorlagen" screen
 * shows the same cards, so both read them from here.
 */

type Translate = (key: string) => string;

/**
 * Words a visitor may search for, in all three languages: the kind of page ("Entwickler:in",
 * "lawyer", "مصمّم") and the category. Pages are written in their own language, so without these an
 * English visitor searching "lawyer" would not find the German lawyer's page.
 */
function keywords(kind: string, category: string, kinds: Translate[], categories: Translate[]): string {
  return [
    ...(kind === "other" ? [] : kinds.map((k) => k(`${kind}.label`))),
    ...categories.map((k) => k(category)),
  ].join(" ");
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
function personItem(
  slug: string,
  locale: string,
  kinds: Translate[],
  categories: Translate[],
): GalleryItem | null {
  const preview = PREVIEWS[slug];
  const look = PEOPLE_LOOKS[slug];
  if (!preview || !look) return null;
  const pageLocale = (locale in preview.pages ? locale : Object.keys(preview.pages)[0]) as
    "de" | "en" | "ar" | undefined;
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
export function visitorFirst(list: GalleryItem[], locale: string): GalleryItem[] {
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

/** Every example page (most vivid first) and every page of a well-known person, as gallery cards. */
export async function galleryItems(
  locale: string,
): Promise<{ examples: GalleryItem[]; people: GalleryItem[] }> {
  const codes = ["de", "en", "ar"] as const;
  const kinds = await Promise.all(
    codes.map((code) => getTranslations({ locale: code, namespace: "app.welcome.kinds" })),
  );
  const categories = await Promise.all(
    codes.map((code) => getTranslations({ locale: code, namespace: "examples.categories" })),
  );
  const order = [
    ...GALLERY_LEAD,
    ...(Object.keys(LOOKS) as LookId[]).filter((slug) => !GALLERY_LEAD.includes(slug)),
  ];
  const examples = order
    .map((slug) => item(slug, kinds, categories))
    .filter((entry): entry is GalleryItem => entry !== null);
  const people = [
    ...PEOPLE_ORDER,
    ...Object.keys(PEOPLE_LOOKS).filter((slug) => !PEOPLE_ORDER.includes(slug)),
  ]
    .map((slug) => personItem(slug, locale, kinds, categories))
    .filter((entry): entry is GalleryItem => entry !== null);
  return { examples, people };
}
