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

/** `sizes` hints for next/image, derived from layout tokens (no raw lengths in components). */
export const mediaSizes = {
  avatar: px(tokens.size.avatar2xl),
  cover: px(tokens.spacing["32"]),
  thumb: px(tokens.spacing["20"]),
  column: `${narrow} 100vw, ${px(tokens.layout.creator)}`,
  half: `${narrow} 50vw, ${px(Math.round(tokens.layout.creator / 2))}`,
  third: `${narrow} 33vw, ${px(Math.round(tokens.layout.creator / 3))}`,
  wide: `${narrow} 100vw, ${px(tokens.layout.content)}`,
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

