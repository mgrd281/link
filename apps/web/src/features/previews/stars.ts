import type { Block, BlockOf, Page, Platform } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

/**
 * Concept pages for well-known people: how their Linkyo page could look, from public, verified facts.
 * Every link goes to their official channels or to reputable sources; videos are official uploads or
 * the rights holder's highlights (they play only after a tap, in YouTube's privacy mode). Photos are
 * free-licensed (Wikimedia Commons, credited on the page) or their own video thumbnail. Labelled as a
 * concept, never listed in the gallery, never indexed.
 *
 * Each page speaks one language: every caption is written per language, and articles appear only on
 * the page in their own language (a German page never lists an Arabic article, and the other way round).
 */
export type StarLocale = "de" | "en" | "ar";
type Text = Record<StarLocale, string>;
/** A text per language, or one string that reads the same everywhere (a name, a song title). */
type Localized = Text | string;

export interface Star {
  slug: string;
  name: Text;
  tagline: Text;
  bio: Text;
  location?: Text | undefined;
  stats: { value: string; label: Text }[];
  socials: { platform: Platform; url: string }[];
  website?: string | undefined;
  videos: { id: string; title: Localized }[];
  music?: { title: Localized; kind: "single" | "album" | "ep"; links: { platform: Platform; url: string }[] }[] | undefined;
  /** One big story card (e.g. a farewell), its link may differ per language. */
  featured?: { title: Text; description: Text; url: Localized; image: string; alt: Text } | undefined;
  /** Clubs, teams or companies: picture, name, years and what happened there. */
  career?: { title: Text; description: Text; url: string; image: string; alt: Text }[] | undefined;
  gallery?: { image: string; alt: Text }[] | undefined;
  works?: { title: Text; year: number; url: string }[] | undefined;
  /** Shown only on the page in the article's own language. */
  articles: { title: string; url: string; source: string; language: StarLocale }[];
  /** A sample media key ("sample:star-…"), the person's own video thumbnail, or NO_IMAGE. */
  photo: string;
  credit?: string | undefined;
  theme: CreatorThemeConfig;
}

const HEADINGS: Record<"videos" | "music" | "career" | "moments" | "works" | "press" | "official", Text> = {
  videos: { de: "Videos", en: "Videos", ar: "فيديوهات" },
  music: { de: "Musik", en: "Music", ar: "موسيقى" },
  career: { de: "Karriere", en: "Career", ar: "المسيرة" },
  moments: { de: "Momente", en: "Moments", ar: "لحظات" },
  works: { de: "Ausgewählte Werke", en: "Selected work", ar: "أعمال مختارة" },
  press: { de: "Presse & Artikel", en: "Press & articles", ar: "صحافة ومقالات" },
  official: { de: "Offizielle Website", en: "Official website", ar: "الموقع الرسمي" },
};

const MAX_VIDEOS = 4;
const MAX_ARTICLES = 4;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const pick = (text: Localized, locale: StarLocale) => (typeof text === "string" ? text : text[locale]);

export function starPage(star: Star, locale: StarLocale): Page {
  let count = 0;
  const base = (type: string) => ({ id: `${type}-${++count}`, visible: true, highlight: false });
  const image = { src: star.photo, alt: star.name[locale] };
  const thumb = (id: string) => ({ src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: "" });
  const header = (title: string): BlockOf<"header"> => ({ ...base("header"), type: "header", title });
  const link = (title: string, url: string, extra: Partial<BlockOf<"link">> = {}): BlockOf<"link"> => ({ ...base("link"), type: "link", title: clip(title, 120), url, ...extra });
  const card = (title: string, description: string, url: string, picture: { src: string; alt: string }, highlight = false): BlockOf<"card"> => ({
    ...base("card"),
    highlight,
    type: "card",
    title: clip(title, 120),
    description: clip(description, 240),
    url,
    image: picture,
  });

  const blocks: Block[] = [];
  if (star.socials.length) blocks.push({ ...base("socials"), type: "socials", items: star.socials.slice(0, 12) });
  if (star.website) blocks.push(link(HEADINGS.official[locale], star.website, { highlight: true }));

  for (const release of star.music ?? []) {
    blocks.push({
      ...base("music"),
      type: "music",
      title: clip(pick(release.title, locale), 120),
      artist: clip(star.name[locale], 120),
      kind: release.kind,
      cover: star.videos[0] ? thumb(star.videos[0].id) : image,
      links: release.links.slice(0, 10),
    });
  }

  if (star.videos.length) {
    blocks.push(header(HEADINGS.videos[locale]));
    for (const video of star.videos.slice(0, MAX_VIDEOS)) {
      blocks.push({ ...base("video"), type: "video", title: clip(pick(video.title, locale), 120), provider: "youtube", url: `https://www.youtube.com/watch?v=${video.id}`, poster: thumb(video.id) });
    }
  }

  if (star.featured || star.career?.length) {
    blocks.push(header(HEADINGS.career[locale]));
    const story = star.featured;
    if (story) blocks.push(card(story.title[locale], story.description[locale], pick(story.url, locale), { src: story.image, alt: story.alt[locale] }, true));
    for (const step of star.career ?? []) blocks.push(card(step.title[locale], step.description[locale], step.url, { src: step.image, alt: step.alt[locale] }));
  }

  if (star.gallery?.length) {
    blocks.push({ ...base("gallery"), type: "gallery", title: HEADINGS.moments[locale], images: star.gallery.slice(0, 24).map((photo) => ({ src: photo.image, alt: photo.alt[locale] })) });
  }

  if (star.works?.length) {
    blocks.push(header(HEADINGS.works[locale]));
    for (const work of star.works.slice(0, 4)) blocks.push(link(`${work.title[locale]} (${work.year})`, work.url));
  }

  // Only articles in the page's language: the address under each title already names the source.
  // The official website already has its own button; it is not repeated as an article.
  const same = (a: string, b: string | undefined) => a.replace(/\/$/, "") === b?.replace(/\/$/, "");
  const articles = star.articles.filter((article) => article.language === locale && !same(article.url, star.website)).slice(0, MAX_ARTICLES);
  if (articles.length) {
    blocks.push(header(HEADINGS.press[locale]));
    for (const article of articles) blocks.push(link(article.title, article.url));
  }

  return {
    profile: {
      username: star.slug,
      displayName: clip(star.name[locale], 60),
      tagline: clip(star.tagline[locale], 80),
      bio: clip(star.bio[locale], 160),
      ...(star.location ? { location: clip(star.location[locale], 60) } : {}),
      avatar: image,
      hero: image,
      ...(star.stats.length ? { stats: star.stats.slice(0, 3).map((stat) => ({ value: clip(stat.value, 12), label: clip(stat.label[locale], 24) })) } : {}),
      verified: false,
      locale,
    },
    blocks,
  };
}
