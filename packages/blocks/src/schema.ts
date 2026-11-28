import { z } from "zod";

import { MAX_PROJECTS, PLATFORMS, PROJECT_SLUG, PROJECT_SLUG_MAX, PROJECT_SLUG_MIN, RESERVED_PROJECT_SLUGS, USERNAME_MAX, USERNAME_MIN, USERNAME_PATTERN } from "./rules";

/**
 * Block schemas — shared by the editor, the renderer and the API (and mirrored in Swift).
 * `config` lives in Postgres as jsonb and is validated with these schemas on every write.
 */

/** The platform list itself is in ./rules (`PLATFORMS`), so the browser can read it without Zod. */
export const platformSchema = z.enum(PLATFORMS);

/**
 * Icons a creator can put in front of a link (a curated set, so every page stays consistent). Without
 * one, the page picks an icon from the address (a phone number, WhatsApp, a PDF, a map, a platform).
 */
export const LINK_ICONS = [
  "link",
  "globe",
  "shop",
  "cart",
  "tag",
  "percent",
  "gift",
  "truck",
  "calendar",
  "clock",
  "phone",
  "mail",
  "chat",
  "map",
  "file",
  "download",
  "play",
  "mic",
  "music",
  "book",
  "newspaper",
  "briefcase",
  "code",
  "palette",
  "chart",
  "users",
  "star",
  "heart",
  "sparkles",
  "graduation",
  "ticket",
  "rocket",
] as const;
export type LinkIcon = (typeof LINK_ICONS)[number];

/** Where an app can be got: Apple's App Store, Google Play, or the web. */
export const APP_STORES = ["appstore", "googleplay", "web"] as const;
export type AppStore = (typeof APP_STORES)[number];

/** How an app is paid for, as the stores say it (no prices: they differ by country). */
export const APP_PRICING = ["free", "freemium", "paid"] as const;
export type AppPricing = (typeof APP_PRICING)[number];

/** How a video plays after the tap (see the video block). */
export const VIDEO_PLAYBACK = ["inline", "preview", "external"] as const;
export type VideoPlayback = (typeof VIDEO_PLAYBACK)[number];
export type Platform = z.infer<typeof platformSchema>;

const url = z.url({ protocol: /^(https?|mailto|tel)$/ });
const image = z
  .object({
    src: z.string().min(1),
    alt: z.string().max(300),
    /** Focal point 0–1 for auto-cropping. */
    focal: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
    /** Dominant luminance, measured at upload. Lets a page match its mode and tone the photo. */
    tone: z.enum(["light", "dark"]).optional(),
    /** Intrinsic size of the stored file in px, measured at upload. Both or neither. */
    w: z.number().int().min(1).max(8192).optional(),
    h: z.number().int().min(1).max(8192).optional(),
  })
  .superRefine((value, context) => {
    // A width without a height says nothing about the ratio: such a picture does not parse.
    if ((value.w === undefined) !== (value.h === undefined)) {
      context.addIssue({ code: "custom", path: [value.w === undefined ? "w" : "h"], message: "w and h come together" });
    }
  });

/** A project's address part (rules.ts): made by code from the title, unique on the page. */
const slug = z.string().min(PROJECT_SLUG_MIN).max(PROJECT_SLUG_MAX).regex(PROJECT_SLUG);
const year = z.number().int().min(1950).max(2100);
/** One year, a range, or "since" (`to: "now"`). */
const years = z.object({ from: year, to: z.union([year, z.literal("now")]).optional() });
/** A result in the owner's words: "9 → 3", "weeks to wait". */
const figure = z.object({ value: z.string().min(1).max(12), label: z.string().min(1).max(24) });

/** Languages a project's code sample can name (they decide how comments and strings are toned). */
export const CODE_LANGS = [
  "ts",
  "js",
  "go",
  "rust",
  "swift",
  "kotlin",
  "java",
  "csharp",
  "cpp",
  "php",
  "dart",
  "python",
  "ruby",
  "shell",
  "yaml",
  "toml",
  "sql",
  "lua",
  "html",
  "css",
  "json",
  "text",
] as const;
export type CodeLang = (typeof CODE_LANGS)[number];

