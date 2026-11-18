import { NO_IMAGE, type Block, type BlockOf, type LinkIcon, type Page, type Platform } from "@linkyo/blocks";

/**
 * Small helpers to write example pages compactly. Every link goes to example.com (a reserved
 * address): the people are fictional, so nothing may point to a real account, shop or article.
 */
export interface Persona {
  name: string;
  tagline?: string;
  bio: string;
  location?: string;
  /** Key of a picture in the sample media (e.g. "ex-bakery"); none = monogram. */
  photo?: string;
  /** Where the photo should stay in view when it is cropped (0–1, 0–1). */
  focal?: [number, number];
  logo?: string;
  stats?: [string, string][];
  /** A moving picture (a looping clip in /media/motion); the photo should be its first frame. */
  motion?: string;
}

interface Image {
  src: string;
  alt: string;
  focal?: [number, number];
}
interface LinkOptions {
  highlight?: boolean;
  badge?: string;
  affiliate?: boolean;
  icon?: LinkIcon;
  /** Second line under the title ("20 min · free"); the address is shown otherwise. */
  subtitle?: string;
}

/**
 * Example links all point to example.com, so the page cannot read an icon from the address. The
 * path names what a link is for (shop, booking, route …); this picks the icon a creator would choose.
 */
const PATH_ICONS: [RegExp, LinkIcon][] = [
  [/shop|store|storefront|marktplatz|kollektion|collection/, "shop"],
  [/termin|booking|book-|buchen|erstgespraech|erstberatung|reserv|call|sprechstunde|appointment/, "calendar"],
  [/route|directions|anfahrt|standort|map/, "map"],
  [/menu|speisekarte|karte/, "book"],
  [/ticket|event|tour|konzert/, "ticket"],
  [/podcast|episode|folge/, "mic"],
  [/video|youtube|reel|clip/, "play"],
  [/blog|artikel|article|ratgeber|news|case|guide/, "newspaper"],
  [/cv|lebenslauf|resume/, "file"],
  [/code|deal|rabatt|sale|angebot|offer/, "percent"],
  [/jobs|karriere|career|team/, "users"],
  [/whatsapp|chat|kontakt|contact/, "chat"],
  [/kurs|course|lesson|academy/, "graduation"],
  [/spende|donate|mitglied|member/, "heart"],
  [/portfolio|work|arbeiten|projekte|projects/, "briefcase"],
  [/music|musik|spotify|album|single/, "music"],
  [/versand|shipping|delivery/, "truck"],
  [/gutschein|gift|geschenk/, "gift"],
];
const iconForPath = (path: string): LinkIcon | undefined => PATH_ICONS.find(([pattern]) => pattern.test(path))?.[1];

/** Optional link fields, only when set (the schema keeps unset fields absent). */
const linkExtras = (options: LinkOptions, path?: string) => {
  const icon = options.icon ?? (path ? iconForPath(path) : undefined);
  return {
    ...(options.badge ? { badge: options.badge } : {}),
    ...(options.affiliate ? { affiliate: true } : {}),
    ...(icon ? { icon } : {}),
    ...(options.subtitle ? { subtitle: options.subtitle } : {}),
  };
};

