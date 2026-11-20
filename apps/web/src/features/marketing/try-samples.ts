import type { Block } from "@linkyo/blocks";
import { siSpotify, siTwitch, siYoutube, type SimpleIcon } from "simple-icons";

export type SampleId = "spotify" | "youtube" | "twitch" | "shop";

/**
 * The playground's example links. They are samples: they show what a pasted link becomes, with
 * Linkyo's own sample pictures, and are never fetched, looked up or carried into a real account.
 */
export const EXAMPLES: readonly { id: SampleId; label: string; url: string; icon: SimpleIcon | null }[] = [
  { id: "spotify", label: "Spotify", url: "https://open.spotify.com/track/lichtfeld", icon: siSpotify },
  { id: "youtube", label: "YouTube", url: "https://youtu.be/live-in-berlin", icon: siYoutube },
  { id: "twitch", label: "Twitch", url: "https://twitch.tv/lichtfeld", icon: siTwitch },
  { id: "shop", label: "Shop", url: "https://shop.example.com/products/lichtfeld-vinyl", icon: null },
];

export const sampleOf = (url: string): SampleId | undefined => EXAMPLES.find((example) => example.url === url)?.id;

export interface SampleTexts {
  /** The video's title ("Live in Berlin"). */
  video: string;
  /** The record in the shop ("Lichtfeld · Vinyl"). */
  product: string;
}

/**
 * What an example link becomes on the page: the same blocks a pasted link makes, filled in the way a
 * creator's would be (a release with its cover, a video with its picture, a live channel, a record in
 * the shop). The release carries the name typed in the playground as its artist.
 */
export function sampleBlock(sample: SampleId, id: string, url: string, context: { artist: string; channel: string; texts: SampleTexts }): Block {
  const base = { id, visible: true, highlight: false };
  switch (sample) {
    case "spotify":
      // The first release leads, as on musicians' pages: large, with its cover.
      return {
        ...base,
        highlight: true,
        type: "music",
        title: "Lichtfeld",
        artist: context.artist,
        kind: "single",
        cover: { src: "sample:cover-lichtfeld", alt: "" },
        links: [{ platform: "spotify", url }],
      };
    case "youtube":
      return { ...base, type: "video", title: context.texts.video, provider: "youtube", url, poster: { src: "sample:video-live", alt: "" } };
    case "twitch":
      return { ...base, type: "live", platform: "twitch", channel: context.channel, url, isLive: true, viewers: 1240 };
    case "shop":
      return { ...base, type: "product", title: context.texts.product, price: 24, currency: "EUR", url, image: { src: "sample:merch-vinyl", alt: "" } };
  }
}
