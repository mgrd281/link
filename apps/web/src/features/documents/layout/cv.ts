import type { DocumentInput, Fact, TimelineItem } from "../input";
import type { PaperLabels } from "../labels";
import { splitFigure } from "../offer";
import { BASELINE, columnX, GUTTER, HEAD, MARGIN, PHOTO, RULE, SPACE, span, TYPE } from "../print-tokens";

import { flow, paragraphUnit, textRuns, titleOf, type FlowSection, type Unit } from "./flow";
import { baselineOffset, capHeight, measure, type Metrics } from "./measure";
import { footer, runningHead } from "./paper";
import type { Box, LaidDocument, TextRun, TextStyle } from "./types";
import { wrap } from "./wrap";

/**
 * The Lebenslauf (CV): one type area from screen to paper. A head (name, role, availability, the
 * accent rule, the contact block top right, the figures), then four sections with their titles in the
 * first three columns: Profil, Eckdaten, Werdegang, Kenntnisse. Only what the page holds is printed
 * (input.ts). A real uploaded photo may stand top right; without one there is no picture, no
 * initials and no empty frame. Too long by at most an eighth of a page, it tightens (the fit step);
 * longer, it runs on to more pages.
 */

export interface CvOptions {
  metrics: Metrics;
  labels: PaperLabels;
  /** A real portrait the owner uploaded (its image box); never an illustration. */
  photo: boolean;
  /** The page's last save (public pages): the footer's "Stand". */
  asOf: Date | null;
}

const NB = "\u00A0";
const SEPARATOR = `${NB}· `;

const descent = (style: TextStyle, metrics: Metrics): number => -metrics[style.face].descender * style.size;

/** The columns the contact block may take at the top right: the last four, or one or two more for a long value. */
const CONTACT_COLUMNS = [9, 8, 7] as const;

/**
 * Where the head's contact block stands. Top right in the last four columns; a value too wide for
 * them (most e-mail addresses are) takes one or two columns more towards the start, as long as the
 * block stays a gutter clear of the head's words beside it (the name, role and status lines). A
 * value too wide for that, or a photo in the corner, puts the rows under the accent rule, label and
 * value on one line in the columns of the words (all twelve without a photo).
 */
function contactBlock(rows: readonly { value: string }[], words: readonly Box[], options: CvOptions): { x: number; width: number; under: boolean } {
  const { metrics } = options;
  const value = TYPE.contactValue;
  const under = { x: MARGIN.start, width: options.photo ? span(1, 8) : span(1, 12), under: true };
  if (options.photo || rows.length === 0) return under;
  const widest = Math.max(...rows.map((entry) => measure(entry.value, value, metrics)));
  // The head's lines that stand level with the block (its first cap top to its last descender).
  const top = HEAD.contactTop - capHeight(value, metrics);
  const foot = HEAD.contactTop + (rows.length - 1) * HEAD.contactPitch + descent(value, metrics);
  const level = words.filter((box): box is TextRun => box.kind === "text" && box.y - metrics[box.style.face].ascender * box.style.size < foot && box.y + descent(box.style, metrics) > top);
  const wordsEnd = Math.max(MARGIN.start, ...level.map((run) => run.x + run.width));
  const column = CONTACT_COLUMNS.find((from) => widest <= span(from, 12) - HEAD.contactLabel + 1e-6 && columnX(from) >= wordsEnd + GUTTER - 1e-6);
  return column === undefined ? under : { x: columnX(column), width: span(column, 12), under: false };
}

