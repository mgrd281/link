import type { Block, BlockOf, BlockType, Page } from "@linkyo/blocks";

type Translate = (key: string) => string;

const base = { visible: true, highlight: false } as const;
const header = (id: string, title: string): BlockOf<"header"> => ({ ...base, id, type: "header", title });

/**
 * The Poster sample: the same creator as the other directions, arranged in titled sections and
 * extended so every Poster feature shows: named shows across months (month tabs), a run of mixes
 * (two-row rail), partner tiles, a labelled affiliate product and a logo for the Marquee template.
 * Fictional creators; original artwork; real block schemas (validated in sample.test.ts).
 */
export function posterSamplePage(page: Page, t: Translate): Page {
  const ar = page.profile.locale === "ar";
  const profile: Page["profile"] = {
    ...page.profile,
    tagline: t("tagline"),
    bio: t("bioShort"),
    logo: { src: ar ? "sample:nour-logo" : "sample:mila-logo", alt: t("logoAlt") },
  };
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
  const tour = take("tour", "events");
  const booking = take("booking", "link");

  // Six named dates over five months: enough for the month tabs to earn their place.
  const named = ["showRelease", "showClub", "showFestival", "showOpenAir"] as const;
  const times = ["21:00", "23:00", "19:30", "18:00"] as const;
  const shows: BlockOf<"events"> | null = tour
    ? {
        ...tour,
        title: t("sectionShows"),
        items: [
          {
            date: "2026-11-28",
            city: ar ? "بيروت" : "Berlin",
            venue: "Kiezfunk 98.4",
            url: `${site}/radio`,
            status: "onsale",
            name: t("showRadio"),
            time: "20:00",
          },
          ...tour.items.map((item, i) => ({ ...item, name: t(named[i] ?? "showFinale"), time: times[i] ?? "20:00" })),
          {
            date: "2027-03-13",
            city: ar ? "بيروت" : "Berlin",
            venue: ar ? "مسرح المدينة" : "Halle am Fluss",
            url: `${site}/finale`,
            status: "onsale",
            name: t("showFinale"),
            time: "20:30",
          },
        ],
      }
    : null;

  const mixes: BlockOf<"card">[] = [1, 2, 3, 4].map((n) => ({
    ...base,
    id: `mix-${n}`,
    type: "card",
    title: `${t("mixTitle")} ${String(n).padStart(2, "0")}`,
    description: t("mixDesc"),
    url: `https://soundcloud.com/${profile.username}/late-night-selects-${n}`,
    image: { src: `sample:mix-0${n}`, alt: t("mixAlt") },
  }));

  const blocks: (Block | null)[] = [
    take("socials", "socials"),
    take("live", "live"),
    release ? { ...release, highlight: true } : null,

    shows,

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

    header("section-mixes", t("sectionMixes")),
    ...mixes,

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

    {
      ...base,
      id: "partners",
      type: "brands",
      title: t("sectionPartners"),
      columns: 3,
      items: [
        { name: "Nordlicht Audio", logo: { src: "sample:partner-nordlicht", alt: "" }, url: "https://nordlicht-audio.example.com" },
        { name: "Kiezfunk 98.4", logo: { src: "sample:partner-kiezfunk", alt: "" }, url: "https://kiezfunk.example.com" },
        { name: "Werk Neun", logo: { src: "sample:partner-werk9", alt: "" }, url: "https://werk9.example.com" },
      ],
    },

    header("section-contact", t("sectionContact")),
    booking ? { ...booking, thumbnail: { src: ar ? "sample:nour-avatar" : "sample:mila-avatar", alt: "" } } : null,
    {
      ...base,
      id: "gear",
      type: "card",
      title: t("gear"),
      description: "nordlicht-audio.example.com",
      url: "https://nordlicht-audio.example.com/headphones?ref=milaaurel",
      image: { src: "sample:gear-headphones", alt: t("gearAlt") },
      affiliate: true,
    },
    take("pack", "link"),
    story ? { ...story, highlight: false } : null,
    { ...base, id: "website", type: "link", title: t("website"), url: site },
    take("newsletter", "newsletter"),
  ];

  return { profile, blocks: blocks.filter((block): block is Block => block !== null) };
}
