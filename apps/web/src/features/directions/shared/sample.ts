import type { Block, Page } from "@linkyo/blocks";

/**
 * Sample creator pages for the Phase 0 directions. Fictional creators; real block schemas
 * (validated in sample.test.ts) so the same data later drives the production renderer.
 */
const milaBlocks = (t: (key: string) => string): Block[] => [
  {
    id: "socials",
    type: "socials",
    visible: true,
    highlight: false,
    items: [
      { platform: "instagram", url: "https://instagram.com/milaaurel" },
      { platform: "tiktok", url: "https://tiktok.com/@milaaurel" },
      { platform: "youtube", url: "https://youtube.com/@milaaurel" },
      { platform: "spotify", url: "https://open.spotify.com/artist/milaaurel" },
      { platform: "soundcloud", url: "https://soundcloud.com/milaaurel" },
      { platform: "email", url: "mailto:booking@milaaurel.com" },
    ],
  },
  {
    id: "release",
    type: "music",
    visible: true,
    highlight: true,
    title: "Nachtstrom",
    artist: "Mila Aurel",
    kind: "ep",
    releaseDate: "2026-11-07",
    cover: { src: "sample:cover-nachtstrom", alt: t("coverAlt") },
    links: [
      { platform: "spotify", url: "https://open.spotify.com/album/nachtstrom" },
      { platform: "applemusic", url: "https://music.apple.com/album/nachtstrom" },
      { platform: "youtubemusic", url: "https://music.youtube.com/playlist?list=nachtstrom" },
      { platform: "soundcloud", url: "https://soundcloud.com/milaaurel/sets/nachtstrom" },
      { platform: "bandcamp", url: "https://milaaurel.bandcamp.com/album/nachtstrom" },
      { platform: "deezer", url: "https://deezer.com/album/nachtstrom" },
    ],
  },
  {
    id: "live",
    type: "live",
    visible: true,
    highlight: false,
    platform: "twitch",
    channel: "milaaurel",
    url: "https://twitch.tv/milaaurel",
    isLive: true,
    title: t("liveTitle"),
    viewers: 1284,
  },
  {
    id: "booking",
    type: "link",
    visible: true,
    highlight: false,
    title: t("booking"),
    url: "mailto:booking@milaaurel.com",
  },
  {
    id: "tour",
    type: "events",
    visible: true,
    highlight: false,
    title: t("tour"),
    items: [
      { date: "2026-12-05", city: "Berlin", venue: "Halle am Fluss", url: "https://tickets.example.com/berlin", status: "onsale", image: { src: "sample:event-berlin", alt: "" } },
      { date: "2026-12-12", city: "Hamburg", venue: "Studio Nord", url: "https://tickets.example.com/hamburg", status: "few", image: { src: "sample:event-hamburg", alt: "" } },
      { date: "2027-01-16", city: "Leipzig", venue: "Lichthof", url: "https://tickets.example.com/leipzig", status: "soldout" },
      { date: "2027-02-06", city: t("vienna"), venue: "Werk 9", url: "https://tickets.example.com/wien", status: "onsale" },
    ],
  },
  {
    id: "video",
    type: "video",
    visible: true,
    highlight: false,
    title: t("videoTitle"),
    provider: "youtube",
    url: "https://www.youtube.com/watch?v=nachtstrom-live",
    poster: { src: "sample:video-live", alt: "" },
    duration: 222,
  },
  {
    id: "shorts",
    type: "shorts",
    visible: true,
    highlight: false,
    title: t("shorts"),
    items: [
      { title: t("short1"), url: "https://youtube.com/shorts/1", poster: { src: "sample:short-1", alt: "" }, views: 120400 },
      { title: t("short2"), url: "https://youtube.com/shorts/2", poster: { src: "sample:short-2", alt: "" }, views: 86100 },
      { title: t("short3"), url: "https://youtube.com/shorts/3", poster: { src: "sample:short-3", alt: "" }, views: 41800 },
    ],
  },
  {
    id: "pack",
    type: "link",
    visible: true,
    highlight: false,
    title: t("samplePack"),
    url: "https://milaaurel.com/samples",
    badge: t("new"),
  },
  {
    id: "vinyl",
    type: "product",
    visible: true,
    highlight: false,
    title: t("vinyl"),
    price: 24,
    currency: "EUR",
    url: "https://shop.milaaurel.com/products/nachtstrom-vinyl",
    image: { src: "sample:merch-vinyl", alt: t("vinylAlt") },
  },
  {
    id: "story",
    type: "card",
    visible: true,
    highlight: false,
    title: t("storyTitle"),
    description: t("storyBody"),
    url: "https://milaaurel.com/nachtstrom",
    image: { src: "sample:mila-wide", alt: "" },
  },
  {
    id: "newsletter",
    type: "newsletter",
    visible: true,
    highlight: false,
    title: t("newsletterTitle"),
    description: t("newsletterBody"),
  },
];

const nourBlocks = (t: (key: string) => string): Block[] => {
  const blocks = milaBlocks(t);
  return blocks.map((block) => {
    if (block.type === "music") return { ...block, title: "ضوء", artist: "نور حداد", kind: "single", cover: { src: "sample:cover-daw", alt: t("coverAlt") } };
    if (block.type === "events") {
      return {
        ...block,
        items: [
          { date: "2026-12-05", city: "بيروت", venue: "مسرح المدينة", url: "https://tickets.example.com/beirut", status: "onsale", image: { src: "sample:event-berlin", alt: "" } },
          { date: "2026-12-12", city: "عمّان", venue: "قاعة الصوت", url: "https://tickets.example.com/amman", status: "few", image: { src: "sample:event-hamburg", alt: "" } },
          { date: "2027-01-16", city: "دبي", venue: "ساحة الفن", url: "https://tickets.example.com/dubai", status: "soldout" },
          { date: "2027-02-06", city: "برلين", venue: "Werk 9", url: "https://tickets.example.com/berlin", status: "onsale" },
        ],
      };
    }
    if (block.type === "socials") return { ...block, items: block.items.map((item) => ({ ...item, url: item.url.replace("milaaurel", "nourhaddad") })) };
    if (block.type === "live") return { ...block, channel: "nourhaddad", url: "https://twitch.tv/nourhaddad" };
    return block;
  });
};

export function samplePage(locale: string, t: (key: string) => string): Page {
  if (locale === "ar") {
    return {
      profile: {
        username: "nourhaddad",
        displayName: "نور حداد",
        bio: t("bio"),
        location: "بيروت",
        avatar: { src: "sample:nour-avatar", alt: "نور حداد" },
        hero: { src: "sample:nour-hero", alt: "" },
        verified: true,
        locale: "ar",
      },
      blocks: nourBlocks(t),
    };
  }
  return {
    profile: {
      username: "milaaurel",
      displayName: "Mila Aurel",
      bio: t("bio"),
      location: "Berlin",
      avatar: { src: "sample:mila-avatar", alt: "Mila Aurel" },
      hero: { src: "sample:mila-hero", alt: "" },
      verified: true,
      locale: locale === "de" ? "de" : "en",
    },
    blocks: milaBlocks(t),
  };
}
