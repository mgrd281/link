import { NO_IMAGE, type AppPricing, type AppStore, type Block, type BlockOf, type CodeLang, type ContactKind, type LinkIcon, type Page, type Platform } from "@linkyo/blocks";

import { portfolioMedia } from "./media";

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
  /**
   * The photo is the round portrait only, never a hero picture. Portfolios open with the work (or
   * with type alone): a hero picture would take the place of the first project.
   */
  portraitOnly?: boolean;
}

/** A portfolio picture by its file name ("ex-pf-ronja-06"); its size and focal point are measured (media.ts). */
export type PortfolioPicture = keyof typeof portfolioMedia extends `sample:${infer Key}` ? Key : never;

type Project = BlockOf<"project">;
type Years = NonNullable<Project["year"]>;

/** What an example project can carry beside its title and its one sentence. */
interface ProjectOptions {
  /** The address part, chosen by hand so a link to an example project never moves. */
  slug: string;
  client?: string;
  /** "Confidential client" in place of a name (then no `client`). */
  confidential?: boolean;
  role?: string;
  year?: Years;
  tags?: string[];
  /** The cover: a picture and what it shows. */
  cover?: [key: PortfolioPicture, alt: string];
  results?: [value: string, label: string][];
  story?: NonNullable<Project["story"]>;
  pictures?: { key: PortfolioPicture; alt: string; caption?: string }[];
  links?: { path: string; label?: string }[];
  /**
   * Repository facts. The owner always ends in ".example": no such account can exist on GitHub, so
   * the repository address a page derives from these facts can never lead to someone's real code.
   */
  source?: { owner: string; repo: string; stars?: number; language?: string; license?: string; install?: boolean; readAt?: string };
  code?: { text: string; lang?: CodeLang; file?: string };
}

