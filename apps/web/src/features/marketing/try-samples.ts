import { siInstagram, siSpotify, siTwitch, siYoutube, type SimpleIcon } from "simple-icons";

import junoPortrait from "@/assets/examples/ex6-juno-kade.jpg";

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
  /** The same portrait as a file, for the photo button (without the page's picture catalogue). */
  picture: junoPortrait,
  /** Instagram first (an icon under the name), then the release and the live set. */
  links: ["instagram", "spotify", "youtube"] as const satisfies readonly SampleId[],
  look: "nocturne",
};
