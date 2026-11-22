import { detectMany, type Block, type BlockOf, type CreatorKind, type LinkIcon, type Platform } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { blockFromLink, newBlockId } from "./blocks";

// What kind of page someone is making: the list moved to @linkyo/blocks (the AI page plan offers the
// same kinds); re-exported here so every importer keeps working.
export { KINDS, isKind, type CreatorKind } from "@linkyo/blocks";

/** Profiles asked for in the welcome flow, with what goes in front of the handle. */
export const SOCIAL_PREFIX = {
  instagram: "instagram.com/",
  tiktok: "tiktok.com/@",
  youtube: "youtube.com/@",
  spotify: "open.spotify.com/artist/",
  x: "x.com/",
  threads: "threads.net/@",
  linkedin: "linkedin.com/in/",
  facebook: "facebook.com/",
  whatsapp: "wa.me/",
  github: "github.com/",
  twitch: "twitch.tv/",
  discord: "discord.gg/",
} as const satisfies Partial<Record<Platform, string>>;
export type SocialPlatform = keyof typeof SOCIAL_PREFIX;

/** Questions beyond profiles; each one that is answered becomes a block on the page. */
export type StarterField = "address" | "phone" | "hours" | "shopUrl" | "website" | "booking" | "email" | "book" | "cv" | "newsletter" | "tiktokLive" | "affiliate";

export interface Starter {
  theme: CreatorThemeConfig;
  socials: readonly SocialPlatform[];
  fields: readonly StarterField[];
  /** Businesses lead with a logo; people with a portrait. */
  logoFirst: boolean;
}

export const STARTERS: Record<CreatorKind, Starter> = {
  tiktok: { theme: { template: "pulse" }, socials: ["tiktok", "instagram", "youtube"], fields: ["tiktokLive"], logoFirst: false },
  instagram: { theme: { template: "daylight" }, socials: ["instagram", "tiktok", "threads"], fields: [], logoFirst: false },
  youtube: { theme: { template: "nocturne" }, socials: ["youtube", "instagram", "tiktok"], fields: [], logoFirst: false },
  // App tips: the apps from the videos as a store-like list (pasted store links become app cards).
  apps: { theme: { template: "aura", accent: creatorTokens.swatches.sky }, socials: ["tiktok", "instagram", "youtube"], fields: [], logoFirst: false },
  writer: { theme: { template: "atelier" }, socials: ["instagram", "x", "threads"], fields: ["book", "newsletter"], logoFirst: false },
  journalist: { theme: { template: "atelier", pairing: "editorial" }, socials: ["x", "linkedin", "instagram"], fields: ["email"], logoFirst: false },
  business: { theme: { template: "daylight", pairing: "modern" }, socials: ["linkedin", "instagram", "whatsapp"], fields: ["website", "booking", "email"], logoFirst: true },
  shop: { theme: { template: "marquee" }, socials: ["instagram", "facebook", "whatsapp"], fields: ["address", "phone", "hours"], logoFirst: true },
  store: { theme: { template: "marquee", pairing: "bold" }, socials: ["instagram", "tiktok", "facebook"], fields: ["shopUrl"], logoFirst: true },
  engineer: { theme: { template: "daylight", pairing: "tech" }, socials: ["linkedin", "x", "instagram"], fields: ["website", "cv", "email"], logoFirst: false },
  lawyer: { theme: { template: "atelier", pairing: "classic" }, socials: ["linkedin", "facebook", "whatsapp"], fields: ["booking", "phone", "email", "address"], logoFirst: false },
  student: { theme: { template: "pulse", pairing: "modern" }, socials: ["instagram", "linkedin", "tiktok"], fields: ["cv", "email"], logoFirst: false },
  warehouse: { theme: { template: "daylight", pairing: "modern" }, socials: ["linkedin", "whatsapp", "facebook"], fields: ["cv", "phone", "email"], logoFirst: false },
  music: { theme: { template: "nocturne" }, socials: ["spotify", "instagram", "tiktok", "youtube"], fields: [], logoFirst: false },
  streamer: { theme: { template: "nocturne", pairing: "tech" }, socials: ["twitch", "discord", "youtube", "tiktok"], fields: [], logoFirst: false },
  podcast: { theme: { template: "atelier", pairing: "editorial" }, socials: ["instagram", "youtube", "tiktok"], fields: ["newsletter"], logoFirst: false },
  // Affiliate links must be recognisable as advertising (UWG § 5a, MStV § 22): the switch labels them.
  affiliate: { theme: { template: "daylight", pairing: "modern", buttonStyle: "shadow" }, socials: ["instagram", "tiktok", "youtube"], fields: ["affiliate", "newsletter"], logoFirst: false },
  marketing: { theme: { template: "daylight", pairing: "modern", buttonShape: "pill" }, socials: ["linkedin", "instagram", "x"], fields: ["booking", "website", "newsletter", "email"], logoFirst: false },
  coach: { theme: { template: "daylight", pairing: "elegant" }, socials: ["instagram", "linkedin", "youtube"], fields: ["booking", "newsletter", "email"], logoFirst: false },
  developer: { theme: { template: "nocturne", pairing: "tech", buttonStyle: "outline" }, socials: ["github", "linkedin", "x"], fields: ["website", "cv", "email"], logoFirst: false },
  designer: { theme: { template: "atelier", pairing: "editorial" }, socials: ["instagram", "linkedin", "threads"], fields: ["website", "booking", "email"], logoFirst: false },
  other: { theme: { template: "nocturne" }, socials: ["instagram", "tiktok", "youtube"], fields: [], logoFirst: false },
};

