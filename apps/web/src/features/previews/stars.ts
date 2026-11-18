import type { Block, BlockOf, Page, Platform } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

/**
 * Concept pages for well-known people: how their Linkyo page could look, from public, verified facts.
 * Every link goes to their official channels or to reputable sources; videos are their official
 * uploads (they play only after a tap, in YouTube's privacy mode). Photos are free-licensed
 * (Wikimedia Commons, credited on the page) or their own channel avatar. Labelled as a concept,
 * never listed in the gallery, never indexed.
 */
type Locale = "de" | "en" | "ar";
type Text = Record<Locale, string>;

export interface Star {
  slug: string;
  name: Text;
  tagline: Text;
  bio: Text;
  location?: Text | undefined;
  stats: { value: string; label: Text }[];
  socials: { platform: Platform; url: string }[];
  website?: string | undefined;
  videos: { id: string; title: string }[];
  music?: { title: string; kind: "single" | "album" | "ep"; links: { platform: Platform; url: string }[] }[] | undefined;
  works?: { title: Text; year: number; url: string }[] | undefined;
  articles: { title: string; url: string; source: string; language: Locale }[];
  /** A sample media key ("sample:star-…") or the official channel avatar URL. */
  photo: string;
  credit?: string | undefined;
  theme: CreatorThemeConfig;
}

const HEADINGS: Record<"videos" | "music" | "works" | "press" | "official", Text> = {
  videos: { de: "Videos", en: "Videos", ar: "فيديوهات" },
  music: { de: "Musik", en: "Music", ar: "موسيقى" },
  works: { de: "Ausgewählte Werke", en: "Selected work", ar: "أعمال مختارة" },
  press: { de: "Presse & Artikel", en: "Press & articles", ar: "صحافة ومقالات" },
  official: { de: "Offizielle Website", en: "Official website", ar: "الموقع الرسمي" },
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function starPage(star: Star, locale: Locale): Page {
  let count = 0;
  const base = (type: string) => ({ id: `${type}-${++count}`, visible: true, highlight: false });
  const image = { src: star.photo, alt: star.name[locale] };
  const thumb = (id: string) => ({ src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: "" });
  const header = (title: string): BlockOf<"header"> => ({ ...base("header"), type: "header", title });
  const link = (title: string, url: string, extra: Partial<BlockOf<"link">> = {}): BlockOf<"link"> => ({ ...base("link"), type: "link", title: clip(title, 120), url, ...extra });

  const blocks: Block[] = [];
  if (star.socials.length) blocks.push({ ...base("socials"), type: "socials", items: star.socials.slice(0, 12) });
  if (star.website) blocks.push(link(HEADINGS.official[locale], star.website, { highlight: true }));

  for (const release of star.music ?? []) {
    blocks.push({
      ...base("music"),
      type: "music",
      title: clip(release.title, 120),
      artist: clip(star.name[locale], 120),
      kind: release.kind,
      cover: star.videos[0] ? thumb(star.videos[0].id) : image,
      links: release.links.slice(0, 10),
    });
  }

  if (star.videos.length) {
    blocks.push(header(HEADINGS.videos[locale]));
    for (const video of star.videos.slice(0, 3)) {
      blocks.push({ ...base("video"), type: "video", title: clip(video.title, 120), provider: "youtube", url: `https://www.youtube.com/watch?v=${video.id}`, poster: thumb(video.id) });
    }
  }

  if (star.works?.length) {
    blocks.push(header(HEADINGS.works[locale]));
    for (const work of star.works.slice(0, 4)) blocks.push(link(`${work.title[locale]} (${work.year})`, work.url));
  }

  // Articles in the page's language first, then the rest.
  const articles = [...star.articles].sort((a, b) => Number(b.language === locale) - Number(a.language === locale)).slice(0, 4);
  if (articles.length) {
    blocks.push(header(HEADINGS.press[locale]));
    for (const article of articles) blocks.push(link(article.title, article.url, article.source.length <= 16 ? { badge: article.source } : {}));
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
