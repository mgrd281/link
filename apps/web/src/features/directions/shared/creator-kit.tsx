import type { Platform } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { cn, Icon, LogoSymbol, PlatformIcon } from "@linkyo/ui";
import { Globe, Mail } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { SimpleIcon } from "simple-icons";
import {
  siApplemusic,
  siBandcamp,
  siBluesky,
  siDeezer,
  siDiscord,
  siFacebook,
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

import { resolveMedia } from "./media";

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
  SIMPLE[platform]?.title ?? (platform === "email" ? "Email" : platform === "linkedin" ? "LinkedIn" : "Website");

export function PlatformGlyph({ platform, size = "md", className }: { platform: Platform; size?: "sm" | "md" | "lg"; className?: string | undefined }) {
  const simple = SIMPLE[platform];
  if (simple) return <PlatformIcon icon={simple} size={size} className={className} />;
  return <Icon icon={platform === "email" ? Mail : Globe} size={size} className={className} />;
}

/** next/image for sample assets (blur placeholder) and remote URLs. Always fills its box (no CLS). */
export function MediaImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string | undefined;
  priority?: boolean;
}) {
  const resolved = resolveMedia(src);
  return (
    <Image
      src={resolved}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      placeholder={typeof resolved === "string" ? "empty" : "blur"}
      className={cn("object-cover", className)}
    />
  );
}

export function useCreatorFormat(locale: string) {
  return {
    date: (iso: string, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { timeZone: "Europe/Berlin", ...options }).format(new Date(`${iso}T20:00:00Z`)),
    compact: (n: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n),
    number: (n: number) => new Intl.NumberFormat(locale).format(n),
    price: (n: number, currency: string) =>
      new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0 }).format(n),
    duration: (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
  };
}

/** Sticky-free footer: subtle "Made with Linkyo" (removable in Pro) + legal links (DSA "Report"). No cookie settings: there are no cookies. */
export function CreatorFooter({ className }: { className?: string }) {
  const t = useTranslations("creator");
  return (
    <footer className={cn("grid justify-items-center gap-4 pt-12 pb-10 text-caption text-creator-fg-muted", className)}>
      <a
        href="https://linkyo.app"
        className="inline-flex h-control-sm items-center gap-2 rounded-full border border-creator-line px-3 font-medium text-creator-fg transition-colors duration-micro hover:border-creator-line-strong focus-visible:focus-ring"
      >
        <LogoSymbol className="size-icon-sm" />
        {t("madeWith")}
      </a>
      <nav aria-label={t("menu")} className="flex flex-wrap justify-center gap-x-1">
        {(["imprint", "privacy", "report"] as const).map((key) => (
          <a
            key={key}
            href={`#${key}`}
            className="inline-flex min-h-touch-target items-center rounded-xs px-2 underline-offset-4 hover:text-creator-fg hover:underline focus-visible:focus-ring"
          >
            {t(key)}
          </a>
        ))}
      </nav>
    </footer>
  );
}
