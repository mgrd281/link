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

/** The body's boxes per page (page 0 is the first). With an infinite limit, one page and its last baseline. */
export function flow(sections: readonly FlowSection[], options: FlowOptions): { pages: Box[][]; lastBaseline: number } {
  const pages: Box[][] = [[]];
  let y = options.start;
  let pageStart = true;
  let lastBaseline = options.start;
  const place = (unit: Unit, top: number, title: FlowSection["title"]) => {
    const page = pages.at(-1);
    if (!page) return;
    page.push(...unit.boxes.map((box) => shift(box, top)));
    if (title) page.push(...title(top + unit.first));
    lastBaseline = top + unit.last;
    y = top + unit.height;
    pageStart = false;
  };
  const newPage = () => {
    pages.push([]);
    y = options.restart;
    pageStart = true;
  };
  for (const section of sections) {
    let gap = 0;
    section.units.forEach((original, index) => {
      // The title's own depth below the first baseline counts for the first unit.
      const unit = index === 0 && section.title ? { ...original, height: Math.max(original.height, original.first + section.titleDepth) } : original;
      const before = index === 0 ? (pageStart ? 0 : options.sectionGap) : gap;
      let top = y + before;
      const titleHere = index === 0 || pageStart;
      if (top + unit.last > options.limit) {
        const parts = pageStart ? null : unit.split?.(options.limit - top);
        if (parts) {
          place(parts[0], top, titleHere ? section.title : null);
          newPage();
          place(parts[1], y, section.title);
          gap = parts[1].gapAfter;
          return;
        }
        if (!pageStart) {
          newPage();
          top = y;
        }
        place(unit, top, section.title);
      } else {
        place(unit, top, titleHere ? section.title : null);
      }
      gap = unit.gapAfter;
    });
  }
  return { pages, lastBaseline };
}
