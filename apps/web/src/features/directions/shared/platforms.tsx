import type { Platform } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { Icon, PlatformIcon } from "@linkyo/ui";
import { Globe, Mail } from "lucide-react";
import type { SimpleIcon } from "simple-icons";
import {
  siApplemusic,
  siBandcamp,
  siBluesky,
  siDeezer,
  siDiscord,
  siFacebook,
  siGithub,
  siInstagram,
  siKick,
  siSoundcloud,
  siSpotify,
  siTelegram,
  siThreads,
  siTidal,
  siTiktok,
  siTwitch,
  siWhatsapp,
  siX,
  siYoutube,
  siYoutubemusic,
} from "simple-icons";

import { LINKEDIN_GLYPH } from "./link-icons";

/**
 * Platform glyphs and names, and the `sizes` hints for pictures: small and free of the page
 * renderer, so public pages (the homepage playground) can use them without loading it.
 */
const SIMPLE: Partial<Record<Platform, SimpleIcon>> = {
  youtube: siYoutube,
  youtubemusic: siYoutubemusic,
  spotify: siSpotify,
  applemusic: siApplemusic,
  soundcloud: siSoundcloud,
  deezer: siDeezer,
  tidal: siTidal,
  bandcamp: siBandcamp,
  tiktok: siTiktok,
  instagram: siInstagram,
  twitch: siTwitch,
  kick: siKick,
  x: siX,
  threads: siThreads,
  bluesky: siBluesky,
  discord: siDiscord,
  whatsapp: siWhatsapp,
  telegram: siTelegram,
  facebook: siFacebook,
  github: siGithub,
  linkedin: LINKEDIN_GLYPH,
};

const px = (n: number): string => `${n}px`;
const narrow = `(max-width: ${px(tokens.breakpoint.sm)})`;
/**
 * A share of a portfolio's canvas. Phones show it across the screen (`100vw`), on one of two columns
 * (`50vw`) or as a card of a row (`80vw`); up to the canvas width the page is the creator column,
 * where the picture takes `column` of it; from there on it takes `share` of the wide canvas (layout.work).
 */
const canvas = (share: number, phone: "100vw" | "50vw" | "80vw", column: number): string =>
  `${narrow} ${phone}, (max-width: ${px(tokens.layout.work - 1)}) ${px(Math.round(tokens.layout.creator * column))}, ${px(Math.round(tokens.layout.work * share))}`;

/** `sizes` hints for next/image, derived from layout tokens (no raw lengths in components). */
export const mediaSizes = {
  avatar: px(tokens.size.avatar2xl),
  cover: px(tokens.spacing["32"]),
  thumb: px(tokens.spacing["20"]),
  column: `${narrow} 100vw, ${px(tokens.layout.creator)}`,
  half: `${narrow} 50vw, ${px(Math.round(tokens.layout.creator / 2))}`,
  third: `${narrow} 33vw, ${px(Math.round(tokens.layout.creator / 3))}`,
  wide: `${narrow} 100vw, ${px(tokens.layout.content)}`,
  // Portfolios: a picture across the canvas, on two thirds of it, on a half and on a third; the
  // hero plate beside the name (seven of twelve columns) and a card of a row to swipe.
  work: canvas(1, "100vw", 1),
  workTwoThirds: canvas(2 / 3, "100vw", 1),
  workHalf: canvas(1 / 2, "50vw", 1 / 2),
  workThird: canvas(1 / 3, "50vw", 1 / 2),
  workPlate: canvas(7 / 12, "100vw", 1),
  workRail: canvas(1 / 3, "80vw", 2 / 5),
  // The same row inside the creator column (templates without the wide canvas).
  rail: `${narrow} 80vw, ${px(Math.round((tokens.layout.creator * 2) / 5))}`,
} as const;

export const platformName = (platform: Platform): string =>
  SIMPLE[platform]?.title ??
  (platform === "email" ? "Email" : platform === "linkedin" ? "LinkedIn" : "Website");

export function PlatformGlyph({
  platform,
  size = "md",
  className,
}: {
  platform: Platform;
  size?: "sm" | "md" | "lg";
  className?: string | undefined;
}) {
  const simple = SIMPLE[platform];
  if (simple) return <PlatformIcon icon={simple} size={size} className={className} />;
  return <Icon icon={platform === "email" ? Mail : Globe} size={size} className={className} />;
}

