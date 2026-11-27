import type { TrueTypeFont } from "../font/ttf";
import { LAST_CODE, NBSP, SOFT_HYPHEN_CODE, unicodeOf, winAnsiCode } from "../font/winansi";

import type { Face, TextStyle } from "./types";

/**
 * What the layout knows of a face: each WinAnsi code's advance (from the font's cmap and hmtx), the
 * vertical metrics and the widest digit. Pure: the server reads the fonts once (pdf/fonts.ts) and
 * the tests read the same files.
 */
export interface FaceMetrics {
  /** Advance of each code 0x00–0xFF in thousandths of an em (0 where WinAnsi has no character). */
  widths: readonly number[];
  /** In em. */
  ascender: number;
  /** In em, negative. */
  descender: number;
  capHeight: number;
  xHeight: number;
}

export type Metrics = Record<Face, FaceMetrics>;

const SPACE_CODE = 0x20;
const HYPHEN_CODE = 0x2d;

/**
 * The Unicode character a viewer draws for a code: WinAnsi's own, except 0xA0, which PDF draws as
 * the space glyph, and 0xAD, which it draws as the hyphen (ISO 32000-1, Annex D).
 */
export function drawnUnicode(code: number): number | null {
  if (code === 0xa0) return SPACE_CODE;
  if (code === SOFT_HYPHEN_CODE) return HYPHEN_CODE;
  return unicodeOf(code);
}

export function faceMetrics(font: TrueTypeFont): FaceMetrics {
  const scale = 1000 / font.unitsPerEm;
  const widths = Array.from({ length: LAST_CODE + 1 }, (_, code) => {
    const unicode = drawnUnicode(code);
    return unicode === null ? 0 : Math.round(font.advanceOf(font.glyphOf(unicode)) * scale);
  });
  return {
    widths,
    ascender: font.ascender / font.unitsPerEm,
    descender: font.descender / font.unitsPerEm,
    capHeight: font.capHeight / font.unitsPerEm,
    xHeight: font.xHeight / font.unitsPerEm,
  };
}

/** The WinAnsi code a character is drawn with: a no-break space is a space (it only matters to line breaking). */
export function codeOf(char: string): number {
  if (char === NBSP) return SPACE_CODE;
  return winAnsiCode(char) ?? SPACE_CODE;
}

/**
 * A character's advance in thousandths of an em. Digits keep Geist's own (proportional) advances: set
 * in fixed cells with TJ gaps, text extractors and applicant tracking systems read "2019" as
 * "20 1 9" (ADR draft-laufbahn-pdfs); tabular figures come with subsetting (glyph access).
 */
export const advance = (char: string, face: FaceMetrics): number => face.widths[codeOf(char)] ?? 0;

/** A text's width in points: Σ advances × size / 1000 + (n − 1) × tracking × size. */
export function measure(text: string, style: TextStyle, metrics: Metrics): number {
  const face = metrics[style.face];
  let units = 0;
  let count = 0;
  for (const char of text) {
    units += advance(char, face);
    count += 1;
  }
  return (units * style.size) / 1000 + Math.max(0, count - 1) * style.tracking * style.size;
}

/** Distance from the top of a line box (height = leading) to its baseline, as CSS sets it (half-leading). */
export function baselineOffset(style: TextStyle, metrics: Metrics): number {
  const face = metrics[style.face];
  const content = (face.ascender - face.descender) * style.size;
  return (style.leading - content) / 2 + face.ascender * style.size;
}

/** The cap height of a style in points. */
export const capHeight = (style: TextStyle, metrics: Metrics): number => metrics[style.face].capHeight * style.size;