/** A handle, @handle, phone number or full link → the profile URL. */
export function socialUrl(platform: SocialPlatform, value: string): string | null {
  const raw = value.trim().replace(/^@/, "");
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (platform === "whatsapp") {
    const digits = raw.replace(/[^\d]/g, "");
    return digits.length >= 6 ? `https://wa.me/${digits}` : null;
  }
  return `https://${SOCIAL_PREFIX[platform]}${raw}`;
}

const withScheme = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export interface StarterInput {
  kind: CreatorKind;
  handles: Partial<Record<SocialPlatform, string>>;
  values: Partial<Record<StarterField, string>>;
  switches: Partial<Record<StarterField, boolean>>;
  links: string;
}

export interface StarterLabels {
  directions: (address: string) => string;
  call: string;
  hours: string;
  shop: string;
  website: string;
  booking: string;
  contact: string;
  book: string;
  cv: string;
  newsletter: string;
  liveTitle: string;
  detection: { video: string; music: string; event: string };
  artist: string;
}

/**
 * Turns the welcome answers into the first blocks of the page: profiles on top, then the one action
 * that matters most for this kind (directions for a shop, the shop for a store, booking for a
 * business), then pasted links as the right blocks.
 */
export function starterBlocks(input: StarterInput, labels: StarterLabels): Block[] {
  const starter = STARTERS[input.kind];
  const base = (type: string) => ({ id: newBlockId(type), visible: true, highlight: false });
  const link = (title: string, url: string, highlight = false, icon?: LinkIcon): BlockOf<"link"> => ({
    ...base("link"),
    type: "link",
    title: title.slice(0, 120),
    url,
    highlight,
    ...(icon ? { icon } : {}),
  });
  const value = (field: StarterField) => input.values[field]?.trim() ?? "";
  const blocks: Block[] = [];

  const items = starter.socials.flatMap((platform) => {
    const url = socialUrl(platform, input.handles[platform] ?? "");
    return url ? [{ platform, url }] : [];
  });
  if (items.length) blocks.push({ ...base("socials"), type: "socials", items });

  for (const field of starter.fields) {
    const text = value(field);
    switch (field) {
      case "address":
        if (text) blocks.push(link(labels.directions(text), `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`, true, "map"));
        break;
      case "phone": {
        const phone = text.replace(/[^\d+]/g, "");
        if (phone.length >= 5) blocks.push(link(labels.call, `tel:${phone}`));
        break;
      }
      case "hours":
        if (text) blocks.push({ ...base("header"), type: "header", title: labels.hours }, { ...base("text"), type: "text", text: text.slice(0, 2000) });
        break;
      case "shopUrl":
        if (text) blocks.push(link(labels.shop, withScheme(text), true, "shop"));
        break;
      case "website":
        if (text) blocks.push(link(labels.website, withScheme(text), false, "globe"));
        break;
      case "booking":
        if (text) blocks.push(link(labels.booking, withScheme(text), true, "calendar"));
        break;
      case "email":
        if (isEmail(text)) blocks.push(link(labels.contact, `mailto:${text}`));
        break;
      case "book":
        if (text) blocks.push(link(labels.book, withScheme(text), true, "book"));
        break;
      case "cv":
        if (text) blocks.push(link(labels.cv, withScheme(text), true, "file"));
        break;
      case "newsletter":
        if (input.switches.newsletter) blocks.push({ ...base("newsletter"), type: "newsletter", title: labels.newsletter });
        break;
      case "affiliate":
        // Handled below: it labels the pasted links, it adds no block of its own.
        break;
      case "tiktokLive": {
        const handle = (input.handles.tiktok ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, "").split(/[/?#]/)[0] ?? "";
        if (input.switches.tiktokLive && handle) {
          blocks.push({ ...base("live"), type: "live", platform: "tiktok", channel: handle, url: `https://www.tiktok.com/@${handle}/live`, isLive: false, title: labels.liveTitle });
        }
        break;
      }
    }
  }

  // Affiliate links are labelled as advertising ("Ad"/"Anzeige") wherever a block can carry the label.
  const ads = starter.fields.includes("affiliate") && input.switches.affiliate === true;
  for (const detection of detectMany(input.links)) {
    const block = blockFromLink(detection, labels.detection, labels.artist);
    blocks.push(ads && (block.type === "link" || block.type === "card" || block.type === "product") ? { ...block, affiliate: true } : block);
  }
  return blocks;
}
