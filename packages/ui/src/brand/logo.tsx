import { useId } from "react";

import { cn } from "../lib/cn";
import { lockupGeometry as L, symbolGeometry as S, wordmarkGeometry as W } from "./logo-geometry";

interface LogoPartProps {
  className?: string | undefined;
  /** Accessible name. Omit when the logo sits next to visible "Linkyo" text. */
  title?: string | undefined;
  /**
   * "brand" (default): the tile in Linkyo Teal (lighter teal in dark mode).
   * "mono": everything in the current text color, for teal or photo backgrounds and creator pages.
   */
  tone?: "brand" | "mono";
}

/**
 * The tile with the y cut out of it, so the y always shows what lies behind (white page, teal card,
 * dark mode). The long arm ends in a soft hook; around the short arm the tile stays: the link point.
 */
function SymbolShape({ id }: { id: string }) {
  return (
    <>
      <defs>
        <mask id={`${id}-y`} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <path d="M0 0h32v32H0z" fill="white" />
          <path d={S.long} fill="none" stroke="black" strokeWidth={S.stroke} strokeLinecap="round" strokeLinejoin="round" />
          <path d={S.short} fill="none" stroke="white" strokeWidth={S.stroke + S.gap * 2} strokeLinecap="round" />
          <path d={S.short} fill="none" stroke="black" strokeWidth={S.stroke} strokeLinecap="round" />
        </mask>
      </defs>
      <path d={S.tile} fill="currentColor" mask={`url(#${id}-y)`} />
    </>
  );
}

/** "The Linkyo y": a teal tile with a y whose long arm ends in a soft hook. Min size 16 px. */
export function LogoSymbol({ className, title, tone = "brand" }: LogoPartProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={S.viewBox}
      className={cn("aspect-square h-6 shrink-0", tone === "brand" && "text-primary", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <SymbolShape id={id} />
    </svg>
  );
}

/** "linkyo" wordmark (Geist SemiBold, +0.5 % tracking). Min width 64 px. */
export function LogoWordmark({ className, title }: Omit<LogoPartProps, "tone">) {
  return (
    <svg
      viewBox={W.viewBox}
      className={cn("h-6 w-auto shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={W.d} fill="currentColor" />
    </svg>
  );
}

/**
 * Horizontal lockup: the tile, a little taller than the word, then "linkyo" centred beside it.
 * Height drives everything; clear space = a quarter of the tile.
 */
export function Logo({ className, title = "Linkyo", tone = "brand" }: LogoPartProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox={L.viewBox} role="img" aria-label={title} className={cn("h-6 w-auto shrink-0 text-fg", className)}>
      <g transform={L.symbolTransform} className={tone === "brand" ? "text-primary" : undefined}>
        <SymbolShape id={id} />
      </g>
      <path d={W.d} fill="currentColor" transform={L.wordmarkTransform} />
    </svg>
  );
}

/** The y on its own, in the current text color (app icons: the system draws the tile). */
export function LogoGlyph({ className, title }: Omit<LogoPartProps, "tone">) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={S.viewBox}
      className={cn("aspect-square h-6 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <mask id={`${id}-g`} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <path d="M0 0h32v32H0z" fill="white" />
          <path d={S.short} fill="none" stroke="black" strokeWidth={S.stroke + S.gap * 2} strokeLinecap="round" />
        </mask>
      </defs>
      <path d={S.long} fill="none" stroke="currentColor" strokeWidth={S.stroke} strokeLinecap="round" strokeLinejoin="round" mask={`url(#${id}-g)`} />
      <path d={S.short} fill="none" stroke="currentColor" strokeWidth={S.stroke} strokeLinecap="round" />
    </svg>
  );
}
