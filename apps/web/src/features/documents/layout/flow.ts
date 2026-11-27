import { baselineOffset, measure, type Metrics } from "./measure";
import type { Box, TextStyle } from "./types";
import { wrap } from "./wrap";

/**
 * How a document's body runs over pages: it is a list of sections, each a list of units (a
 * paragraph, a row of facts, a career entry, a row of skills, a closing). Units are built from the
 * top of their first line box (y 0) and moved into place; only paragraphs split, and never leave a
 * single line on either side. A section's title stays with its first unit and is repeated beside a
 * unit that continues it on a new page.
 */

export interface Unit {
  /** From the top of the first line box to the bottom of the last. */
  height: number;
  /** The first and last baselines, from the unit's top. */
  first: number;
  last: number;
  boxes: Box[];
  /** Space before the next unit of the same section. */
  gapAfter: number;
  /** Paragraphs only: the part that fits above `available` (a baseline offset from the unit's top) and the rest. */
  split?: (available: number) => [Unit, Unit] | null;
}

export interface FlowSection {
  /** The title in the first three columns, sharing its first unit's first baseline (null: none). */
  title: ((baseline: number) => Box[]) | null;
  /** How far the title's lines reach below its first baseline. */
  titleDepth: number;
  units: Unit[];
}

export const shift = (box: Box, dy: number): Box => {
  switch (box.kind) {
    case "line":
      return { ...box, y1: box.y1 + dy, y2: box.y2 + dy };
    default:
      return { ...box, y: box.y + dy };
  }
};

/** Lines of one style at `x`, the first baseline at `baseline`. */
export function textRuns(lines: readonly string[], x: number, baseline: number, style: TextStyle, metrics: Metrics, extra: { contact?: boolean } = {}): Box[] {
  return lines.map((text, index) => ({
    kind: "text" as const,
    x,
    y: baseline + index * style.leading,
    text,
    style,
    width: measure(text, style, metrics),
    ...(extra.contact ? { contact: true } : {}),
    ...(extra.contact && index > 0 ? { continued: true } : {}),
  }));
}

/**
 * A paragraph as a unit: its lines in line boxes of the style's leading. It splits with at least two
 * lines on each side (a paragraph of three lines or fewer moves whole).
 */
export function paragraphUnit(lines: readonly string[], x: number, style: TextStyle, metrics: Metrics, gapAfter: number): Unit {
  const offset = baselineOffset(style, metrics);
  const unit: Unit = {
    height: lines.length * style.leading,
    first: offset,
    last: offset + (lines.length - 1) * style.leading,
    boxes: textRuns(lines, x, offset, style, metrics),
    gapAfter,
  };
  if (lines.length >= 4) {
    unit.split = (available) => {
      const fit = Math.floor((available - offset) / style.leading) + 1;
      const keep = Math.min(fit, lines.length - 2);
      if (keep < 2) return null;
      return [paragraphUnit(lines.slice(0, keep), x, style, metrics, 0), paragraphUnit(lines.slice(keep), x, style, metrics, gapAfter)];
    };
  }
  return unit;
}

/** A section title: wrapped in its column, in the section style. */
export function titleOf(text: string, x: number, width: number, style: TextStyle, metrics: Metrics): Pick<FlowSection, "title" | "titleDepth"> {
  const lines = wrap(text, style, width, metrics);
  return {
    title: (baseline) => textRuns(lines, x, baseline, style, metrics),
    titleDepth: (lines.length - 1) * style.leading + (style.leading - baselineOffset(style, metrics)),
  };
}

export interface FlowOptions {
  /** The first page's body starts here (top of its first line box). */
  start: number;
  /** Later pages' body starts here. */
  restart: number;
  /** No baseline below this. */
  limit: number;
  /** Space between sections. */
  sectionGap: number;
}

/**
 * The body's boxes per page (page 0 is the first). With an infinite limit, one page and its last
 * baseline. No unit is placed past the limit while a split or a new page can avoid it: a paragraph
 * splits (again on the next page if it is longer than a page), anything else moves to a new page
 * whole. Only a unit that cannot split and is taller than a whole page stands past the limit.
 */
export function flow(sections: readonly FlowSection[], options: FlowOptions): { pages: Box[][]; lastBaseline: number } {
  const pages: Box[][] = [[]];
  let y = options.start;
  // Nothing placed on this page yet: no gap before its first unit, and a section's title stands again.
  let fresh = true;
  let lastBaseline = options.start;
  const place = (unit: Unit, top: number, title: FlowSection["title"]) => {
    const page = pages.at(-1);
    if (!page) return;
    // Reading order: a section's title before its first row.
    if (title) page.push(...title(top + unit.first));
    page.push(...unit.boxes.map((box) => shift(box, top)));
    lastBaseline = top + unit.last;
    y = top + unit.height;
    fresh = false;
  };
  const newPage = () => {
    pages.push([]);
    y = options.restart;
    fresh = true;
  };
  for (const section of sections) {
    let gap = 0;
    section.units.forEach((original, index) => {
      // The title's own depth below the first baseline counts for the first unit.
      let unit = index === 0 && section.title ? { ...original, height: Math.max(original.height, original.first + section.titleDepth) } : original;
      let before = index === 0 ? (fresh ? 0 : options.sectionGap) : gap;
      for (;;) {
        const top = y + before;
        const title = index === 0 || fresh ? section.title : null;
        if (top + unit.last <= options.limit) {
          place(unit, top, title);
          break;
        }
        const parts = unit.split?.(options.limit - top);
        if (parts) {
          place(parts[0], top, title);
          newPage();
          unit = parts[1];
          before = 0;
          continue;
        }
        // A later page with nothing on it yet has no more room to offer: the unit stands here.
        if (!fresh || pages.length === 1) {
          newPage();
          before = 0;
          continue;
        }
        place(unit, top, title);
        break;
      }
      gap = unit.gapAfter;
    });
  }
  return { pages, lastBaseline };
}
