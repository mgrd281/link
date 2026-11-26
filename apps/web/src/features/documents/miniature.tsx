import { cn } from "@linkyo/ui";
import type { ReactNode } from "react";

import type { MiniatureMark } from "./offer";

/** Each tone's fill: the page's own colours, as the paper prints them. */
const FILL: Record<MiniatureMark["tone"], string> = {
  ink: "fill-creator-fg",
  accent: "fill-creator-accent-text",
  strong: "fill-creator-line-strong",
  muted: "fill-creator-line",
};
const TONES = Object.keys(FILL) as MiniatureMark["tone"][];

/**
 * A document's first page in miniature (the page's Unterlagen cards): white A4 paper with greeked
 * bars where the PDF sets its text, rules and squares, drawn from the PDF's own layout (miniature.ts).
 * It holds no text and no contact data, only numbers and tones. Without marks (the owner's own file,
 * or before the layout is known) it is a blank sheet. Pure SVG, no hooks: safe in client modules.
 * Decorative: the card's words name the document.
 */
export function PaperMiniature({ marks, className }: { marks: readonly MiniatureMark[] | null; className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 210 297" aria-hidden="true" focusable="false" className={cn("block", className)}>
      <rect width="210" height="297" className="fill-white" />
      {marks
        ? TONES.map((tone) => {
            const bars = marks.filter((mark) => mark.tone === tone);
            return bars.length > 0 ? (
              <g key={tone} className={FILL[tone]}>
                {bars.map((mark, index) => (
                  <rect key={index} x={mark.x} y={mark.y} width={mark.w} height={mark.h} rx="0.6" />
                ))}
              </g>
            ) : null;
          })
        : null}
    </svg>
  );
}
