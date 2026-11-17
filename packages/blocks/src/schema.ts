import { z } from "zod";

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
  "email",
  "website",
] as const;
export const platformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof platformSchema>;

const url = z.url({ protocol: /^(https?|mailto|tel)$/ });
const image = z.object({
  src: z.string().min(1),
  alt: z.string().max(300),
  /** Focal point 0–1 for auto-cropping. */
  focal: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
});

const base = z.object({
  id: z.string().min(1),
  visible: z.boolean().default(true),
  schedule: z
    .object({ from: z.iso.datetime().optional(), until: z.iso.datetime().optional() })
    .optional(),
  highlight: z.boolean().default(false),
});

export const blockSchema = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("link"),
    title: z.string().min(1).max(120),
    url,
    thumbnail: image.optional(),
    badge: z.string().max(16).optional(),
  }),
  base.extend({
    type: z.literal("card"),
    title: z.string().min(1).max(120),
    description: z.string().max(240).optional(),
    url,
    image,
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
  }),
  base.extend({
    type: z.literal("newsletter"),
    title: z.string().min(1).max(80),
    description: z.string().max(200).optional(),
  }),
  base.extend({
    type: z.literal("live"),
    platform: z.enum(["twitch", "youtube", "kick"]),
    channel: z.string().min(1).max(80),
    url,
    isLive: z.boolean(),
    title: z.string().max(140).optional(),
    viewers: z.number().int().nonnegative().optional(),
  }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const profileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "lowercase letters, numbers and dashes"),
  displayName: z.string().min(1).max(60),
  bio: z.string().max(160),
  location: z.string().max(60).optional(),
  avatar: image,
  hero: image.optional(),
  verified: z.boolean().default(false),
  locale: z.enum(["de", "en", "ar"]),
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