export function makeHelpers(slug: string, persona: Persona) {
  let count = 0;
  const id = (type: string) => `${type}-${++count}`;
  const base = (type: string) => ({ id: id(type), visible: true, highlight: false });
  const url = (path: string) => `https://example.com/${slug}/${path}`;
  const image = (key?: string, focal?: [number, number]): Image =>
    key ? { src: `sample:${key}`, alt: "", ...(focal ? { focal } : {}) } : { src: NO_IMAGE, alt: "" };
  const cover = image(persona.photo, persona.focal);

  return {
    url,
    image,
    socials: (...platforms: Platform[]): BlockOf<"socials"> => ({
      ...base("socials"),
      type: "socials",
      items: platforms.map((platform) => ({ platform, url: platform === "email" ? `mailto:hello@example.com` : url(platform) })),
    }),
    header: (title: string): BlockOf<"header"> => ({ ...base("header"), type: "header", title }),
    text: (text: string): BlockOf<"text"> => ({ ...base("text"), type: "text", text }),
    link: (title: string, path: string, options: LinkOptions = {}): BlockOf<"link"> => ({
      ...base("link"),
      type: "link",
      title,
      url: url(path),
      highlight: options.highlight ?? false,
      ...linkExtras(options, path),
    }),
    /** A card with a picture: articles, offers, featured work. */
    card: (title: string, description: string, path: string, key: string, options: { affiliate?: boolean } = {}): BlockOf<"card"> => ({
      ...base("card"),
      type: "card",
      title,
      description,
      url: url(path),
      image: image(key),
      ...(options.affiliate ? { affiliate: true } : {}),
    }),
    mail: (title: string, box: string, options: LinkOptions = {}): BlockOf<"link"> => ({
      ...base("link"),
      type: "link",
      title,
      url: `mailto:${box}@example.com`,
      highlight: options.highlight ?? false,
      ...linkExtras(options),
    }),
    /** A phone number that cannot be dialled (German numbers never start with 0 after the area code). */
    call: (title: string, options: LinkOptions = {}): BlockOf<"link"> => ({
      ...base("link"),
      type: "link",
      title,
      url: "tel:+49300000000",
      highlight: options.highlight ?? false,
      ...linkExtras(options),
    }),
    video: (title: string, provider: "youtube" | "tiktok" | "instagram" | "vimeo", path: string, key?: string, duration?: number): BlockOf<"video"> => ({
      ...base("video"),
      type: "video",
      title,
      provider,
      url: url(path),
      poster: key ? image(key) : cover,
      ...(duration ? { duration } : {}),
    }),
    music: (title: string, artist: string, kind: "single" | "ep" | "album", platforms: Platform[], releaseDate?: string): BlockOf<"music"> => ({
      ...base("music"),
      type: "music",
      title,
      artist,
      kind,
      cover,
      ...(releaseDate ? { releaseDate } : {}),
      links: platforms.map((platform) => ({ platform, url: url(`music/${platform}`) })),
    }),
    /** A product tile; affiliate products carry the ad label, prices default to euros. */
    product: (
      title: string,
      price: number,
      path: string,
      key?: string,
      options: { focal?: [number, number]; affiliate?: boolean; currency?: BlockOf<"product">["currency"] } = {},
    ): BlockOf<"product"> => ({
      ...base("product"),
      type: "product",
      title,
      price,
      currency: options.currency ?? "EUR",
      url: url(path),
      image: key ? image(key, options.focal) : cover,
      ...(options.affiliate ? { affiliate: true } : {}),
    }),
    events: (
      title: string,
      items: { date: string; time?: string; name: string; city: string; venue: string; status?: "onsale" | "few" | "soldout"; image?: string }[],
    ): BlockOf<"events"> => ({
      ...base("events"),
      type: "events",
      title,
      items: items.map(({ image: key, ...item }, i) => ({ ...item, url: url(`event-${i + 1}`), status: item.status ?? "onsale", ...(key ? { image: image(key) } : {}) })),
    }),
    newsletter: (title: string, description?: string): BlockOf<"newsletter"> => ({ ...base("newsletter"), type: "newsletter", title, ...(description ? { description } : {}) }),
    live: (platform: "twitch" | "youtube" | "tiktok" | "kick" | "instagram", channel: string, title?: string): BlockOf<"live"> => ({
      ...base("live"),
      type: "live",
      platform,
      channel,
      url: url(`live-${platform}`),
      isLive: false,
      ...(title ? { title } : {}),
    }),
    gallery: (title: string, keys: string[]): BlockOf<"gallery"> => ({ ...base("gallery"), type: "gallery", title, images: keys.map((key) => image(key)) }),
  };
}

export type Helpers = ReturnType<typeof makeHelpers>;

export function examplePage(slug: string, locale: Page["profile"]["locale"], persona: Persona, blocks: (h: Helpers) => Block[]): Page {
  const h = makeHelpers(slug, persona);
  return {
    profile: {
      username: slug,
      displayName: persona.name,
      bio: persona.bio,
      ...(persona.tagline ? { tagline: persona.tagline } : {}),
      ...(persona.location ? { location: persona.location } : {}),
      avatar: { ...h.image(persona.photo, persona.focal), alt: persona.name },
      ...(persona.photo ? { hero: { ...h.image(persona.photo, persona.focal), alt: persona.name } } : {}),
      ...(persona.logo ? { logo: { ...h.image(persona.logo), alt: persona.name } } : {}),
      ...(persona.motion ? { motion: { src: `sample:motion-${persona.motion}` } } : {}),
      ...(persona.stats ? { stats: persona.stats.map(([value, label]) => ({ value, label })) } : {}),
      verified: false,
      locale,
    },
    blocks: blocks(h),
  };
}
