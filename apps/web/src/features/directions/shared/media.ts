import type { StaticImageData } from "next/image";

import coverDaw from "@/assets/samples/cover-daw.jpg";
import coverDune from "@/assets/samples/cover-dune.jpg";
import coverLichtfeld from "@/assets/samples/cover-lichtfeld.jpg";
import coverNachtstrom from "@/assets/samples/cover-nachtstrom.jpg";
import coverOrbit from "@/assets/samples/cover-orbit.jpg";
import eventBerlin from "@/assets/samples/event-berlin.jpg";
import eventHamburg from "@/assets/samples/event-hamburg.jpg";
import gallery1 from "@/assets/samples/gallery-1.jpg";
import merchPoster from "@/assets/samples/merch-poster.jpg";
import merchPrint from "@/assets/samples/merch-print.jpg";
import merchVinyl from "@/assets/samples/merch-vinyl.jpg";
import milaAvatar from "@/assets/samples/mila-avatar.jpg";
import milaHero from "@/assets/samples/mila-hero.jpg";
import milaWide from "@/assets/samples/mila-wide.jpg";
import nourAvatar from "@/assets/samples/nour-avatar.jpg";
import nourHero from "@/assets/samples/nour-hero.jpg";
import nourWide from "@/assets/samples/nour-wide.jpg";
import short1 from "@/assets/samples/short-1.jpg";
import short2 from "@/assets/samples/short-2.jpg";
import short3 from "@/assets/samples/short-3.jpg";
import short4 from "@/assets/samples/short-4.jpg";
import videoLive from "@/assets/samples/video-live.jpg";

/** Sample media registry. In production `image.src` is a Supabase Storage key resolved by the image CDN. */
export const sampleMedia = {
  "sample:cover-daw": coverDaw,
  "sample:cover-dune": coverDune,
  "sample:cover-lichtfeld": coverLichtfeld,
  "sample:cover-nachtstrom": coverNachtstrom,
  "sample:cover-orbit": coverOrbit,
  "sample:event-berlin": eventBerlin,
  "sample:event-hamburg": eventHamburg,
  "sample:gallery-1": gallery1,
  "sample:merch-poster": merchPoster,
  "sample:merch-print": merchPrint,
  "sample:merch-vinyl": merchVinyl,
  "sample:mila-avatar": milaAvatar,
  "sample:mila-hero": milaHero,
  "sample:mila-wide": milaWide,
  "sample:nour-avatar": nourAvatar,
  "sample:nour-hero": nourHero,
  "sample:nour-wide": nourWide,
  "sample:short-1": short1,
  "sample:short-2": short2,
  "sample:short-3": short3,
  "sample:short-4": short4,
  "sample:video-live": videoLive,
} satisfies Record<string, StaticImageData>;

export type SampleKey = keyof typeof sampleMedia;

export function resolveMedia(src: string): StaticImageData | string {
  return src in sampleMedia ? sampleMedia[src as SampleKey] : src;
}

/**
 * Prototype stand-in for the upload-time photo analysis (`extractSeed` → light/dark): Poster pages
 * open in the mode that matches the creator's portrait, so the photo fades into the page seamlessly.
 */
const sampleTone: Partial<Record<SampleKey, "light" | "dark">> = {
  "sample:mila-hero": "dark",
  "sample:nour-hero": "light",
};

export const photoTone = (src: string): "light" | "dark" | undefined => sampleTone[src as SampleKey];
