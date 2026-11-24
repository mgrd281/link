import { hasImage } from "@linkyo/blocks/rules";
import { cn, Icon, LogoSymbol } from "@linkyo/ui";
import { Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { initials } from "@/features/share/story-card";
import { creatorOrigin } from "@/lib/page-url";

import { resolveMedia } from "./media";
import { mediaSizes, PlatformGlyph, platformName } from "./platforms";
import { PrivacySettingsLink } from "./privacy";
import { isForeignImage } from "./remote-images";

export { mediaSizes, PlatformGlyph, platformName };

/** next/image for sample assets (blur placeholder) and remote URLs. Always fills its box (no CLS). */
export function MediaImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
  focal,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string | undefined;
  priority?: boolean;
  /** Where the subject is (0-1, 0-1): cropping keeps it in view. Centered when not given. */
  focal?: readonly [number, number] | undefined;
}) {
  // No picture yet (new creators, links pasted before metadata arrives), or one on someone else's
  // server that our optimizer does not re-serve: a calm tile, never a broken image and never a
  // request from the visitor's browser to a third party (creator pages load nothing from elsewhere).
  if (!hasImage({ src }) || isForeignImage(src)) {
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
      // Platform pictures (thumbnails, covers) and Storage uploads go through our optimizer, so
      // visitors never contact the platform; foreign addresses never get here (above).
      referrerPolicy="no-referrer"
      {...(focal ? { style: { objectPosition: `${focal[0] * 100}% ${focal[1] * 100}%` } } : {})}
      className={cn("object-cover", className)}
    />
  );
}

// Up to two initials, one for an Arabic name, for creators without a photo. Defined with the story
// picture, free of React and next/image, so the link preview cards drawn on the server share the rule.
export { initials };

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
 * Where a public page's footer links lead: the creator's own imprint on the page (only once they
 * filled it in), Linkyo's privacy notice for creator pages, and the place to report content (DSA).
 */
export interface CreatorFooterLinks {
  imprint?: string | undefined;
  privacy: string;
  report: string;
}

/**
 * Sticky-free footer: subtle "Made with Linkyo" (removable in Pro) + legal links (DSA "Report"). Pages
 * with embedded players also link to the privacy settings (there are no tracking cookies to manage).
 */
export function CreatorFooter({
  className,
  credit = true,
  privacy = false,
  trademarks = false,
  links,
}: {
  className?: string | undefined;
  credit?: boolean;
  privacy?: boolean;
  /** The page shows the official App Store and Google Play badges: credit the marks, as Apple and Google ask. */
  trademarks?: boolean;
  /** Public pages: real destinations. Without them (examples, previews) the links are in-page anchors. */
  links?: CreatorFooterLinks | undefined;
}) {
  const t = useTranslations("creator");
  const targets = (["imprint", "privacy", "report"] as const).flatMap((key) => {
    const href = links ? links[key] : `#${key}`;
    return href ? [{ key, href }] : [];
  });
  return (
    <footer
      className={cn(
        "text-caption text-creator-fg-muted grid justify-items-center gap-4 pt-12 pb-10",
        className,
      )}
    >
      {credit ? (
        <a
          href={creatorOrigin()}
          className="h-control-sm border-creator-line text-creator-fg duration-micro hover:border-creator-line-strong focus-visible:focus-ring inline-flex items-center gap-2 rounded-full border px-3 font-medium transition-colors"
        >
          <LogoSymbol tone="mono" className="size-icon-sm" />
          {t("madeWith")}
        </a>
      ) : null}
      <nav aria-label={t("menu")} className="flex flex-wrap justify-center gap-x-1">
        {targets.map(({ key, href }) => (
          <a
            key={key}
            href={href}
            className="min-h-touch-target hover:text-creator-fg focus-visible:focus-ring inline-flex items-center rounded-xs px-2"
          >
            {t(key)}
          </a>
        ))}
        {privacy ? (
          <PrivacySettingsLink className="min-h-touch-target hover:text-creator-fg focus-visible:focus-ring inline-flex items-center rounded-xs px-2" />
        ) : null}
      </nav>
      {trademarks ? <p className="max-w-prose text-center text-pretty">{t("trademarks")}</p> : null}
    </footer>
  );
}
