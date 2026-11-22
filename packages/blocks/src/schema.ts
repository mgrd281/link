import { z } from "zod";

import { USERNAME_MAX, USERNAME_MIN, USERNAME_PATTERN } from "./rules";

/**
 * Block schemas — shared by the editor, the renderer and the API (and mirrored in Swift).
 * `config` lives in Postgres as jsonb and is validated with these schemas on every write.
 */

export const PLATFORMS = [
  "youtube",
  "youtubemusic",
  "spotify",
  "applemusic",
  "soundcloud",
  "deezer",
  "tidal",
  "bandcamp",
  "tiktok",
  "instagram",
  "twitch",
  "kick",
  "x",
  "threads",
  "bluesky",
  "discord",
  "whatsapp",
  "telegram",
  "facebook",
  "linkedin",
  "github",
  "email",
  "website",
] as const;
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
const image = z.object({
  src: z.string().min(1),
  alt: z.string().max(300),
  /** Focal point 0–1 for auto-cropping. */
  focal: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  /** Dominant luminance, measured at upload. Lets a page match its mode and tone the photo. */
  tone: z.enum(["light", "dark"]).optional(),
});

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
    /** Partners, sponsors, teams: logo tiles. Two columns show the role, three show logos only. */
    columns: z.union([z.literal(2), z.literal(3)]).default(3),
    items: z.array(z.object({ name: z.string().min(1).max(80), role: z.string().max(80).optional(), logo: image, url: url.optional() })).min(1).max(24),
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
});
export type Profile = z.infer<typeof profileSchema>;

export const pageSchema = z.object({ profile: profileSchema, blocks: z.array(blockSchema).max(200) });

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
