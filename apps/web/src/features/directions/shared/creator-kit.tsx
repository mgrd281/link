import { hasImage } from "@linkyo/blocks/rules";
import { cn, Icon, LogoSymbol } from "@linkyo/ui";
import { Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { resolveMedia } from "./media";
import { mediaSizes, PlatformGlyph, platformName } from "./platforms";
import { PrivacySettingsLink } from "./privacy";
import { isProxiedImage } from "./remote-images";

export { mediaSizes, PlatformGlyph, platformName };

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
  if (!hasImage({ src })) {
    // No picture yet (new creators, links pasted before metadata arrives): a calm tile, never a broken image.
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        className={cn(
          "bg-creator-surface-2 text-creator-fg-muted absolute inset-0 grid place-items-center",
          className,
        )}
      >
        <Icon icon={ImageIcon} size="lg" />
      </span>
    );
  }
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
      // Platform pictures (thumbnails, covers) go through our optimizer, so visitors never contact the
      // platform; other remote pictures are shown as they are, without a referrer.
      unoptimized={typeof resolved === "string" && /^https?:/.test(resolved) && !isProxiedImage(resolved)}
      referrerPolicy="no-referrer"
      className={cn("object-cover", className)}
    />
  );
}

/** Up to two initials, for creators without a photo. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]];
  return letters
    .map((word) => Array.from(word ?? "")[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

/** A creator's initials on their accent color. Fills its (relative, sized) box. */
export function Monogram({ name, className }: { name: string; className?: string | undefined }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-creator-accent font-creator-display text-creator-accent-fg absolute inset-0 grid place-items-center",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function useCreatorFormat(locale: string) {
  return {
    date: (iso: string, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { timeZone: "Europe/Berlin", ...options }).format(
        new Date(`${iso}T20:00:00Z`),
      ),
    compact: (n: number) =>
      new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n),
    number: (n: number) => new Intl.NumberFormat(locale).format(n),
    price: (n: number, currency: string) =>
      new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0 }).format(n),
    duration: (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
  };
}

/**
 * Sticky-free footer: subtle "Made with Linkyo" (removable in Pro) + legal links (DSA "Report"). Pages
 * with embedded players also link to the privacy settings (there are no tracking cookies to manage).
 */
export function CreatorFooter({ className, credit = true, privacy = false }: { className?: string; credit?: boolean; privacy?: boolean }) {
  const t = useTranslations("creator");
  return (
    <footer
      className={cn(
        "text-caption text-creator-fg-muted grid justify-items-center gap-4 pt-12 pb-10",
        className,
      )}
    >
      {credit ? (
        <a
          href="https://linkyo.app"
          className="h-control-sm border-creator-line text-creator-fg duration-micro hover:border-creator-line-strong focus-visible:focus-ring inline-flex items-center gap-2 rounded-full border px-3 font-medium transition-colors"
        >
          <LogoSymbol tone="mono" className="size-icon-sm" />
          {t("madeWith")}
        </a>
      ) : null}
      <nav aria-label={t("menu")} className="flex flex-wrap justify-center gap-x-1">
        {(["imprint", "privacy", "report"] as const).map((key) => (
          <a
            key={key}
            href={`#${key}`}
            className="min-h-touch-target hover:text-creator-fg focus-visible:focus-ring inline-flex items-center rounded-xs px-2"
          >
            {t(key)}
          </a>
        ))}
        {privacy ? (
          <PrivacySettingsLink className="min-h-touch-target hover:text-creator-fg focus-visible:focus-ring inline-flex items-center rounded-xs px-2" />
        ) : null}
      </nav>
    </footer>
  );
}
