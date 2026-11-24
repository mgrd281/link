import { justifyRows, pictureRatio, type JustifiedRow } from "@linkyo/blocks/project";
import { tokens } from "@linkyo/tokens";
import { cn } from "@linkyo/ui";
import type { CSSProperties, ReactNode } from "react";

/**
 * Rows of equal height with every picture uncropped (Leuchttisch's work, its gallery). One flex list
 * whose items grow by their ratio and keep it (`aspect-ratio`), so each line is as tall as its width
 * allows and every picture in it stands as tall as its neighbours. Where a line ends is decided by
 * `justifyRows` for two widths, the phone and the canvas, and drawn as a zero-height break that fills
 * a line of its own (one set shown below the canvas width, the other from it on). The last line never
 * stretches: a filler of the missing ratio takes the rest. Breaks and fillers are hidden from screen
 * readers; the list counts only its pictures.
 */

/** The row a phone aims for: its column (390 minus the gutters) over the row height (`size.row-photo`). */
export const PHONE_ROW = (tokens.layout.preview - 2 * tokens.spacing.creatorGutter) / tokens.size.rowPhoto;
/** The row the canvas aims for: layout.work over the row height. Wider screens keep the rows and grow them. */
export const WIDE_ROW = tokens.layout.work / tokens.size.rowPhoto;

export interface JustifiedItem {
  key: string;
  ratio: number;
}

interface Layout {
  rows: JustifiedRow[];
  /** Indexes after which a line ends (not the last item). */
  ends: Set<number>;
  /** What the last line lacks to the target, or 0 when it is full. */
  fill: number;
}

function layout(ratios: readonly number[], target: number): Layout {
  const rows = justifyRows(ratios, target);
  const ends = new Set(rows.slice(0, -1).map((row) => row.items.at(-1)?.index ?? -1));
  const last = rows.at(-1);
  const fill = last?.short ? last.aspect - last.items.reduce((sum, item) => sum + item.ratio, 0) : 0;
  return { rows, ends, fill };
}

/** A picture's share of its line, by layout: for `sizes`. */
function shares(rows: readonly JustifiedRow[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const row of rows) for (const item of row.items) out.set(item.index, item.ratio / row.aspect);
  return out;
}

const px = (n: number): string => `${String(Math.round(n))}px`;
const vw = (share: number): string => `${String(Math.max(1, Math.round(share * 100)))}vw`;

/**
 * `sizes` for a picture of a justified line: its share of the phone's width, of the screen on the
 * canvas, and of layout.wall beyond it (`full`), or of layout.work (`wide`).
 */
function sizesOf(phone: number, wide: number, canvas: "work" | "wall"): string {
  const max = canvas === "wall" ? tokens.layout.wall : tokens.layout.work;
  return `(min-width: ${px(max)}) ${px(wide * max)}, (min-width: ${px(tokens.layout.work)}) ${vw(wide)}, (min-width: ${px(tokens.layout.creator)}) ${px(phone * tokens.layout.creator)}, ${vw(phone)}`;
}

/** The ratio a justified line draws a picture at: its own, else 3:2. */
export const ratioOf = (image: { w?: number | undefined; h?: number | undefined } | undefined): number => (image ? pictureRatio(image) : 1.5);

export function JustifiedRows<T extends JustifiedItem>({
  items,
  label,
  canvas,
  className,
  render,
}: {
  items: readonly T[];
  /** The list's name ("Arbeiten", the gallery's title). */
  label?: string | undefined;
  /** Where the rows run on wide screens: the wide canvas, or the wall (canvas "full"). */
  canvas: "work" | "wall";
  className?: string | undefined;
  /** One item's content, drawn in a box of its ratio; `sizes` is its picture's hint. */
  render: (item: T, index: number, sizes: string) => ReactNode;
}): ReactNode {
  const ratios = items.map((item) => item.ratio);
  const phone = layout(ratios, PHONE_ROW);
  const wide = layout(ratios, WIDE_ROW);
  const phoneShares = shares(phone.rows);
  const wideShares = shares(wide.rows);
  const nodes: ReactNode[] = [];
  items.forEach((item, index) => {
    nodes.push(
      <li key={item.key} style={{ "--ratio": item.ratio } as CSSProperties} className="min-w-0 flex-[var(--ratio)_1_0%] pb-6 @work:pb-8">
        {render(item, index, sizesOf(phoneShares.get(index) ?? 1, wideShares.get(index) ?? 1, canvas))}
      </li>,
    );
    if (phone.ends.has(index)) nodes.push(<li key={`${item.key}-phone-break`} aria-hidden className="h-0 basis-full @work:hidden" />);
    if (wide.ends.has(index)) nodes.push(<li key={`${item.key}-wide-break`} aria-hidden className="hidden h-0 basis-full @work:block" />);
  });
  // The last line keeps a full line's height: a filler takes what it lacks.
  if (phone.fill > 0) nodes.push(<li key="phone-fill" aria-hidden style={{ "--fill": phone.fill } as CSSProperties} className="flex-[var(--fill)_1_0%] @work:hidden" />);
  if (wide.fill > 0) nodes.push(<li key="wide-fill" aria-hidden style={{ "--fill": wide.fill } as CSSProperties} className="hidden flex-[var(--fill)_1_0%] @work:block" />);
  return (
    <ul aria-label={label} className={cn("flex flex-wrap gap-x-2 @work:gap-x-3", className)}>
      {nodes}
    </ul>
  );
}
