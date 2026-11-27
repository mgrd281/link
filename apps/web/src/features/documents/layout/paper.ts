import { AREA_END, BASELINE, MARGIN, TYPE } from "../print-tokens";

import { textRuns } from "./flow";
import { capHeight, measure, type Metrics } from "./measure";
import type { Box } from "./types";

/** What both documents share: the footer on every page and the running head on later pages. */

const SEPARATOR = "\u00A0· ";

/**
 * The footer: the person and the document at the start ("Jonas Brandt · Lebenslauf"), and at the end
 * what the document has of "Stand …", the public address (a link) and "Seite x von y".
 */
export function footer({ start, end, metrics }: { start: string; end: { text: string; uri?: string }[]; metrics: Metrics }): Box[] {
  const style = TYPE.footer;
  const boxes: Box[] = textRuns([start], MARGIN.start, BASELINE.footer, style, metrics);
  if (end.length === 0) return boxes;
  const text = end.map((part) => part.text).join(SEPARATOR);
  const x = AREA_END - measure(text, style, metrics);
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