/** The head: its boxes and how far down it reaches. */
function head(input: DocumentInput, options: CvOptions): { boxes: Box[]; bottom: number } {
  const { metrics, labels } = options;
  const boxes: Box[] = [];
  const words = span(1, 8);
  // Name: at 27 pt it fits the eight columns, or steps down towards 20 pt, then wraps between words.
  const full = TYPE.name;
  const natural = measure(input.name, full, metrics);
  const size = Math.max(TYPE.nameMin.size, Math.min(full.size, natural > 0 ? (full.size * words) / natural : full.size));
  const name: TextStyle = { ...full, size, leading: size };
  const nameLines = wrap(input.name, name, words, metrics);
  let baseline = MARGIN.top + capHeight(name, metrics);
  boxes.push(...textRuns(nameLines, MARGIN.start, baseline, name, metrics));
  baseline += (nameLines.length - 1) * name.leading;
  let last: TextStyle = name;
  if (input.role) {
    const lines = wrap(input.role, TYPE.role, words, metrics);
    baseline += SPACE.role;
    boxes.push(...textRuns(lines, MARGIN.start, baseline, TYPE.role, metrics));
    baseline += (lines.length - 1) * TYPE.role.leading;
    last = TYPE.role;
  }
  if (input.status) {
    const lines = wrap(input.status, TYPE.status, words, metrics);
    baseline += SPACE.status;
    boxes.push(...textRuns(lines, MARGIN.start, baseline, TYPE.status, metrics));
    baseline += (lines.length - 1) * TYPE.status.leading;
    last = TYPE.status;
  }
  const ruleTop = baseline + SPACE.rule;
  boxes.push({ kind: "rect", x: MARGIN.start, y: ruleTop, w: RULE.accentWidth, h: RULE.accentWeight, tone: "accent" });
  let bottom = Math.max(baseline + descent(last, metrics), ruleTop + RULE.accentWeight);

  // The contact block: top right, or under the rule beside a photo.
  const rows: { label: string; value: string; uri: string | null; contact: boolean }[] = [
    ...(input.phone ? [{ label: labels.phone, value: input.phone.text, uri: input.phone.uri, contact: true }] : []),
    ...(input.email ? [{ label: labels.email, value: input.email.text, uri: input.email.uri, contact: true }] : []),
    ...(input.online ? [{ label: labels.online, value: input.online.text, uri: input.online.uri, contact: true }] : []),
    ...(input.location ? [{ label: labels.location, value: input.location, uri: null, contact: false }] : []),
  ];
  const value = TYPE.contactValue;
  const block = contactBlock(rows, boxes, options);
  let row = block.under ? ruleTop + RULE.accentWeight + HEAD.contactUnderRule + capHeight(value, metrics) : HEAD.contactTop;
  for (const entry of rows) {
    // A value stays on one line while it fits the block (it is copied from here); only a value wider
    // than the whole block breaks, as a last resort.
    const lines = wrap(entry.value, value, block.width - HEAD.contactLabel, metrics);
    boxes.push(...textRuns([entry.label], block.x, row, TYPE.contactLabel, metrics));
    const runs = textRuns(lines, block.x + HEAD.contactLabel, row, value, metrics, { contact: entry.contact });
    boxes.push(...runs);
    if (entry.uri) {
      const widest = Math.max(...runs.map((run) => (run.kind === "text" ? run.width : 0)));
      const top = row - capHeight(value, metrics) - descent(value, metrics);
      boxes.push({ kind: "link", x: block.x + HEAD.contactLabel, y: top, w: widest, h: (lines.length - 1) * HEAD.contactPitch + capHeight(value, metrics) + 2 * descent(value, metrics), uri: entry.uri });
    }
    row += lines.length * HEAD.contactPitch;
  }
  const contactBottom = rows.length > 0 ? row - HEAD.contactPitch + descent(value, metrics) : 0;
  if (options.photo) {
    boxes.push({ kind: "image", x: PHOTO.x, y: MARGIN.top, w: PHOTO.width, h: PHOTO.height });
    bottom = Math.max(bottom, contactBottom, MARGIN.top + PHOTO.height);
  } else {
    bottom = Math.max(bottom, contactBottom);
  }

  // The figures: three cells from columns 1, 4 and 7. They start under the rule, or under the contact
  // rows where those stand above them: under the rule beside a photo, or top right reaching down past
  // the rule into the columns of the figures' cells (a sparse head beside a wide block), so a figure
  // never sits right under a contact row and reads as one more.
  if (input.stats.length > 0) {
    const figures = input.stats.slice(0, 3).map((stat) => ({ ...stat, parts: splitFigure(stat.value) }));
    const cellsEnd = columnX(1 + (figures.length - 1) * 3) + span(1, 3);
    const above = rows.length > 0 && (block.under || block.x < cellsEnd);
    const top = Math.max(ruleTop + RULE.accentWeight, above ? contactBottom : 0) + SPACE.figures;
    const qualified = figures.some((figure) => figure.parts.kind === "number" && figure.parts.qualifier !== "");
    const valueTop = top + (qualified ? TYPE.figureQualifier.leading : 0);
    const numberBaseline = valueTop + baselineOffset(TYPE.figure, metrics);
    const cell = span(1, 3);
    let lowest = top;
    figures.forEach((figure, index) => {
      const fx = columnX(1 + index * 3);
      let valueBottom = valueTop + TYPE.figure.leading;
      if (figure.parts.kind === "number") {
        const { qualifier, number, unit, spaced } = figure.parts;
        if (qualifier) boxes.push(...textRuns([qualifier], fx, top + baselineOffset(TYPE.figureQualifier, metrics), TYPE.figureQualifier, metrics));
        const style = TYPE.figure;
        const runs = textRuns([number], fx, numberBaseline, style, metrics);
        boxes.push(...runs);
        // The unit at half size, right after the number; a no-break space of its own size before it
        // where the page has one too ("99,6 %", "12 Jahre"), drawn as a character, so copying and
        // extractors that read the characters keep it.
        if (unit) boxes.push(...textRuns([spaced ? `${NB}${unit}` : unit], fx + measure(number, style, metrics), numberBaseline, TYPE.figureUnit, metrics));
      } else {
        const lines = wrap(figure.parts.text, TYPE.figureWord, cell, metrics);
        boxes.push(...textRuns(lines, fx, numberBaseline, TYPE.figureWord, metrics));
        valueBottom = Math.max(valueBottom, numberBaseline + (lines.length - 1) * TYPE.figureWord.leading + descent(TYPE.figureWord, metrics));
      }
      const label = wrap(figure.label, TYPE.figureLabel, cell, metrics);
      const labelBaseline = valueBottom + SPACE.figureLabel + baselineOffset(TYPE.figureLabel, metrics);
      boxes.push(...textRuns(label, fx, labelBaseline, TYPE.figureLabel, metrics));
      lowest = Math.max(lowest, labelBaseline + (label.length - 1) * TYPE.figureLabel.leading + descent(TYPE.figureLabel, metrics));
    });
    bottom = Math.max(bottom, lowest);
  }
  return { boxes, bottom };
}

