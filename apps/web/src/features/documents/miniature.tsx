import type { ReactNode } from "react";

import type { MiniatureMark } from "./offer";

/** Each mark's tone as a fill from the page's own palette (paper is white whatever the page's mode). */
const TONE: Record<MiniatureMark["tone"], string> = {
  ink: "fill-creator-fg",
  accent: "fill-creator-accent-text",
  strong: "fill-creator-line-strong",
  muted: "fill-creator-line",
};

/** The paper's corner radius in mm, and its size: A4. */
const BAR_RADIUS = 0.6;
const A4 = { width: 210, height: 297 };

/**
 * A document's first page as a thumbnail (Laufbahn's Unterlagen cards): white paper with greeked bars
 * laid out from the PDF's own boxes (`MiniatureMark`, mm on A4), never any text. Without marks (the
 * owner's own file, or before the layout is known) a blank sheet. Decorative: the card's words name
 * the document. Pure SVG, no hooks, safe in client modules.
 */
export function PaperMiniature({ marks, className }: { marks: readonly MiniatureMark[] | null; className?: string }): ReactNode {
  return (
    <svg viewBox={`0 0 ${String(A4.width)} ${String(A4.height)}`} aria-hidden="true" focusable="false" className={className}>
      <rect width={A4.width} height={A4.height} className="fill-white" />
      {(marks ?? []).map((mark, index) => (
        <rect key={index} x={mark.x} y={mark.y} width={mark.w} height={mark.h} rx={BAR_RADIUS} className={TONE[mark.tone]} />
      ))}
    </svg>
  );
}
