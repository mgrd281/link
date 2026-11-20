"use client";

import type { HeroStyle } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";

import { MediaImage, Monogram } from "@/features/directions/shared/creator-kit";
import { displayStyle } from "@/features/directions/poster/styles";

import { CATEGORY_ICONS } from "./category-icons";
import type { Category } from "./looks";

export { CATEGORY_ICONS } from "./category-icons";

/** Everything a card needs, prepared on the server (theme already resolved to CSS variables). */
export interface GalleryItem {
  slug: string;
  name: string;
  tagline: string;
  category: Category;
  locale: "de" | "en" | "ar";
  style: CSSProperties;
  photo: string | null;
  /** Where the face is in the photo (0-1, 0-1), so the card's crop keeps it. */
  focal?: readonly [number, number] | undefined;
  logo: string | null;
  hero: HeroStyle;
  links: string[];
  /** Search words in all three languages (kind of page and category), see the templates page. */
  keywords?: string;
  signup: string;
  /** Real people: an unofficial concept page or a prepared preview, labelled as such. */
  badge?: "concept" | "preview" | undefined;
}

const sizes = {
  grid: "(min-width: 80rem) 16rem, (min-width: 48rem) 30vw, 46vw",
  wall: "(max-width: 64rem) 40vw, 12rem",
} as const;

/**
 * A page as a card, in the page's own colors and fonts: its picture full-bleed, its name and line on
 * the page's background. `compact` is the small version on the moving wall (no line, no labels).
 */
export function CardFace({
  item,
  label,
  compact = false,
  priority = false,
}: {
  item: GalleryItem;
  /** Category or badge, shown as a chip with the category's icon. */
  label: string;
  compact?: boolean;
  /** The first cards on screen: their pictures load first (they are the largest thing in view). */
  priority?: boolean;
}) {
  const logo = item.hero === "logo" && item.logo;
  return (
    <div
      style={item.style}
      className={cn(
        "relative isolate aspect-portrait overflow-hidden border border-line bg-creator-bg font-creator-body text-creator-fg",
        compact ? "rounded-xl" : "rounded-lg md:rounded-xl",
      )}
    >
      <div className={cn("absolute inset-0 overflow-hidden", item.hero === "duotone" && "isolate bg-creator-bg")}>
        {item.photo ? (
          <MediaImage
            src={item.photo}
            alt=""
            focal={item.focal}
            sizes={compact ? sizes.wall : sizes.grid}
            priority={priority}
            className={cn(
              // One move with the card's lift: same spring, same moment. Reduced motion: no zoom at all.
              !logo && "transition-[scale] duration-spring ease-spring group-hover:scale-lift motion-reduce:transition-none motion-reduce:group-hover:scale-none",
              logo && "scale-lift blur-glass",
              item.hero === "duotone" && "grayscale contrast-125 mix-blend-screen",
              item.hero === "mono" && "grayscale",
            )}
          />
        ) : (
          <Monogram name={item.name} className="text-display" />
        )}
        {logo ? (
          <>
            <div aria-hidden className="absolute inset-0 bg-creator-bg opacity-secondary" />
            <span className="absolute inset-x-1/4 top-2/5 aspect-square -translate-y-1/2">
              <MediaImage src={item.logo ?? ""} alt="" sizes={sizes.wall} className="object-contain" />
            </span>
          </>
        ) : null}
      </div>
      {/* The name sits on the page's own background, as it does on the page itself. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-creator-bg from-30% to-transparent" />

      {/* The chips line up with the name below. They sit on the page's own surface (not glass), so
          their text keeps its contrast on any photo; a hairline in the page's line color frames them. */}
      <div className={cn("absolute flex items-start justify-between gap-2", compact ? "inset-x-3 top-3" : "inset-x-3 top-3 sm:inset-x-4 sm:top-4")}>
        <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-creator-line bg-creator-surface px-2 py-1 text-caption font-semibold text-creator-fg">
          <Icon icon={CATEGORY_ICONS[item.category]} size="sm" className="shrink-0" />
          {compact ? null : <span className="truncate max-sm:hidden">{label}</span>}
        </span>
        {compact ? null : (
          <span className="shrink-0 rounded-full border border-creator-line bg-creator-surface px-2 py-1 text-caption font-semibold text-creator-fg uppercase">
            {item.locale}
          </span>
        )}
      </div>

      <div className={cn("absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2", compact ? "p-3" : "p-3 sm:p-4")}>
        {/* Labels follow the site's direction; the page's own words keep their language and direction. */}
        <div dir={item.locale === "ar" ? "rtl" : "ltr"} lang={item.locale} className="grid min-w-0 gap-0.5">
          <p
            className={cn("font-creator-display leading-tight", compact ? "line-clamp-2 text-body font-semibold" : "line-clamp-2 text-body-lg sm:text-h3")}
            style={displayStyle}
          >
            {item.name}
          </p>
          {/* One line, so names share a baseline across a row. Phones show the first part only: a
              role ("App-Tipps"), never a list cut after its first dot. */}
          {compact ? null : (
            <>
              <p className="line-clamp-1 text-caption text-creator-fg-muted sm:hidden">{item.tagline.split(" · ")[0]}</p>
              <p className="line-clamp-1 text-caption text-creator-fg-muted max-sm:hidden">{item.tagline}</p>
            </>
          )}
        </div>
        {compact ? null : (
          <span className="grid size-control-sm shrink-0 place-items-center rounded-full border border-creator-line bg-creator-glass text-creator-fg backdrop-blur-glass transition-colors max-sm:hidden duration-standard ease-standard group-hover:bg-creator-accent group-hover:text-creator-accent-fg group-focus-visible:bg-creator-accent group-focus-visible:text-creator-accent-fg">
            <Icon icon={ArrowUpRight} size="sm" className="rtl:-scale-x-100" />
          </span>
        )}
      </div>
    </div>
  );
}
