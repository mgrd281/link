import { AREA_END, BASELINE, GUTTER, MARGIN, TYPE } from "../print-tokens";

import { textRuns } from "./flow";
import { capHeight, measure, type Metrics } from "./measure";
import type { Box } from "./types";
import { wrap } from "./wrap";

/** What both documents share: the footer on every page and the running head on later pages. */

const SEPARATOR = "\u00A0· ";

/**
 * The footer: the person and the document at the start ("Jonas Brandt · Lebenslauf"), and at the end
 * what the document has of "Stand …", the public address (a link) and "Seite x von y". When a long
 * name and a long address would meet, the end moves to a line of its own under the start, so the two
 * never print over each other; both lines stay on the footer's baseline and above it.
 */
export function footer({ start, end, metrics }: { start: string; end: { text: string; uri?: string }[]; metrics: Metrics }): Box[] {
  const style = TYPE.footer;
  const text = end.map((part) => part.text).join(SEPARATOR);
  const x = AREA_END - measure(text, style, metrics);
  const startWidth = measure(start, style, metrics);
  const apart = end.length === 0 || MARGIN.start + startWidth + GUTTER <= x;
  const startLines = wrap(start, style, AREA_END - MARGIN.start, metrics);
  // Two lines: the start one leading above the footer's baseline, the end on it.
  const startBaseline = apart ? BASELINE.footer - (startLines.length - 1) * style.leading : BASELINE.footer - startLines.length * style.leading;
  const boxes: Box[] = textRuns(startLines, MARGIN.start, startBaseline, style, metrics);
  if (end.length === 0) return boxes;
  boxes.push(...textRuns([text], x, BASELINE.footer, style, metrics));
  end.forEach((part, index) => {
    if (!part.uri) return;
    const prefix = index === 0 ? "" : `${end.slice(0, index).map((before) => before.text).join(SEPARATOR)}${SEPARATOR}`;
    const offset = prefix === "" ? 0 : measure(prefix, style, metrics) + style.tracking * style.size;
    boxes.push({ kind: "link", x: x + offset, y: BASELINE.footer - capHeight(style, metrics), w: measure(part.text, style, metrics), h: style.leading, uri: part.uri });
  });
  return boxes;
}

/** Pages after the first: the person and the document at the top, its cap height at the running head's line. */
export function runningHead(text: string, metrics: Metrics): Box[] {
  const style = TYPE.footer;
  return textRuns([text], MARGIN.start, BASELINE.runningHead + capHeight(style, metrics), style, metrics);
}
