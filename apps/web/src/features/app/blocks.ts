import { NO_IMAGE, type Block, type BlockType, type Detection } from "@linkyo/blocks";

import { blockFromDetection } from "@/features/directions/editor/state";

let counter = 0;
export const newBlockId = (type: string) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const noImage = { src: NO_IMAGE, alt: "" };

/** In two weeks, as YYYY-MM-DD (a sensible first show date). */
const soon = () => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

/** The order people find things in the Add sheet: most used first. */
export const ADDABLE: BlockType[] = ["link", "header", "socials", "music", "video", "events", "product", "image", "gallery", "card", "text", "shorts", "brands", "newsletter", "live", "divider"];

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
