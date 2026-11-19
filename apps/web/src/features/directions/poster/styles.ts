import type { CreatorButtonStyle } from "@linkyo/tokens";
import type { HeadingStyle } from "@linkyo/tokens/creator";
import { cn } from "@linkyo/ui";
import type { CSSProperties } from "react";

/** The creator's display face with its pairing's weight, tracking and case. */
export const displayStyle: CSSProperties = {
  fontWeight: "var(--creator-display-weight)",
  letterSpacing: "var(--creator-display-tracking)",
  textTransform: "var(--creator-display-transform)",
};

/** Media cards follow the creator's button style. "Filled" stays soft so the artwork remains the loudest thing. */
export const cardSurface: Record<CreatorButtonStyle, string> = {
  filled: "bg-creator-surface-2",
  soft: "bg-creator-surface-2",
  outline: "border border-creator-line-strong",
  glass: "border border-creator-line bg-creator-glass backdrop-blur-glass",
  shadow: "border border-creator-line bg-creator-surface",
  minimal: "border-b border-creator-line",
};

/** Hover/press feedback in currentColor: works on every surface, theme and photo. */
export const pressable = cn(
  "relative isolate transition-[scale] duration-standard ease-standard active:scale-pressed motion-reduce:active:scale-none",
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-current after:opacity-0",
  "after:transition-opacity after:duration-micro hover:after:opacity-hover active:after:opacity-pressed",
  "focus-visible:focus-ring",
);

/** Section titles per template: the display face, or the body face in title case or in caps. */
export function sectionTitle(style: HeadingStyle): { className: string; style?: CSSProperties } {
  if (style === "display") return { className: "font-creator-display text-h2 leading-tight", style: displayStyle };
  return { className: cn("font-creator-body text-h3 leading-tight font-bold tracking-tight", style === "sans-upper" && "uppercase") };
}

/** Block titles sit one level below their section title (h2 at the top of the page, h3 inside a section). */
export type HeadingTag = "h2" | "h3";

/** Horizontal scrollers bleed to the screen edge on phones and align with the column on wide screens. */
export const railFrame = "-mx-creator-gutter min-w-0 rounded-creator-card focus-visible:focus-ring @prose:mx-0";
export const railTrack = "snap-x snap-mandatory scroll-px-creator-gutter overflow-x-auto px-creator-gutter pb-1 @prose:scroll-px-0 @prose:px-0";
