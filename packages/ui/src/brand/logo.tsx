import { useId } from "react";

import { cn } from "../lib/cn";
import { lockupGeometry as L, symbolGeometry as S, wordmarkGeometry as W } from "./logo-geometry";

interface LogoPartProps {
  className?: string | undefined;
  /** Accessible name. Omit when the logo sits next to visible "Linkyo" text. */
  title?: string | undefined;
}

function SymbolPaths({ id }: { id: string }) {
  return (
    <>
      <defs>
        <clipPath id={`${id}-la`}>
          <path d={S.longCut.area} />
        </clipPath>
        <clipPath id={`${id}-sa`}>
          <path d={S.shortCut.area} />
        </clipPath>
        <mask id={`${id}-l`} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <path d="M0 0h32v32H0z" fill="white" />
          <path d={S.longCut.band} fillRule="evenodd" clipPath={`url(#${id}-la)`} fill="black" />
        </mask>
        <mask id={`${id}-s`} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <path d="M0 0h32v32H0z" fill="white" />
          <path d={S.shortCut.band} fillRule="evenodd" clipPath={`url(#${id}-sa)`} fill="black" />
        </mask>
      </defs>
      <path d={S.long} fill="currentColor" fillRule="evenodd" mask={`url(#${id}-l)`} />
      <path d={S.short} fill="currentColor" fillRule="evenodd" mask={`url(#${id}-s)`} />
    </>
  );
}

/** "The Loop": two interlocking links forming a lowercase y. Min size 16 px. */
export function LogoSymbol({ className, title }: LogoPartProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={S.viewBox}
      className={cn("aspect-square h-6 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <SymbolPaths id={id} />
    </svg>
  );
}

/** "linkyo" wordmark (Geist Bold, −2 % tracking). Min width 64 px. */
export function LogoWordmark({ className, title }: LogoPartProps) {
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
 * Horizontal lockup. Height drives everything; clear space = height of the "o".
 * Symbol and wordmark share the full ascender→descender height so the y's line up.
 */
export function Logo({ className, title = "Linkyo" }: LogoPartProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox={L.viewBox} role="img" aria-label={title} className={cn("h-6 w-auto shrink-0 text-fg", className)}>
      <g transform={L.symbolTransform}>
        <SymbolPaths id={id} />
      </g>
      <path d={W.d} fill="currentColor" transform={L.wordmarkTransform} />
    </svg>
  );
}