interface Spacing {
  section: number;
  entry: number;
  /** Facts two to a row (the fit step). */
  pairs: boolean;
}

/** A row of facts: label (muted) beside value, on the value's baseline. */
function factRow(facts: readonly Fact[], columns: readonly [number, number, number, number][], metrics: Metrics): Unit {
  const label = TYPE.label;
  const value = TYPE.value;
  const first = baselineOffset(value, metrics);
  const boxes: Box[] = [];
  let lines = 1;
  facts.forEach((fact, index) => {
    const [labelFrom, labelTo, valueFrom, valueTo] = columns[index] ?? columns[0] ?? [4, 5, 6, 12];
    const labelLines = wrap(fact.label, label, span(labelFrom, labelTo), metrics);
    const valueLines = wrap(fact.value, value, span(valueFrom, valueTo), metrics);
    boxes.push(...textRuns(labelLines, columnX(labelFrom), first, { ...label, leading: value.leading }, metrics));
    boxes.push(...textRuns(valueLines, columnX(valueFrom), first, value, metrics));
    lines = Math.max(lines, labelLines.length, valueLines.length);
  });
  return { height: lines * value.leading, first, last: first + (lines - 1) * value.leading, boxes, gapAfter: SPACE.row };
}

/** "2021 – heute" (the ongoing end in the accent), "2017 – 2020", or a single year. */
function yearRuns(item: TimelineItem, baseline: number, labels: PaperLabels, metrics: Metrics): Box[] {
  const style = TYPE.years;
  const x = columnX(4);
  if (item.to === null) return textRuns([String(item.from)], x, baseline, style, metrics);
  const start = `${String(item.from)}${NB}–${NB}`;
  const end = item.to === "now" ? labels.present : String(item.to);
  const head = textRuns([start], x, baseline, style, metrics);
  const tail = textRuns([end], x + measure(start, style, metrics) + style.tracking * style.size, baseline, item.to === "now" ? { ...style, tone: "accent" } : style, metrics);
  return [...head, ...tail];
}

/** A career entry: the years beside the role, the organisation (muted, a link when it has an address) and the note. Never split. */
function entryUnit(item: TimelineItem, spacing: Spacing, labels: PaperLabels, metrics: Metrics): Unit {
  const x = columnX(6);
  const width = span(6, 12);
  const title = TYPE.entryTitle;
  const entry = TYPE.entry;
  const first = baselineOffset(title, metrics);
  const boxes: Box[] = [...yearRuns(item, first, labels, metrics)];
  const roleLines = wrap(item.role, title, width, metrics);
  boxes.push(...textRuns(roleLines, x, first, title, metrics));
  let top = roleLines.length * title.leading;
  let last = first + (roleLines.length - 1) * title.leading;
  const add = (text: string | null, style: TextStyle, uri: string | null) => {
    if (!text) return;
    const lines = wrap(text, style, width, metrics);
    const baseline = top + baselineOffset(style, metrics);
    const runs = textRuns(lines, x, baseline, style, metrics);
    boxes.push(...runs);
    if (uri) {
      const widest = Math.max(...runs.map((run) => (run.kind === "text" ? run.width : 0)));
      boxes.push({ kind: "link", x, y: top, w: widest, h: lines.length * style.leading, uri });
    }
    top += lines.length * style.leading;
    last = baseline + (lines.length - 1) * style.leading;
  };
  add(item.org, { ...entry, tone: "muted" }, item.url);
  add(item.note, entry, null);
  return { height: top, first, last, boxes, gapAfter: spacing.entry };
}

