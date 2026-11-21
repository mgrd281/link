import { NO_IMAGE, type Block, type BlockType, type Detection } from "@linkyo/blocks";

import { blockFromDetection } from "@/features/directions/editor/state";

// Type only: kinds.ts imports this file at run time, so a value import here would be a cycle.
import type { CreatorKind } from "./kinds";

let counter = 0;
export const newBlockId = (type: string) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const noImage = { src: NO_IMAGE, alt: "" };

/** In two weeks, as YYYY-MM-DD (a sensible first show date). */
const soon = () => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

/** Every type the Add sheet offers, most used first. */
export const ADDABLE: BlockType[] = ["link", "header", "socials", "music", "video", "events", "product", "app", "repo", "image", "gallery", "card", "text", "shorts", "brands", "newsletter", "live", "divider"];

/**
 * The Add sheet's groups, so 18 types read as four short lists instead of one wall of tiles. Every
 * addable type sits in exactly one group (checked in blocks.test.ts).
 */
export const ADD_GROUPS = {
  links: ["link", "card", "socials", "newsletter"],
  media: ["music", "video", "shorts", "image", "gallery", "live"],
  sell: ["product", "events", "app", "repo", "brands"],
  layout: ["header", "text", "divider"],
} as const satisfies Record<string, readonly BlockType[]>;

/** The first group when we don't know what the page is for. */
export const POPULAR: BlockType[] = ["link", "socials", "music", "video"];

/** The first group by page kind (chosen in the welcome flow): what that kind of page adds most. */
export const SUGGESTED: Partial<Record<CreatorKind, BlockType[]>> = {
  music: ["music", "video", "events", "socials"],
  podcast: ["music", "video", "newsletter", "socials"],
  tiktok: ["socials", "shorts", "link", "product"],
  instagram: ["socials", "shorts", "link", "product"],
  youtube: ["video", "shorts", "socials", "product"],
  streamer: ["live", "video", "socials", "product"],
  apps: ["app", "video", "link", "socials"],
  affiliate: ["product", "link", "card", "socials"],
  store: ["product", "link", "newsletter", "socials"],
  shop: ["product", "link", "events", "socials"],
  business: ["link", "events", "image", "socials"],
  marketing: ["link", "card", "newsletter", "socials"],
  coach: ["events", "link", "newsletter", "socials"],
  developer: ["repo", "app", "link", "socials"],
  engineer: ["repo", "link", "card", "socials"],
  designer: ["gallery", "image", "link", "socials"],
  writer: ["link", "card", "newsletter", "socials"],
  journalist: ["link", "card", "newsletter", "socials"],
  lawyer: ["link", "text", "card", "socials"],
  student: ["link", "image", "text", "socials"],
  warehouse: ["product", "link", "text", "socials"],
};

export type AddGroupKey = "suggested" | "popular" | keyof typeof ADD_GROUPS;

/**
 * The Add sheet, top to bottom: "For you" (by page kind) or "Popular" first, then the fixed groups
 * without the types already shown above, so every type appears exactly once. Empty groups are dropped.
 */
export function addGroups(kind?: string): { key: AddGroupKey; types: BlockType[] }[] {
  const suggested = kind && Object.hasOwn(SUGGESTED, kind) ? SUGGESTED[kind as CreatorKind] : undefined;
  const first = { key: suggested ? ("suggested" as const) : ("popular" as const), types: suggested ?? POPULAR };
  const shown = new Set<BlockType>(first.types);
  const rest = (Object.keys(ADD_GROUPS) as (keyof typeof ADD_GROUPS)[]).map((key) => ({ key, types: ADD_GROUPS[key].filter((type) => !shown.has(type)) }));
  return [first, ...rest].filter((group) => group.types.length > 0);
}

/**
 * Where new blocks go when no place was chosen: at the top of the page, but under the social icons
 * when the page starts with them (they belong right below the profile). The Add sheet uses the same
 * rule for pasted links and picked types, so both land in one predictable place.
 */
export const insertAt = (blocks: readonly Block[]): number => (blocks[0]?.type === "socials" ? 1 : 0);

/** An empty block of a type, ready for the edit panel (it is only added once it is valid). */
export function blankBlock(type: BlockType, defaults: { artist: string; newsletter: string }): Block {
  const base = { id: newBlockId(type), visible: true, highlight: false };
  switch (type) {
    case "link":
      return { ...base, type, title: "", url: "" };
    case "card":
      return { ...base, type, title: "", url: "", image: noImage };
    case "header":
      return { ...base, type, title: "" };
    case "text":
      return { ...base, type, text: "" };
    case "divider":
      return { ...base, type };
    case "socials":
      return { ...base, type, items: [{ platform: "instagram", url: "" }] };
    case "image":
      return { ...base, type, image: noImage };
    case "gallery":
      return { ...base, type, images: [] };
    case "video":
      return { ...base, type, title: "", provider: "youtube", url: "", poster: noImage };
    case "shorts":
      return { ...base, type, items: [{ title: "", url: "", poster: noImage }] };
    case "music":
      return { ...base, type, title: "", artist: defaults.artist, kind: "single", cover: noImage, links: [{ platform: "spotify", url: "" }] };
    case "events":
      return { ...base, type, items: [{ date: soon(), city: "", venue: "", url: "", status: "onsale" }] };
    case "product":
      return { ...base, type, title: "", price: 0, currency: "EUR", url: "", image: noImage };
    case "newsletter":
      return { ...base, type, title: defaults.newsletter };
    case "brands":
      return { ...base, type, columns: 3, items: [{ name: "", logo: noImage }] };
    case "live":
      return { ...base, type, platform: "twitch", channel: "", url: "", isLive: false };
    case "app":
      return { ...base, type, title: "", icon: noImage, stores: [{ store: "appstore", url: "" }] };
    case "repo":
      return { ...base, type, title: "", url: "", owner: "", repo: "", kind: "skill" };
  }
}

/** Replace any sample picture with "no image yet" (a creator's page never shows sample media). */
function withoutSamples<T>(value: T): T {
  if (Array.isArray(value)) return (value as unknown[]).map((item) => withoutSamples(item)) as T;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, key === "src" && typeof inner === "string" && inner.startsWith("sample:") ? NO_IMAGE : withoutSamples(inner)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

/**
 * A pasted link becomes a block right away. In production the server then fetches the title,
 * cover and platform links (our resolver) and fills them in; the demo leaves the picture empty.
 */
export function blockFromLink(detection: Detection, labels: { video: string; music: string; event: string }, artist: string): Block {
  const block = withoutSamples(blockFromDetection(detection, labels));
  if (block.type === "music") return { ...block, artist };
  return block;
}
