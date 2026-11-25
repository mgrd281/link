import type { Block, BlockType, Detection } from "@linkyo/blocks";
import { NO_IMAGE } from "@linkyo/blocks/rules";

import { blockFromDetection } from "@/features/directions/editor/state";

// Type only: kinds.ts imports this file at run time, so a value import here would be a cycle.
import type { CreatorKind } from "./kinds";

let counter = 0;
export const newBlockId = (type: string) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const noImage = { src: NO_IMAGE, alt: "" };

/** Every type the Add sheet offers, most used first. */
export const ADDABLE: BlockType[] = [
  "link",
  "header",
  "socials",
  "music",
  "video",
  "events",
  "product",
  "app",
  "repo",
  "project",
  "about",
  "tools",
  "timeline",
  "quotes",
  "contact",
  "image",
  "gallery",
  "card",
  "text",
  "shorts",
  "brands",
  "newsletter",
  "live",
  "divider",
];

/**
 * The Add sheet's groups, so 24 types read as five short lists instead of one wall of tiles. Every
 * addable type sits in exactly one group (checked in blocks.test.ts).
 */
export const ADD_GROUPS = {
  links: ["link", "card", "socials", "newsletter"],
  media: ["music", "video", "shorts", "image", "gallery", "live"],
  sell: ["product", "events", "app", "repo", "brands"],
  portfolio: ["project", "about", "tools", "timeline", "quotes", "contact"],
  layout: ["header", "text", "divider"],
} as const satisfies Record<string, readonly BlockType[]>;

/**
 * Entries of a group that are no type of their own: a block of an existing type, started for one
 * purpose. "Clients" is a `brands` block that begins as a list of names (the Add sheet files
 * `brands` itself under "Sell & events" as partners with logos). Listed right after the group's quotes (at its end when it has none).
 */
export const ADD_PRESETS = { portfolio: ["clients"] } as const satisfies Partial<Record<keyof typeof ADD_GROUPS, readonly string[]>>;
export type AddPreset = (typeof ADD_PRESETS)[keyof typeof ADD_PRESETS][number];

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
  // Pages that show work: the project first, the one way to get in touch last.
  designer: ["project", "gallery", "quotes", "contact"],
  photographer: ["project", "gallery", "quotes", "contact"],
  developer: ["project", "repo", "tools", "contact"],
  engineer: ["project", "repo", "tools", "contact"],
  freelancer: ["project", "about", "quotes", "contact"],
  writer: ["project", "about", "quotes", "contact"],
  journalist: ["project", "about", "quotes", "contact"],
  coach: ["project", "about", "quotes", "contact"],
  lawyer: ["project", "about", "quotes", "contact"],
  student: ["project", "about", "quotes", "contact"],
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
      // No date filled in for the owner: a made-up day could go on the page unchecked (the form asks).
      return { ...base, type, items: [{ date: "", city: "", venue: "", url: "", status: "onsale" }] };
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
    case "project":
      // The address is made from the title when the project is first saved (`slugFor`).
      return { ...base, type, slug: "", title: "", summary: "" };
    case "about":
      return { ...base, type, text: "" };
    case "tools":
      return { ...base, type, items: [] };
    case "timeline":
      return { ...base, type, items: [{ role: "", years: { from: new Date().getFullYear() } }] };
    case "quotes":
      // No empty item: a quote exists only once its owner's permission is confirmed.
      return { ...base, type, items: [] };
    case "contact":
      return { ...base, type, title: "", primary: { label: "", url: "" } };
  }
}

/** The block a preset entry of the Add sheet starts with. Clients: a list of names, no logo asked for. */
export function presetBlock(preset: AddPreset, defaults: { clients: string }): Block {
  const presets: Record<AddPreset, () => Block> = {
    clients: () => ({ id: newBlockId("brands"), visible: true, highlight: false, type: "brands", title: defaults.clients, columns: 3, items: [{ name: "" }] }),
  };
  return presets[preset]();
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