/** A row of up to three skills, each after an accent square, wrapping inside its column. */
function skillRow(items: readonly string[], metrics: Metrics): Unit {
  const style = TYPE.skill;
  const first = baselineOffset(style, metrics);
  const boxes: Box[] = [];
  let lines = 1;
  items.forEach((item, index) => {
    const column = 4 + index * 3;
    const x = columnX(column);
    const text = wrap(item, style, span(column, column + 2) - SPACE.skillText, metrics);
    const middle = first - (metrics[style.face].xHeight * style.size) / 2;
    boxes.push({ kind: "rect", x, y: middle - RULE.square / 2, w: RULE.square, h: RULE.square, tone: "accent" });
    boxes.push(...textRuns(text, x + SPACE.skillText, first, style, metrics));
    lines = Math.max(lines, text.length);
  });
  return { height: lines * style.leading, first, last: first + (lines - 1) * style.leading, boxes, gapAfter: SPACE.skillRow };
}

const chunk = <T>(list: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, index * size + size));

function sections(input: DocumentInput, options: CvOptions, spacing: Spacing): FlowSection[] {
  const { metrics, labels } = options;
  const titled = (title: string, units: Unit[]): FlowSection[] => {
    if (units.length === 0) return [];
    const last = units.at(-1);
    if (last) last.gapAfter = 0;
    return [{ ...titleOf(title, MARGIN.start, span(1, 3), TYPE.section, metrics), units }];
  };
  const body = TYPE.body;
  const profile = input.profile.map((paragraph) => paragraphUnit(wrap(paragraph, body, span(4, 12), metrics), columnX(4), body, metrics, SPACE.paragraph));
  const facts = spacing.pairs
    ? chunk(input.facts, 2).map((pair) =>
        factRow(
          pair,
          [
            [4, 5, 6, 8],
            [9, 10, 11, 12],
          ],
          metrics,
        ),
      )
    : input.facts.map((fact) => factRow([fact], [[4, 5, 6, 12]], metrics));
  return [
    ...titled(labels.profile, profile),
    ...titled(labels.facts, facts),
    ...input.timeline.flatMap((group) => titled(group.title ?? labels.career, group.items.map((item) => entryUnit(item, spacing, labels, metrics)))),
    ...input.tools.flatMap((group) => titled(group.title ?? labels.skills, chunk(group.items, 3).map((row) => skillRow(row, metrics)))),
  ];
}

const NORMAL: Spacing = { section: SPACE.section, entry: SPACE.entry, pairs: false };
const TIGHT: Spacing = { section: SPACE.sectionTight, entry: SPACE.entryTight, pairs: true };

export function layoutCv(input: DocumentInput, options: CvOptions): LaidDocument {
  const top = head(input, options);
  const start = top.bottom + SPACE.body;
  const run = (spacing: Spacing, limit: number) =>
    flow(sections(input, options, spacing), { start, restart: BASELINE.continue, limit, sectionGap: spacing.section });
  // How far the body runs past the last line a page holds, on one endless page.
  const overflow = run(NORMAL, Number.POSITIVE_INFINITY).lastBaseline - BASELINE.limit;
  const fitted = overflow > 0 && overflow <= BASELINE.fit && run(TIGHT, Number.POSITIVE_INFINITY).lastBaseline <= BASELINE.limit;
  const body = run(fitted ? TIGHT : NORMAL, BASELINE.limit).pages;
  const name = `${input.name}${SEPARATOR}${options.labels.documents.cv}`;
  const pages = body.map((boxes, index) => ({
    boxes: [
      ...(index === 0 ? top.boxes : runningHead(name, options.metrics)),
      ...boxes,
      ...footer({
        start: name,
        end: [
          ...(options.asOf ? [{ text: options.labels.asOf(options.labels.longDate(options.asOf)) }] : []),
          ...(input.online ? [{ text: input.online.text, uri: input.online.uri }] : []),
          ...(body.length > 1 ? [{ text: options.labels.page(index + 1, body.length) }] : []),
        ],
        metrics: options.metrics,
      }),
    ],
  }));
  return { part: "cv", pages, fitted };
}
