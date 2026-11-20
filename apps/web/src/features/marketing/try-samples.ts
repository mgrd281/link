import type { Block } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { siInstagram, siSpotify, siTwitch, siYoutube, type SimpleIcon } from "simple-icons";

import { LOOKS as GALLERY } from "@/features/examples/looks";

export type SampleId = "spotify" | "youtube" | "instagram" | "shop" | "twitch";

/**
 * The playground's example links. They are samples: they show what a pasted link becomes, with the
 * pictures of Juno Kade (the fictional DJ of the template gallery), and are never fetched, looked up
 * or carried into a real account.
 */
export const EXAMPLES: readonly { id: SampleId; label: string; url: string; icon: SimpleIcon | null }[] = [
  { id: "instagram", label: "Instagram", url: "https://instagram.com/junokade", icon: siInstagram },
  { id: "spotify", label: "Spotify", url: "https://open.spotify.com/track/afterglow", icon: siSpotify },
  { id: "youtube", label: "YouTube", url: "https://youtu.be/rooftop-set", icon: siYoutube },
  { id: "shop", label: "Shop", url: "https://shop.example.com/products/afterglow-vinyl", icon: null },
  { id: "twitch", label: "Twitch", url: "https://twitch.tv/junokade", icon: siTwitch },
];

export const sampleOf = (url: string): SampleId | undefined => EXAMPLES.find((example) => example.url === url)?.id;

/** The persona the playground introduces itself with: Juno Kade, as in the template gallery. */
export const PERSONA = {
  name: "Juno Kade",
  photo: { src: "sample:ex6-juno-kade", tone: "dark" as const },
  /** Instagram first (an icon under the name), then the release and the live set. */
  links: ["instagram", "spotify", "youtube"] as const satisfies readonly SampleId[],
  look: "nocturne",
};

export interface SampleTexts {
  /** The live set's title ("Rooftop set · Afterglow live"). */
  video: string;
  /** The record in the shop ("Afterglow · vinyl"). */
  product: string;
}

/**
 * What an example link becomes on the page: the same blocks a pasted link makes, filled in the way a
 * creator's would be (a release with its cover, a live set with its picture, a live channel, a record
 * in the shop). The release carries the name typed in the playground as its artist. Instagram is a
 * profile, so it becomes an icon under the name (see the playground), not a block.
 */
export function sampleBlock(sample: Exclude<SampleId, "instagram">, id: string, url: string, context: { artist: string; channel: string; texts: SampleTexts }): Block {
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

/**
 * The looks to try: one per template, each a complete look from the template gallery (accent, page
 * color, type, buttons), as different from its neighbours as looks get. The first is Juno Kade's own.
 */
export const TRY_LOOKS: { id: string; config: CreatorThemeConfig }[] = [
  { id: "nocturne", config: GALLERY["juno-kade"].theme },
  { id: "daylight", config: GALLERY["fenja-roth"].theme },
  { id: "pulse", config: { template: "pulse", accent: creatorTokens.swatches.amethyst, pairing: "modern", buttonShape: "pill" } },
  { id: "atelier", config: GALLERY["clara-wendt"].theme },
  { id: "mono", config: GALLERY["nela-voss"].theme },
];
