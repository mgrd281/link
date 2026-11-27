import { tokens } from "@linkyo/tokens";

import type { Face, TextStyle, Tone } from "./layout/types";

/**
 * The `print` tokens (packages/tokens/tokens.json) in the layout's unit, the point: lengths there
 * are millimetres, type is in points already. Every measure of the paper comes from here; the
 * layout has no numbers of its own.
 */

const P = tokens.print;

/** Points in a millimetre. */
const POINTS_PER_MM = 72 / 25.4;
export const mm = (value: number): number => value * POINTS_PER_MM;
export const toMm = (points: number): number => points / POINTS_PER_MM;

export const PAGE = { width: mm(P.page.width), height: mm(P.page.height) };
export const MARGIN = { start: mm(P.margin.start), end: mm(P.margin.end), top: mm(P.margin.top) };

const AREA = PAGE.width - MARGIN.start - MARGIN.end;
/** The gutter between two grid columns. */
export const GUTTER = mm(P.grid.gutter);
const COLUMNS = P.grid.columns;
const COLUMN = (AREA - (COLUMNS - 1) * GUTTER) / COLUMNS;

/** Where grid column `n` (1–12) starts. */
export const columnX = (n: number): number => MARGIN.start + (n - 1) * (COLUMN + GUTTER);
/** The width of columns `from` to `to`, gutters between them included. */
export const span = (from: number, to: number): number => columnX(to) + COLUMN - columnX(from);
/** The right edge of the type area. */
export const AREA_END = MARGIN.start + AREA;

export const BASELINE = {
  footer: mm(P.baseline.footer),
  limit: mm(P.baseline.limit),
  runningHead: mm(P.baseline.runningHead),
  continue: mm(P.baseline.continue),
  letterContinue: mm(P.baseline.letterContinue),
  fit: mm(P.baseline.fit),
};

export const HEAD = {
  contactTop: mm(P.head.contactTop),
  contactPitch: mm(P.head.contactPitch),
  contactLabel: mm(P.head.contactLabel),
  contactUnderRule: mm(P.head.contactUnderRule),
};

export const RULE = {
  accentWidth: mm(P.rule.accentWidth),
  /** Already in points. */
  accentWeight: P.rule.accentWeight,
  /** Already in points. */
  markWeight: P.rule.markWeight,
  square: mm(P.rule.square),
};

export const SPACE = {
  role: mm(P.space.role),
  status: mm(P.space.status),
  rule: mm(P.space.rule),
  figures: mm(P.space.figures),
  body: mm(P.space.body),
  section: mm(P.space.section),
  sectionTight: mm(P.space.sectionTight),
  row: mm(P.space.row),
  entry: mm(P.space.entry),
  entryTight: mm(P.space.entryTight),
  paragraph: mm(P.space.paragraph),
  skillText: mm(P.space.skillText),
  skillRow: mm(P.space.skillRow),
  figureLabel: mm(P.space.figureLabel),
};

export const PHOTO = { width: mm(P.photo.width), height: mm(P.photo.height), x: mm(P.photo.x) };

export const DIN = {
  letterheadTop: mm(P.din.letterheadTop),
  roleGap: mm(P.din.roleGap),
  address: { x: mm(P.din.addressX), y: mm(P.din.addressY), w: mm(P.din.addressWidth), h: mm(P.din.addressHeight) },
  info: { x: mm(P.din.infoX), top: mm(P.din.infoTop), w: mm(P.din.infoWidth), label: mm(P.din.infoLabel) },
  line: mm(P.din.line),
  subjectTop: mm(P.din.subjectTop),
  subjectGap: mm(P.din.subjectGap),
  signature: mm(P.din.signature),
  folds: [mm(P.din.foldTop), mm(P.din.foldBottom)],
  punch: mm(P.din.punch),
  markX: mm(P.din.markX),
  foldLength: mm(P.din.foldLength),
  punchLength: mm(P.din.punchLength),
};

/** The miniature works in millimetres (the SVG's viewBox is the A4 sheet). */
export const MINIATURE = { contactBar: P.miniature.contactBar, barHeight: P.miniature.barHeight, precision: P.miniature.precision, page: P.page };

type TypeName = keyof typeof P.type;
const isFace = (value: string): value is Face => value === "regular" || value === "semibold" || value === "bold";
const isTone = (value: string): value is Tone => value === "ink" || value === "muted" || value === "accent" || value === "strong";

function style(name: TypeName): TextStyle {
  const token = P.type[name];
  const face: string = token.face;
  const tone: string = token.tone;
  if (!isFace(face) || !isTone(tone)) throw new Error(`print.type.${name}: unknown face or tone`);
  return { face, size: token.size, leading: token.leading, tracking: token.tracking, tone };
}

/** Every type style of the paper, by its token name. */
export const TYPE = Object.fromEntries((Object.keys(P.type) as TypeName[]).map((name) => [name, style(name)])) as Record<TypeName, TextStyle>;
