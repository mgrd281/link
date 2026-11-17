import type { Block, BlockOf, BlockType, Page } from "@linkyo/blocks";

type Translate = (key: string) => string;

const base = { visible: true, highlight: false } as const;
const header = (id: string, title: string): BlockOf<"header"> => ({ ...base, id, type: "header", title });

/**
 * The Poster sample: the same creator and content as the other directions, arranged in titled
 * sections, plus a second release, a playlist, two more videos, a second product and the website,
 * so every section shows its real rhythm. Fictional creators; real block schemas.
 */
export function posterSamplePage(page: Page, t: Translate): Page {
  const { profile } = page;
  const ar = profile.locale === "ar";
  const site = `https://${profile.username}.com`;
  const take = <T extends BlockType>(id: string, type: T): BlockOf<T> | null => {
    const block = page.blocks.find((candidate) => candidate.id === id);
    return block?.type === type ? (block as BlockOf<T>) : null;
  };
  const links = (slug: string): BlockOf<"music">["links"] => [
    { platform: "spotify", url: `https://open.spotify.com/album/${slug}` },
    { platform: "applemusic", url: `https://music.apple.com/album/${slug}` },
    { platform: "youtubemusic", url: `https://music.youtube.com/playlist?list=${slug}` },
    { platform: "soundcloud", url: `https://soundcloud.com/${profile.username}/${slug}` },
  ];

  const release = take("release", "music");
  const story = take("story", "card");

  const blocks: (Block | null)[] = [
    take("socials", "socials"),
    take("live", "live"),
    release ? { ...release, highlight: true } : null,

    header("section-music", t("sectionMusic")),
    {
      ...base,
      id: "single-2",
      type: "music",
      title: t("single2"),
      artist: profile.displayName,
      kind: "single",
      releaseDate: "2026-06-12",
      cover: { src: ar ? "sample:cover-dune" : "sample:cover-lichtfeld", alt: t("cover2Alt") },
      links: links("single-2"),
    },
    {
      ...base,
      id: "playlist",
      type: "music",
      title: t("playlist"),
      artist: profile.displayName,
      kind: "playlist",
      cover: { src: ar ? "sample:cover-orbit" : "sample:cover-daw", alt: t("cover3Alt") },
      links: links("late-night-selects").slice(0, 3),
    },

    header("section-videos", t("sectionVideos")),
    take("video", "video"),
    {
      ...base,
      id: "video-2",
      type: "video",
      title: t("video2Title"),
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=tour-diary",
      poster: { src: "sample:event-berlin", alt: "" },
      duration: 512,
    },
    {
      ...base,
      id: "video-3",
      type: "video",
      title: t("video3Title"),
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=after-show",
      poster: { src: "sample:event-hamburg", alt: "" },
      duration: 305,
    },

    take("tour", "events"),
    take("shorts", "shorts"),

    header("section-shop", t("sectionShop")),
    take("vinyl", "product"),
    {
      ...base,
      id: "print",
      type: "product",
      title: t("posterPrint"),
      price: 35,
      currency: "EUR",
      url: `https://shop.${profile.username}.com/products/print`,
      image: { src: ar ? "sample:merch-print" : "sample:merch-poster", alt: t("posterPrintAlt") },
    },

    header("section-more", t("sectionMore")),
    take("booking", "link"),
    take("pack", "link"),
    story ? { ...story, highlight: false } : null,
    { ...base, id: "website", type: "link", title: t("website"), url: site },
    take("newsletter", "newsletter"),
  ];

  return { profile, blocks: blocks.filter((block): block is Block => block !== null) };
}
