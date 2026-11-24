import type { StaticImageData } from "next/image";

import { exampleMedia } from "@/features/examples/media";
import { starMedia } from "@/features/previews/stars-media";

import gearHeadphones from "@/assets/samples/gear-headphones.jpg";
import milaLogo from "@/assets/samples/mila-logo.png";
import nourLogo from "@/assets/samples/nour-logo.png";
import mix01 from "@/assets/samples/mix-01.jpg";
import mix02 from "@/assets/samples/mix-02.jpg";
import mix03 from "@/assets/samples/mix-03.jpg";
import mix04 from "@/assets/samples/mix-04.jpg";
import partnerKiezfunk from "@/assets/samples/partner-kiezfunk.jpg";
import partnerNordlicht from "@/assets/samples/partner-nordlicht.jpg";
import partnerWerk9 from "@/assets/samples/partner-werk9.jpg";
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
import journalistAvatar from "@/assets/samples/journalist-avatar.jpg";
import journalistHero from "@/assets/samples/journalist-hero.jpg";

/** Sample media registry. In production `image.src` is a Supabase Storage key resolved by the image CDN. */
export const sampleMedia = {
  "sample:gear-headphones": gearHeadphones,
  "sample:mila-logo": milaLogo,
  "sample:nour-logo": nourLogo,
  "sample:mix-01": mix01,
  "sample:mix-02": mix02,
  "sample:mix-03": mix03,
  "sample:mix-04": mix04,
  "sample:partner-kiezfunk": partnerKiezfunk,
  "sample:partner-nordlicht": partnerNordlicht,
  "sample:partner-werk9": partnerWerk9,
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
  "sample:journalist-avatar": journalistAvatar,
  "sample:journalist-hero": journalistHero,
  ...exampleMedia,
  ...starMedia,
} satisfies Record<string, StaticImageData>;

export type SampleKey = keyof typeof sampleMedia;

/** next/image props for pictures that stay on the creator's own platform: shown as they are, no referrer. */
export function remoteImageProps(resolved: StaticImageData | string) {
  return typeof resolved === "string" && /^https?:/.test(resolved) ? { unoptimized: true, referrerPolicy: "no-referrer" as const } : {};
}

export function resolveMedia(src: string): StaticImageData | string {
  return src in sampleMedia ? sampleMedia[src as SampleKey] : src;
}

/**
 * An address a plain `<img>` can load (the dashboard's avatar): a sample picture's file, else the
 * address itself; an unknown `sample:` key has no file and gives none (the avatar then shows initials).
 */
export function plainImageSrc(src: string): string | undefined {
  const resolved = resolveMedia(src);
  if (typeof resolved !== "string") return resolved.src;
  return resolved.startsWith("sample:") ? undefined : resolved;
}
