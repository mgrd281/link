import { detectLink, NO_IMAGE, type Block, type Page } from "@linkyo/blocks";

import { blockFromLink } from "@/features/app/blocks";
import type { SocialPlatform } from "@/features/app/kinds";
import { fetchLinkMetadata, metadataPatch, metadataUrl, type LinkMetadata } from "@/features/app/metadata";

import { SAMPLE_FACTS, type SampleId } from "./try-samples";

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
  texts: { video: string; necklace: string; perfume: string };
}

/**
 * What an example link becomes on the page: the same blocks a pasted link makes, filled in the way a
 * creator's would be (two pieces from the shop with their pictures, a video with its picture), with
 * Lou Ferreira's pictures. Instagram and TikTok are profiles, so they become icons under the name.
 */
export function sampleBlock(sample: Exclude<SampleId, "instagram" | "tiktok">, id: string, url: string, texts: TryPageInput["texts"]): Block {
  const base = { id, visible: true, highlight: false };
  switch (sample) {
    case "necklace":
    case "perfume": {
      const fact = SAMPLE_FACTS[sample];
      return { ...base, type: "product", title: texts[sample], price: fact.price, currency: fact.currency, url, image: { src: fact.src, alt: "" } };
    }
    case "youtube":
      return { ...base, type: "video", title: texts.video, provider: "youtube", url, poster: { src: SAMPLE_FACTS.youtube.src, alt: "" }, duration: SAMPLE_FACTS.youtube.duration };
  }
}

/** The page as the renderer gets it: the same profile and blocks a new account starts with. */
export function buildTryPage(input: TryPageInput): Page {
  const { displayName, address, items } = input;
  const socials = items.flatMap((item) => (item.social ? [{ platform: item.social, url: item.url }] : []));
  const blocks = items.flatMap((item): Block[] => {
    if (item.social) return [];
    if (item.sample && item.sample !== "instagram" && item.sample !== "tiktok") return [sampleBlock(item.sample, item.key, item.url, input.texts)];
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