/** Ways to reach an example person: example.com, a mailbox there, or a number that cannot be dialled. */
interface ContactOptions {
  text?: string;
  status?: string;
  statusUntil?: string;
  links?: { kind: ContactKind; label?: string; path?: string }[];
  steps?: string[];
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
  const picture = (key: PortfolioPicture, alt: string) => {
    const measured = portfolioMedia[`sample:${key}`];
    return { src: `sample:${key}`, alt, focal: measured.focal, w: measured.width, h: measured.height };
  };

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
    /** A card with a picture: articles, offers, featured work. Highlighted cards lead with a wide picture. */
    card: (title: string, description: string, path: string, key: string, options: { affiliate?: boolean; highlight?: boolean } = {}): BlockOf<"card"> => ({
      ...base("card"),
      type: "card",
      title,
      description,
      url: url(path),
      image: image(key),
      highlight: options.highlight ?? false,
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
    /** A release; its own artwork when `cover` names a picture, the persona's photo otherwise. */
    music: (
      title: string,
      artist: string,
      kind: "single" | "ep" | "album",
      platforms: Platform[],
      releaseDate?: string,
      options: { cover?: string; highlight?: boolean } = {},
    ): BlockOf<"music"> => ({
      ...base("music"),
      type: "music",
      title,
      artist,
      kind,
      cover: options.cover ? image(options.cover) : cover,
      highlight: options.highlight ?? false,
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
    /** An app from the creator's videos, with its stores (example.com too), rating and promo code. */
    app: (
      title: string,
      icon: string,
      options: {
        developer?: string;
        description?: string;
        rating?: number;
        category?: string;
        pricing?: AppPricing;
        code?: string;
        stores?: AppStore[];
        highlight?: boolean;
        affiliate?: boolean;
      } = {},
    ): BlockOf<"app"> => {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return {
        ...base("app"),
        type: "app",
        title,
        icon: image(icon),
        stores: (options.stores ?? ["appstore", "googleplay"]).map((store) => ({ store, url: url(`apps/${slug}/${store}`) })),
        ...(options.developer ? { developer: options.developer } : {}),
        ...(options.description ? { description: options.description } : {}),
        ...(options.rating !== undefined ? { rating: options.rating } : {}),
        ...(options.category ? { category: options.category } : {}),
        ...(options.pricing ? { pricing: options.pricing } : {}),
        ...(options.code ? { code: options.code } : {}),
        ...(options.highlight ? { highlight: true } : {}),
        ...(options.affiliate ? { affiliate: true } : {}),
      };
    },
    /** A portfolio picture with its measured size and focal point, and what it shows. */
    picture,
    /**
     * A project: a title, one sentence, and whatever else is filled. Links go to example.com; a
     * repository's owner ends in ".example" and its install command fetches from example.com.
     */
    project: (title: string, summary: string, options: ProjectOptions): Project => ({
      ...base("project"),
      type: "project",
      slug: options.slug,
      title,
      summary,
      ...(options.client ? { client: options.client } : {}),
      ...(options.confidential ? { confidential: true } : {}),
      ...(options.role ? { role: options.role } : {}),
      ...(options.year ? { year: options.year } : {}),
      ...(options.tags ? { tags: options.tags } : {}),
      ...(options.cover ? { cover: picture(...options.cover) } : {}),
      ...(options.results ? { results: options.results.map(([value, label]) => ({ value, label })) } : {}),
      ...(options.story ? { story: options.story } : {}),
      ...(options.pictures ? { pictures: options.pictures.map((item) => ({ image: picture(item.key, item.alt), ...(item.caption ? { caption: item.caption } : {}) })) } : {}),
      ...(options.links ? { links: options.links.map((link) => ({ url: url(link.path), ...(link.label ? { label: link.label } : {}) })) } : {}),
      ...(options.source
        ? {
            source: {
              owner: `${options.source.owner}.example`,
              repo: options.source.repo,
              ...(options.source.stars !== undefined ? { stars: options.source.stars } : {}),
              ...(options.source.language ? { language: options.source.language } : {}),
              ...(options.source.license ? { license: options.source.license } : {}),
              ...(options.source.install ? { install: `npm install ${url(`${options.source.repo}.tgz`)}` } : {}),
              ...(options.source.readAt ? { readAt: options.source.readAt } : {}),
            },
          }
        : {}),
      ...(options.code ? { code: options.code } : {}),
    }),
    /** Who the person is: text (paragraphs split at blank lines), a portrait and up to four facts. */
    about: (title: string, text: string, options: { portrait?: [key: PortfolioPicture, alt: string]; facts?: [label: string, value: string][] } = {}): BlockOf<"about"> => ({
      ...base("about"),
      type: "about",
      title,
      text,
      ...(options.portrait ? { portrait: picture(...options.portrait) } : {}),
      ...(options.facts ? { facts: options.facts.map(([label, value]) => ({ label, value })) } : {}),
    }),
    tools: (title: string, items: string[]): BlockOf<"tools"> => ({ ...base("tools"), type: "tools", title, items }),
    timeline: (title: string, items: { role: string; org?: string; years: Years; note?: string; path?: string }[]): BlockOf<"timeline"> => ({
      ...base("timeline"),
      type: "timeline",
      title,
      items: items.map(({ path, ...item }) => ({ ...item, ...(path ? { url: url(path) } : {}) })),
    }),
    /** Quotes of fictional clients (so the consent a quote needs is given); `project` ties one to a project of the page. */
    quotes: (title: string, items: { text: string; name: string; role: string; project?: Project }[]): BlockOf<"quotes"> => ({
      ...base("quotes"),
      type: "quotes",
      title,
      items: items.map(({ project, ...item }) => ({ ...item, consent: true as const, ...(project ? { project: project.id } : {}) })),
    }),
    /** Clients as names, without logos: a fictional person has no real clients whose marks could be shown. */
    clients: (title: string, names: string[]): BlockOf<"brands"> => ({ ...base("brands"), type: "brands", title, columns: 3, items: names.map((name) => ({ name })) }),
    /** The closing band with the page's one primary action: a path on example.com, or a mailbox there (`box`). */
    contact: (title: string, primary: { label: string; path?: string; box?: string; icon?: LinkIcon }, options: ContactOptions = {}): BlockOf<"contact"> => ({
      ...base("contact"),
      type: "contact",
      title,
      primary: { label: primary.label, url: primary.box ? `mailto:${primary.box}@example.com` : url(primary.path ?? "kontakt"), ...(primary.icon ? { icon: primary.icon } : {}) },
      ...(options.text ? { text: options.text } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.statusUntil ? { statusUntil: options.statusUntil } : {}),
      ...(options.links
        ? {
            links: options.links.map((link) => ({
              kind: link.kind,
              url: link.kind === "email" ? "mailto:hello@example.com" : link.kind === "phone" ? "tel:+49300000000" : url(link.path ?? link.kind),
              ...(link.label ? { label: link.label } : {}),
            })),
          }
        : {}),
      ...(options.steps ? { steps: options.steps } : {}),
    }),
    /**
     * A skill or repository. The address is example.com and so is the install command: a fictional
     * page must never hand out a command that installs someone's real code.
     */
    repo: (
      title: string,
      repo: string,
      options: { path?: string; kind?: "skill" | "repo"; description?: string; stars?: number; language?: string; license?: string; highlight?: boolean } = {},
    ): BlockOf<"repo"> => {
      const skill = options.path?.split("/").at(-1);
      return {
        ...base("repo"),
        type: "repo",
        title,
        url: url(options.path ? `${repo}/${options.path}` : repo),
        owner: slug,
        repo,
        ...(options.path ? { path: options.path } : {}),
        kind: options.kind ?? (options.path ? "skill" : "repo"),
        install: `npx skills add ${url(repo)}${skill ? ` --skill ${skill}` : ""}`,
        ...(options.description ? { description: options.description } : {}),
        ...(options.stars !== undefined ? { stars: options.stars } : {}),
        ...(options.language ? { language: options.language } : {}),
        ...(options.license ? { license: options.license } : {}),
        ...(options.highlight ? { highlight: true } : {}),
      };
    },
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
      ...(persona.photo && !persona.portraitOnly ? { hero: { ...h.image(persona.photo, persona.focal), alt: persona.name } } : {}),
      ...(persona.logo ? { logo: { ...h.image(persona.logo), alt: persona.name } } : {}),
      ...(persona.motion ? { motion: { src: `sample:motion-${persona.motion}` } } : {}),
      ...(persona.stats ? { stats: persona.stats.map(([value, label]) => ({ value, label })) } : {}),
      verified: false,
      locale,
    },
    blocks: blocks(h),
  };
}
