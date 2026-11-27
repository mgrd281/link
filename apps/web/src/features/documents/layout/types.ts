/**
 * A laid-out document: pages of boxes in points, from the top-left corner of an A4 sheet (y grows
 * downwards). Two renderers read the same boxes: the PDF (pdf/render.ts) and the page's miniature
 * (miniature.ts), so the thumbnail is the paper's own layout.
 */

export type Face = "regular" | "semibold" | "bold";
/** Paper colours: the page's light palette (ink = creator-fg, muted = fg-muted, accent = accent-text, strong = line-strong). */
export type Tone = "ink" | "muted" | "accent" | "strong";

export interface TextStyle {
  face: Face;
  /** Points. */
  size: number;
  /** Points. */
  leading: number;
  /** Em (applied as character spacing, Tc = tracking × size). */
  tracking: number;
  tone: Tone;
}

export interface TextRun {
  kind: "text";
  x: number;
  /** The baseline. */
  y: number;
  text: string;
  style: TextStyle;
  /** Measured width (advances × size + tracking between characters). */
  width: number;
  /** A contact value (phone, e-mail, address): the miniature draws it at one fixed width, whatever its length. */
  contact?: boolean;
}

export interface RectBox {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
}

export interface LineBox {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Points. */
  weight: number;
  tone: Tone;
}

export interface ImageBox {
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LinkBox {
  kind: "link";
  x: number;
  y: number;
  w: number;
  h: number;
  uri: string;
}

export type Box = TextRun | RectBox | LineBox | ImageBox | LinkBox;

export interface LaidPage {
  boxes: Box[];
}

export type DocumentPart = "cv" | "letter";

export interface LaidDocument {
  part: DocumentPart;
  pages: LaidPage[];
  /** Whether the layout took the fit step (tighter spacing, a smaller letter face) to stay on fewer pages. */
  fitted: boolean;
}
