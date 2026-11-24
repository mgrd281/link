import { tokens } from "@linkyo/tokens";
import type { LucideIcon } from "lucide-react";
import type { SimpleIcon } from "simple-icons";
import type { CSSProperties } from "react";

import { DIRECTIONAL } from "./icons";
import { cn } from "./lib/cn";

export type IconSize = "xs" | "sm" | "md" | "lg";

const sizeClass: Record<IconSize, string> = {
  xs: "size-icon-xs",
  sm: "size-icon-sm",
  md: "size-icon-md",
  lg: "size-icon-lg",
};

/** The rendered size of each step, in CSS pixels (tokens: size.icon-*). */
const SIZE_PX: Record<IconSize, number> = {
  xs: tokens.size.iconXs,
  sm: tokens.size.iconSm,
  md: tokens.size.iconMd,
  lg: tokens.size.iconLg,
};

/** The stroke each step draws, in CSS pixels (tokens: icon.stroke-sm / -md / -lg). */
const STROKE_PX: Record<IconSize, number> = {
  xs: tokens.icon.strokeSm,
  sm: tokens.icon.strokeSm,
  md: tokens.icon.strokeMd,
  lg: tokens.icon.strokeLg,
};

/** Lucide draws every glyph on a 24-unit grid. */
const GRID = 24;

/**
 * The stroke width, in the glyph's 24-unit grid, that draws the token's width in CSS pixels at this
 * size (S-06): 1.5 px at 12 and 16 px, 1.6 px at 20 px, 1.75 px at 24 px, 2.25 px when `strong`. A
 * fixed 1.75 in the grid shrank to 1.17 px at 16 px, lighter than the text beside it. This is lucide's
 * `absoluteStrokeWidth` worked out here: that prop is deprecated in lucide 1.x and reads only lucide's
 * own `size` prop, and its successor `nonScalingStroke` ignores scaled previews (a page shrunk into
 * a phone frame would draw full-weight strokes).
 */
export function iconStroke(size: IconSize, strong = false): number {
  const px = strong ? tokens.icon.strokeStrong : STROKE_PX[size];
  return Math.round(((px * GRID) / SIZE_PX[size]) * 1000) / 1000;
}

/**
 * Mirrors an element in right-to-left text: inside `dir="rtl"`, unless a `dir="ltr"` island sits in
 * between (a German page previewed inside an Arabic one keeps its arrows). Written out with attribute
 * selectors because the CSS minifier rewrites `:dir(rtl)` into a list of `:lang()` selectors, which
 * misses a `dir="rtl"` block on a German page; Tailwind's `rtl:` also matches inside left-to-right
 * islands. A nested island inside an island (rtl, ltr, rtl) is not handled.
 */
export const MIRROR_IN_RTL = "[&:where([dir=rtl],[dir=rtl]_*):not(:where([dir=rtl]_[dir=ltr],[dir=rtl]_[dir=ltr]_*))]:-scale-x-100";

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize | undefined;
  className?: string | undefined;
  /** Decorative by default. Pass a label only when the icon conveys meaning on its own. */
  label?: string | undefined;
  /** The selected state of a tab or segment: a heavier stroke (icon.stroke-strong), with a semibold label. */
  strong?: boolean | undefined;
  /** Filled glyph. For media transport (play, pause, stop, skip), so a toggle never mixes fill and outline. */
  solid?: boolean | undefined;
  /**
   * Mirror in right-to-left text. Defaults to the registry: every DIRECTIONAL glyph (arrows, chevrons,
   * undo, send, sign out, lists…) mirrors by itself. Pass `false` for a glyph that must keep pointing
   * the same way on screen.
   */
  mirror?: boolean | undefined;
}

/**
 * A lucide glyph at a token size with Linkyo's stroke (see `iconStroke`). DIRECTIONAL glyphs mirror in
 * right-to-left text (`MIRROR_IN_RTL`), so a left-to-right island inside an
 * Arabic page (a German page in a preview) keeps its arrows as they are.
 *
 * `data-icon-dir` marks every DIRECTIONAL glyph: "mirror" when it mirrors, "fixed" when a caller told
 * it not to. The right-to-left e2e check (e2e/icons-rtl-app.spec.ts) reads it to count each glyph's
 * flips on the real screens.
 */
export function Icon({ icon: Glyph, size = "md", className, label, strong = false, solid = false, mirror }: IconProps) {
  const directional = DIRECTIONAL.has(Glyph);
  const mirrored = mirror ?? directional;
  return (
    <Glyph
      className={cn("shrink-0", sizeClass[size], mirrored && MIRROR_IN_RTL, className)}
      strokeWidth={iconStroke(size, strong)}
      fill={solid ? "currentColor" : "none"}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      data-mirror={mirrored ? "" : undefined}
      data-icon-dir={directional ? (mirrored ? "mirror" : "fixed") : undefined}
    />
  );
}

export interface PlatformIconProps {
  icon: SimpleIcon;
  size?: IconSize | undefined;
  className?: string | undefined;
  /** Show the platform's brand color (hover/press or when the creator enables brand colors). */
  brandColor?: "never" | "hover" | "always" | undefined;
  label?: string | undefined;
}

/** Simple Icons platform logo: official shape, monochrome by default (brand §8). Logos never mirror. */
export function PlatformIcon({ icon, size = "md", className, brandColor = "never", label }: PlatformIconProps) {
  const style = { "--platform-color": `#${icon.hex}` } as CSSProperties;
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        "shrink-0 fill-current",
        sizeClass[size],
        brandColor === "always" && "fill-(--platform-color)",
        brandColor === "hover" && "transition-colors duration-micro group-hover:fill-(--platform-color) group-active:fill-(--platform-color)",
        className,
      )}
      style={style}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
    >
      <path d={icon.path} />
    </svg>
  );
}