/** Ways to reach someone besides the page's one primary action (the contact block's links). */
export const CONTACT_KINDS = ["email", "phone", "whatsapp", "calendar", "cv", "link"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

/** Paid or commission links must be labelled as advertising (DE: UWG § 5a, MStV § 22). */
const affiliate = z.boolean().optional();

/**
 * Where a block came from: written by the AI ("ai"), written by the AI and then changed by the owner
 * ("ai-edited"), or made by a person ("human"). Absent means human, so every older page stays valid.
 * Feeds the machine-readable marking of AI content on public pages (AI Act Art. 50(2)).
 */
export const BLOCK_ORIGINS = ["ai", "ai-edited", "human"] as const;
export type BlockOrigin = (typeof BLOCK_ORIGINS)[number];

const base = z.object({
  id: z.string().min(1),
  visible: z.boolean().default(true),
  schedule: z
    .object({ from: z.iso.datetime().optional(), until: z.iso.datetime().optional() })
    .optional(),
  highlight: z.boolean().default(false),
  origin: z.enum(BLOCK_ORIGINS).optional(),
});

export const blockSchema = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("link"),
    title: z.string().min(1).max(120),
    url,
    /** A short second line ("20 min · free", "Reply within 2 hours"); the address is shown otherwise. */
    subtitle: z.string().max(80).optional(),
    icon: z.enum(LINK_ICONS).optional(),
    thumbnail: image.optional(),
    badge: z.string().max(16).optional(),
    affiliate,
  }),
  base.extend({
    type: z.literal("card"),
    title: z.string().min(1).max(120),
    description: z.string().max(240).optional(),
    url,
    image,
    affiliate,
  }),
  base.extend({ type: z.literal("header"), title: z.string().min(1).max(80) }),
  base.extend({ type: z.literal("text"), text: z.string().min(1).max(2000) }),
  base.extend({ type: z.literal("divider") }),
  base.extend({
    type: z.literal("socials"),
    items: z.array(z.object({ platform: platformSchema, url })).max(12),
  }),
  base.extend({ type: z.literal("image"), image, url: url.optional() }),
  base.extend({ type: z.literal("gallery"), title: z.string().max(80).optional(), images: z.array(image).min(1).max(24) }),
  base.extend({
    type: z.literal("video"),
    title: z.string().min(1).max(120),
    provider: z.enum(["youtube", "vimeo", "tiktok", "instagram", "upload"]),
    url,
    poster: image,
    /** Seconds. */
    duration: z.number().int().positive().optional(),
    /**
     * After the tap: play the whole video on the page (default), play a short preview and then send
     * visitors to the creator's channel, or open the platform right away.
     */
    playback: z.enum(VIDEO_PLAYBACK).optional(),
  }),
  base.extend({
    type: z.literal("shorts"),
    title: z.string().max(80).optional(),
    items: z.array(z.object({ title: z.string().max(120), url, poster: image, views: z.number().int().nonnegative().optional() })).min(1).max(12),
  }),
  base.extend({
    type: z.literal("music"),
    title: z.string().min(1).max(120),
    artist: z.string().min(1).max(120),
    kind: z.enum(["single", "ep", "album", "playlist"]),
    cover: image,
    releaseDate: z.iso.date().optional(),
    links: z.array(z.object({ platform: platformSchema, url })).min(1).max(10),
  }),
  base.extend({
    type: z.literal("events"),
    title: z.string().max(80).optional(),
    items: z
      .array(
        z.object({
          date: z.iso.date(),
          city: z.string().max(80),
          venue: z.string().max(120),
          url,
          status: z.enum(["onsale", "few", "soldout"]),
          image: image.optional(),
          /** Show title ("Open Mic", "Release night"); the city is used when absent. */
          name: z.string().max(120).optional(),
          /** Doors/start, local time "HH:MM". */
          time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        }),
      )
      .min(1)
      .max(50),
  }),
  base.extend({
    type: z.literal("product"),
    title: z.string().min(1).max(120),
    price: z.number().nonnegative(),
    currency: z.enum(["EUR", "USD", "GBP", "CHF"]),
    url,
    image,
    affiliate,
  }),
  base.extend({
    type: z.literal("newsletter"),
    title: z.string().min(1).max(80),
    description: z.string().max(200).optional(),
  }),
  base.extend({
    type: z.literal("brands"),
    title: z.string().max(80).optional(),
    /**
     * Partners, sponsors, teams, clients: logo tiles. Two columns show the role, three show logos
     * only. A logo is optional: a block without any logo is a list of names (a portfolio's clients).
     */
    columns: z.union([z.literal(2), z.literal(3)]).default(3),
    items: z.array(z.object({ name: z.string().min(1).max(80), role: z.string().max(80).optional(), logo: image.optional(), url: url.optional() })).min(1).max(24),
  }),
  base.extend({
    /**
     * An app, for creators who show apps in their videos ("the app is in my link"). One button opens
     * the visitor's own store (App Store on an iPhone, Google Play on Android); the other stores stay
     * one tap away. Details come from the store when the link is pasted.
     */
    type: z.literal("app"),
    title: z.string().min(1).max(80),
    /** Who makes it. */
    developer: z.string().max(80).optional(),
    /** One line in the creator's words: what it does, or why they like it. */
    description: z.string().max(140).optional(),
    icon: image,
    /** The store's average rating, 0–5. */
    rating: z.number().min(0).max(5).optional(),
    category: z.string().max(40).optional(),
    pricing: z.enum(APP_PRICING).optional(),
    stores: z.array(z.object({ store: z.enum(APP_STORES), url })).min(1).max(3),
    /** A promo code visitors can copy. */
    code: z.string().max(32).optional(),
    affiliate,
  }),
  base.extend({
    /**
     * A GitHub repository, or a skill: a folder with a SKILL.md for AI agents. Visitors copy the
     * install command in one tap; stars, language and license come from GitHub when it is pasted.
     */
    type: z.literal("repo"),
    title: z.string().min(1).max(80),
    description: z.string().max(240).optional(),
    url,
    owner: z.string().min(1).max(39),
    repo: z.string().min(1).max(100),
    /** The folder inside the repository, when the link points at one skill. */
    path: z.string().max(240).optional(),
    kind: z.enum(["skill", "repo"]),
    stars: z.number().int().nonnegative().optional(),
    language: z.string().max(40).optional(),
    license: z.string().max(40).optional(),
    /** What visitors copy to install it, e.g. "npx skills add owner/repo". */
    install: z.string().max(200).optional(),
  }),
  base.extend({
    type: z.literal("live"),
    platform: z.enum(["twitch", "youtube", "kick", "tiktok", "instagram"]),
    channel: z.string().min(1).max(80),
    url,
    isLive: z.boolean(),
    title: z.string().max(140).optional(),
    viewers: z.number().int().nonnegative().optional(),
    /** Next scheduled live, with its UTC offset; visitors see it in their own time zone. */
    startsAt: z.iso.datetime({ offset: true }).optional(),
  }),
  base
    .extend({
      /**
       * One piece of work. The page shows what is filled: a card everywhere, and a page of its own
       * (/<username>/<slug>) once there is more to read than the card holds (`hasDetail`, ./project).
       * `highlight` is not offered for projects: the first project of a run leads.
       */
      type: z.literal("project"),
      /** Address part: /<username>/<slug>. Made by code from the title; unique on the page; not reserved. */
      slug,
      /** Earlier addresses of this project. They redirect here. */
      was: z.array(slug).max(3).optional(),
      title: z.string().min(1).max(60),
      /** The one sentence on every card and the standfirst of the project page. */
      summary: z.string().min(1).max(140),
      /** "For": a client, an employer or a publication. */
      client: z.string().max(60).optional(),
      /** Show "Confidential client" in place of a name. Then `client` must be absent: page JSON is public. */
      confidential: z.boolean().optional(),
      role: z.string().max(60).optional(),
      year: years.optional(),
      /** Topics, discipline or stack. */
      tags: z.array(z.string().min(1).max(24)).max(5).optional(),
      cover: image.optional(),
      /** Up to three figures in the owner's words ("9 → 3", "weeks to wait"). */
      results: z.array(figure).max(3).optional(),
      story: z
        .object({ about: z.string().max(600), problem: z.string().max(600), solution: z.string().max(600), result: z.string().max(600) })
        .partial()
        .optional(),
      /** Plain pictures that follow the story, laid out by ratio. One without a description waits in the editor. */
      pictures: z
        .array(z.object({ image, decorative: z.boolean().optional(), caption: z.string().max(120).optional() }))
        .max(20)
        .optional(),
      /** Where the work can be seen, read or heard. The label is derived from the address when absent. */
      links: z.array(z.object({ url, label: z.string().max(30).optional() })).max(2).optional(),
      /** Repository facts, read once from GitHub's API when the link was pasted. Same fields as the repo block. */
      source: z
        .object({
          owner: z.string().min(1).max(39),
          repo: z.string().min(1).max(100),
          stars: z.number().int().nonnegative().optional(),
          language: z.string().max(40).optional(),
          license: z.string().max(40).optional(),
          install: z.string().max(200).optional(),
          readAt: z.iso.date().optional(),
        })
        .optional(),
      /** A short sample: at most 30 lines (the editor checks). Shown left to right in the monospace face. */
      code: z.object({ text: z.string().min(1).max(2400), lang: z.enum(CODE_LANGS).optional(), file: z.string().max(80).optional() }).optional(),
    })
    .superRefine((value, context) => {
      if (typeof value.year?.to === "number" && value.year.to < value.year.from) {
        context.addIssue({ code: "custom", path: ["year", "to"], message: "the end is before the start" });
      }
      // Page JSON is world-readable: a confidential client's name is never stored.
      if (value.confidential === true && value.client !== undefined && value.client.trim() !== "") {
        context.addIssue({ code: "custom", path: ["client"], message: "a confidential client has no stored name" });
      }
    }),
  base.extend({
    type: z.literal("about"),
    title: z.string().max(80).optional(),
    text: z.string().min(1).max(1000),
    portrait: image.optional(),
    /** "Based in · Leipzig", "Languages · German, English". */
    facts: z.array(z.object({ label: z.string().min(1).max(24), value: z.string().min(1).max(40) })).max(4).optional(),
  }),
  base.extend({
    type: z.literal("tools"),
    title: z.string().max(80).optional(),
    /** One flat list of chips. A second group is a second block with its own title. */
    items: z.array(z.string().min(1).max(32)).min(1).max(12),
  }),
  base.extend({
    type: z.literal("timeline"),
    title: z.string().max(80).optional(),
    items: z
      .array(z.object({ role: z.string().min(1).max(60), org: z.string().max(60).optional(), years, note: z.string().max(120).optional(), url: url.optional() }))
      .min(1)
      .max(6),
  }),
  base.extend({
    type: z.literal("quotes"),
    title: z.string().max(80).optional(),
    items: z
      .array(
        z.object({
          text: z.string().min(1).max(280),
          /** A name or initials ("M. K."). */
          name: z.string().min(1).max(60),
          /** Required: a quote without context proves nothing. */
          role: z.string().min(1).max(80),
          photo: image.optional(),
          /** The owner confirmed they may publish it. The item cannot be saved without. */
          consent: z.literal(true),
          /** Block id of the project this quote is about. Unknown ids are ignored. */
          project: z.string().max(80).optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
  base.extend({
    /** How to reach the owner. A page has at most one; its `primary` is the page's one primary action. */
    type: z.literal("contact"),
    /** The closing line, set large. */
    title: z.string().min(1).max(80),
    text: z.string().max(160).optional(),
    /** Availability in the owner's words ("Frei ab März 2027"). */
    status: z.string().max(40).optional(),
    /** After this day the status is no longer shown. */
    statusUntil: z.iso.date().optional(),
    /** The page's one primary action. */
    primary: z.object({ label: z.string().min(1).max(40), url, icon: z.enum(LINK_ICONS).optional() }),
    links: z.array(z.object({ kind: z.enum(CONTACT_KINDS), label: z.string().max(40).optional(), url })).max(3).optional(),
    /** What happens after the first message, in up to three short steps. */
    steps: z.array(z.string().min(1).max(80)).max(3).optional(),
  }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

/**
 * Profile texts an applied AI draft or proposal wrote. A field stays listed after the owner edits it
 * (the text started as AI output, like "ai-edited" blocks); only the next applied AI draft or
 * proposal replaces the list. Absent means a person wrote them.
 */
export const AI_PROFILE_FIELDS = ["displayName", "tagline", "bio"] as const;
export type AiProfileField = (typeof AI_PROFILE_FIELDS)[number];

/** What a search engine shows in full of a page's title and description (Settings › Sichtbarkeit). */
export const SEARCH_TITLE_MAX = 60;
export const SEARCH_DESCRIPTION_MAX = 160;

/**
 * Who sees the page and how search engines and link cards name it (Settings › Sichtbarkeit, D-09).
 * Every field is optional, and absent is today's default: the page is on, search engines may show it,
 * and the name and the creator's own line are its title and description. These are settings, not
 * content: the AI never writes them, and applying a draft, a proposal or an imported page keeps the
 * page's own (`siteReducer`). A field that does not parse is dropped on its own, so a bad value never
 * takes the whole page down.
 */
export const visibilitySchema = z.object({
  /** The page is offline: visitors see a calm page with the name and photo only, and nothing is indexed. */
  paused: z.boolean().optional().catch(undefined),
  /** false: search engines are asked not to index the page or follow its links. Absent means shown. */
  search: z.boolean().optional().catch(undefined),
  /** The title in search results and on link cards; empty means the name. */
  title: z.string().max(SEARCH_TITLE_MAX).optional().catch(undefined),
  /** The description in search results and on link cards; empty means the tagline, else the bio. */
  description: z.string().max(SEARCH_DESCRIPTION_MAX).optional().catch(undefined),
});
export type Visibility = z.infer<typeof visibilitySchema>;

export const profileSchema = z.object({
  username: z.string().min(USERNAME_MIN).max(USERNAME_MAX).regex(USERNAME_PATTERN, "lowercase letters, numbers and dashes"),
  displayName: z.string().min(1).max(60),
  bio: z.string().max(160),
  location: z.string().max(60).optional(),
  avatar: image,
  hero: image.optional(),
  /**
   * A moving picture: a short silent clip (a few seconds, MP4) that loops in place of the hero photo.
   * The photo stays the poster, and the still picture for visitors who prefer reduced motion.
   */
  motion: z.object({ src: z.string().min(1).max(2048) }).optional(),
  /** Logo or wordmark (transparent PNG/SVG); templates with a logo hero show it instead of the name. */
  logo: image.optional(),
  /** One line under the name ("DJ & producer · Berlin"). */
  tagline: z.string().max(80).optional(),
  /** Up to three headline numbers under the name ("2.3M followers"), each optionally linked. */
  stats: z
    .array(z.object({ value: z.string().min(1).max(12), label: z.string().min(1).max(24), url: url.optional() }))
    .max(3)
    .optional(),
  verified: z.boolean().default(false),
  locale: z.enum(["de", "en", "ar"]),
  aiFields: z.array(z.enum(AI_PROFILE_FIELDS)).max(3).optional(),
  /** Pause, search engines, search title and description (`visibilitySchema`). */
  visibility: visibilitySchema.optional().catch(undefined),
});
export type Profile = z.infer<typeof profileSchema>;

/**
 * The page rules (at most 24 projects, every project address distinct and not reserved, one contact
 * block) guard examples, imports and tests. They do not repair: whoever builds a page (the editor's
 * "Duplicate", the welcome flow, the AI mapper) fixes duplicates before it parses, because one failed
 * parse there loses a whole draft. Saved pages are read block by block and never pass through here.
 */
export const pageSchema = z.object({ profile: profileSchema, blocks: z.array(blockSchema).max(200) }).superRefine((page, context) => {
  let projects = 0;
  let contacts = 0;
  const taken = new Set<string>();
  page.blocks.forEach((block, index) => {
    if (block.type === "contact") {
      contacts += 1;
      if (contacts > 1) context.addIssue({ code: "custom", path: ["blocks", index], message: "a page has one contact block" });
      return;
    }
    if (block.type !== "project") return;
    projects += 1;
    if (projects > MAX_PROJECTS) context.addIssue({ code: "custom", path: ["blocks", index], message: `a page holds at most ${String(MAX_PROJECTS)} projects` });
    if (RESERVED_PROJECT_SLUGS.has(block.slug)) context.addIssue({ code: "custom", path: ["blocks", index, "slug"], message: "this address is reserved" });
    [block.slug, ...(block.was ?? [])].forEach((address, position) => {
      if (taken.has(address)) {
        context.addIssue({ code: "custom", path: position === 0 ? ["blocks", index, "slug"] : ["blocks", index, "was", position - 1], message: "this address is taken on the page" });
      }
      taken.add(address);
    });
  });
});

export type Page = z.infer<typeof pageSchema>;

/** Blocks that should render now (visible + inside schedule). */
export function isBlockActive(block: Block, now: Date = new Date()): boolean {
  if (!block.visible) return false;
  const from = block.schedule?.from ? new Date(block.schedule.from) : null;
  const until = block.schedule?.until ? new Date(block.schedule.until) : null;
  return (!from || from <= now) && (!until || until > now);
}

/**
 * True when the page carries AI-written content: a block from an AI draft (edited or not) or profile
 * text an AI draft wrote. Used for the public page's marking and for how a proposal names its maker.
 */
export function hasAiContent(page: Page): boolean {
  return (page.profile.aiFields?.length ?? 0) > 0 || page.blocks.some((block) => block.origin === "ai" || block.origin === "ai-edited");
}
