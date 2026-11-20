"use client";

import type { HeroStyle } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { ArrowUpRight } from "lucide-react";
import type { CSSProperties, PointerEvent } from "react";

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
  logo: string | null;
  hero: HeroStyle;
  links: string[];
  signup: string;
  /** Real people: an unofficial concept page or a prepared preview, labelled as such. */
  badge?: "concept" | "preview" | undefined;
}

const sizes = {
  grid: "(max-width: 48rem) 50vw, (max-width: 80rem) 33vw, 25vw",
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
      className="mk-tilt relative isolate aspect-portrait overflow-hidden rounded-xl border border-line bg-creator-bg font-creator-body text-creator-fg"
    >
      <div className={cn("absolute inset-0 overflow-hidden", item.hero === "duotone" && "isolate bg-creator-bg")}>
        {item.photo ? (
          <MediaImage
            src={item.photo}
            alt=""
            sizes={compact ? sizes.wall : sizes.grid}
            priority={priority}
            className={cn(
              "transition-transform duration-slow ease-standard group-hover:scale-lift motion-reduce:transition-none",
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

      <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-creator-glass px-2 py-1 text-caption font-semibold text-creator-fg backdrop-blur-glass">
          <Icon icon={CATEGORY_ICONS[item.category]} size="sm" className="shrink-0" />
          {compact ? null : <span className="truncate max-sm:hidden">{label}</span>}
        </span>
        {compact ? null : (
          <span className="shrink-0 rounded-full bg-creator-glass px-2 py-1 text-caption font-semibold text-creator-fg uppercase backdrop-blur-glass">
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
          {compact ? null : <p className="line-clamp-1 text-caption text-creator-fg-muted sm:line-clamp-2">{item.tagline}</p>}
        </div>
        {compact ? null : (
          <span className="grid size-control-sm shrink-0 place-items-center rounded-full bg-creator-glass text-creator-fg backdrop-blur-glass transition-colors duration-standard ease-standard group-hover:bg-creator-accent group-hover:text-creator-accent-fg group-focus-visible:bg-creator-accent group-focus-visible:text-creator-accent-fg">
            <Icon icon={ArrowUpRight} size="sm" className="rtl:-scale-x-100" />
          </span>
        )}
      </div>
    </div>
  );
}

/** The card leans towards the mouse a little (CSS does the motion; reduced motion keeps it flat). */
export function tiltTowards(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const target = event.currentTarget;
  const box = target.getBoundingClientRect();
  target.style.setProperty("--tilt-x", (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
  target.style.setProperty("--tilt-y", (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
}

export function tiltBack(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--tilt-x");
  event.currentTarget.style.removeProperty("--tilt-y");
}
