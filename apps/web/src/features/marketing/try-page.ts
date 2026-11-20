import { detectLink, NO_IMAGE, type Block, type Page } from "@linkyo/blocks";

import { blockFromLink } from "@/features/app/blocks";
import type { SocialPlatform } from "@/features/app/kinds";
import { fetchLinkMetadata, metadataPatch, metadataUrl, type LinkMetadata } from "@/features/app/metadata";

import type { SampleId } from "./try-samples";

/**
 * Building the playground's page. This module (with the blocks schemas and the metadata helpers) is
 * only loaded with the phone, when the playground comes near, so the homepage starts without it.
 */

/** One link in the playground, as the controls keep it. */
export interface TryItem {
  key: string;
  url: string;
  social: SocialPlatform | undefined;
  sample: SampleId | undefined;
  meta?: LinkMetadata;
}

export interface TryPageInput {
  id: string;
  displayName: string;
  address: string;
  tagline: string;
  photo: { src: string; tone: "light" | "dark" } | null;
  items: TryItem[];
  locale: string;
  labels: { video: string; music: string; event: string };
  texts: { video: string; product: string };
}

/**
 * What an example link becomes on the page: the same blocks a pasted link makes, filled in the way a
 * creator's would be (a release with its cover, a live set with its picture, a live channel, a record
 * in the shop), with Juno Kade's pictures. The release carries the typed name as its artist. Instagram
 * is a profile, so it becomes an icon under the name, not a block.
 */
export function sampleBlock(sample: Exclude<SampleId, "instagram">, id: string, url: string, context: { artist: string; channel: string; texts: TryPageInput["texts"] }): Block {
  const base = { id, visible: true, highlight: false };
  switch (sample) {
    case "spotify":
      // The first release leads, as on musicians' pages: large, with its cover.
      return {
        ...base,
        highlight: true,
        type: "music",
        title: "Afterglow",
        artist: context.artist,
        kind: "single",
        cover: { src: "sample:ex6-cover-afterglow", alt: "" },
        links: [{ platform: "spotify", url }],
      };
    case "youtube":
      return { ...base, type: "video", title: context.texts.video, provider: "youtube", url, poster: { src: "sample:ex6-club-lasers", alt: "" }, duration: 3540 };
    case "twitch":
      return { ...base, type: "live", platform: "twitch", channel: context.channel, url, isLive: true, viewers: 1240 };
    case "shop":
      return { ...base, type: "product", title: context.texts.product, price: 29, currency: "EUR", url, image: { src: "sample:ex6-cover-afterglow", alt: "" } };
  }
}

/** The page as the renderer gets it: the same profile and blocks a new account starts with. */
export function buildTryPage(input: TryPageInput): Page {
  const { displayName, address, items } = input;
  const socials = items.flatMap((item) => (item.social ? [{ platform: item.social, url: item.url }] : []));
  const blocks = items.flatMap((item): Block[] => {
    if (item.social) return [];
    if (item.sample && item.sample !== "instagram") {
      return [sampleBlock(item.sample, item.key, item.url, { artist: displayName, channel: (address || "junokade").replace(/-/g, "_"), texts: input.texts })];
    }
    const found = detectLink(item.url);
    if (!found) return [];
    const block = { ...blockFromLink(found, input.labels, displayName), id: item.key };
    const patch = item.meta ? metadataPatch(block, block, item.meta) : null;
    return [patch ? ({ ...block, ...patch } as Block) : block];
  });
  const line = input.tagline.trim();
  return {
    profile: {
      username: address || "…",
      displayName,
      bio: "",
      avatar: input.photo ? { src: input.photo.src, alt: "", tone: input.photo.tone } : { src: NO_IMAGE, alt: "" },
      ...(line ? { tagline: line } : {}),
      verified: false,
      locale: input.locale === "ar" || input.locale === "en" ? input.locale : "de",
    },
    blocks: socials.length > 0 ? [{ id: `${input.id}-socials`, type: "socials", visible: true, highlight: false, items: socials }, ...blocks] : blocks,
  };
}

/** The real title and picture of a pasted song or video, from our server (as in the app). */
export async function findMetadata(url: string, labels: TryPageInput["labels"]): Promise<LinkMetadata | null> {
  const found = detectLink(url);
  const address = found ? metadataUrl(blockFromLink(found, labels, "")) : null;
  return address ? fetchLinkMetadata(address) : null;
}
