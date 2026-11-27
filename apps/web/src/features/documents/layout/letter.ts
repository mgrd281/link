import { CLOSING_LINE } from "../../directions/poster/laufbahn-content";
import type { DocumentInput } from "../input";
import type { PaperLabels } from "../labels";
import { AREA_END, BASELINE, DIN, MARGIN, RULE, SPACE, TYPE } from "../print-tokens";

import { flow, paragraphUnit, textRuns, type FlowSection, type Unit } from "./flow";
import { baselineOffset, capHeight, measure, type Metrics } from "./measure";
import { footer, runningHead } from "./paper";
import type { Box, LaidDocument, TextStyle } from "./types";
import { wrap } from "./wrap";

/**
 * The Anschreiben (cover letter) on DIN 5008 Form B: the letterhead (name, role, the accent rule),
 * the address field kept free (no addressee is invented), the information block (Wohnort, Telefon,
 * E-Mail, Online, Datum), the fold and punch marks, the subject where a German reader expects it, and
 * the owner's letter exactly as written: no salutation or closing is ever added. A closing the letter
 * has gets the signature space before the name; "Anlage: Lebenslauf" only in the combined file, where
 * the CV really follows.
 */

export interface LetterOptions {
  metrics: Metrics;
  labels: PaperLabels;
  /** The request's time: the letter's date (Europe/Berlin). */
  now: Date;
  /** The combined file: the CV follows, so the letter names it as its enclosure. */
  enclosure: boolean;
}

const SEPARATOR = "\u00A0· ";
const AREA = AREA_END - MARGIN.start;

const descent = (style: TextStyle, metrics: Metrics): number => -metrics[style.face].descender * style.size;

/** A signature is short: at most this many lines after the closing, each at most SIGNER_CHARS characters. */
const SIGNER_LINES = 3;
const SIGNER_CHARS = 60;

/**
 * The letter's paragraphs, and its closing when it has one: the closing line ("Mit freundlichen
 * Grüßen" and nothing else on that line), then who signs. The closing is the last such line of the
 * last paragraph, followed by at most a short signature; or the last line of the paragraph before,
 * when the last one is the name alone. Whatever the owner wrote before the closing in the same
 * paragraph stays body text (a letter typed with single line breaks is one paragraph). A sentence
 * that merely holds a closing word ("I am sincerely …") is body text too.
 */
export function closingOf(paragraphs: readonly string[], name: string): { body: string[]; greeting: string[]; signer: string[] } | null {
  const lines = (text: string | undefined) => (text ?? "").split("\n");
  const closes = (line: string) => CLOSING_LINE.test(line.toLowerCase());
  const filled = (list: readonly string[]) => list.filter((line) => line.trim() !== "");
  const signature = (list: readonly string[]) => list.length <= SIGNER_LINES && list.every((line) => line.trim().length <= SIGNER_CHARS);
  const before = (list: readonly string[], at: number) => {
    const text = list.slice(0, at).join("\n").trim();
    return text === "" ? [] : [text];
  };
  const last = lines(paragraphs.at(-1));
  const at = last.findLastIndex(closes);
  if (at >= 0) {
    const signer = filled(last.slice(at + 1));
    if (!signature(signer)) return null;
    // A closing with nobody after it: the sender's own name (form, not invention).
    return { body: [...paragraphs.slice(0, -1), ...before(last, at)], greeting: [last[at] ?? ""], signer: signer.length > 0 ? signer : [name] };
  }
  // The closing as the end of the paragraph before, and the name as the last, short one.
  const previous = filled(lines(paragraphs.at(-2)));
  const end = previous.length - 1;
  if (paragraphs.length >= 2 && signature(filled(last)) && end >= 0 && closes(previous[end] ?? "")) {
    return { body: [...paragraphs.slice(0, -2), ...before(previous, end)], greeting: [previous[end] ?? ""], signer: filled(last) };
  }
  return null;
}

/**
 * The closing as one unit, kept together: the closing line, the signature space, the name, and the
 * enclosure when the CV follows. Every line wraps to the text column; it is a few lines tall, so it
 * always fits a page.
 */
function closingUnit(greeting: readonly string[], signer: readonly string[], style: TextStyle, options: LetterOptions): Unit {
  const { metrics, labels } = options;
  const offset = baselineOffset(style, metrics);
  const boxes: Box[] = [];
  const greetingLines = greeting.flatMap((line) => wrap(line, style, AREA, metrics));
  const signerLines = signer.flatMap((line) => wrap(line, style, AREA, metrics));
  let first = offset;
  let last = offset - 2 * style.leading;
  if (greetingLines.length > 0 || signerLines.length > 0) {
    boxes.push(...textRuns(greetingLines, MARGIN.start, offset, style, metrics));
    const signerFirst = offset + (greetingLines.length - 1) * style.leading + DIN.signature + style.leading;
    boxes.push(...textRuns(signerLines, MARGIN.start, signerFirst, style, metrics));
    last = signerFirst + (signerLines.length - 1) * style.leading;
  }
  let height = last + style.leading - offset;
  if (options.enclosure) {
    const label = TYPE.enclosure;
    // One empty line under the name, then "Anlage" and what is enclosed.
    const anlage = last + 2 * style.leading;
    if (boxes.length === 0) first = anlage;
    boxes.push(...textRuns([labels.enclosure], MARGIN.start, anlage, label, metrics));
    boxes.push(...textRuns([labels.enclosureCv], MARGIN.start, anlage + label.leading, { ...label, face: "regular", tone: "muted" }, metrics));
    last = anlage + label.leading;
    height = last + label.leading - baselineOffset(label, metrics);
  }
  return { height, first, last, boxes, gapAfter: 0 };
}

/** Page one's top: letterhead, information block, fold and punch marks, subject. Returns the subject's last baseline. */
function top(input: DocumentInput, options: LetterOptions): { boxes: Box[]; subjectBaseline: number } {
  const { metrics, labels } = options;
  const boxes: Box[] = [];
  const name = TYPE.letterName;
  const nameLines = wrap(input.name, name, AREA, metrics);
  let baseline = DIN.letterheadTop + capHeight(name, metrics);
  boxes.push(...textRuns(nameLines, MARGIN.start, baseline, name, metrics));
  baseline += (nameLines.length - 1) * name.leading;
  if (input.role) {
    const role = TYPE.letterRole;
    const lines = wrap(input.role, role, AREA, metrics);
    baseline += DIN.roleGap + capHeight(role, metrics);
    boxes.push(...textRuns(lines, MARGIN.start, baseline, role, metrics));
    baseline += (lines.length - 1) * role.leading;
  }
  boxes.push({ kind: "rect", x: MARGIN.start, y: baseline + SPACE.rule, w: RULE.accentWidth, h: RULE.accentWeight, tone: "accent" });

  // The information block, beside the (empty) address field.
  const value = TYPE.info;
  const label: TextStyle = { ...value, tone: "muted" };
  const rows: { label: string; value: string; uri?: string; contact?: boolean }[] = [
    ...(input.location ? [{ label: labels.location, value: input.location }] : []),
    ...(input.phone ? [{ label: labels.phone, value: input.phone.text, uri: input.phone.uri, contact: true }] : []),
    ...(input.email ? [{ label: labels.email, value: input.email.text, uri: input.email.uri, contact: true }] : []),
    ...(input.online ? [{ label: labels.online, value: input.online.text, uri: input.online.uri, contact: true }] : []),
  ];
  let row = DIN.info.top + capHeight(value, metrics);
  const valueX = DIN.info.x + DIN.info.label;
  const room = DIN.info.w - DIN.info.label;
  // An address is copied from here: the values step down together (to info-min) until the widest fits
  // on one line; only one wider still breaks.
  const contactSize = Math.max(TYPE.infoMin.size, Math.min(value.size, ...rows.filter((entry) => entry.contact).map((entry) => (value.size * room) / Math.max(room, measure(entry.value, value, metrics)))));
  const contactValue: TextStyle = { ...value, size: Math.floor(contactSize * 2) / 2 };
  const write = (entry: { label: string; value: string; uri?: string; contact?: boolean }) => {
    const style = entry.contact ? contactValue : value;
    const lines = wrap(entry.value, style, room, metrics);
    boxes.push(...textRuns([entry.label], DIN.info.x, row, label, metrics));
    const runs = textRuns(lines, valueX, row, style, metrics, { contact: entry.contact === true });
    boxes.push(...runs);
    if (entry.uri) {
      const widest = Math.max(...runs.map((run) => (run.kind === "text" ? run.width : 0)));
      boxes.push({ kind: "link", x: valueX, y: row - capHeight(style, metrics) - descent(style, metrics), w: widest, h: (lines.length - 1) * DIN.line + capHeight(style, metrics) + 2 * descent(style, metrics), uri: entry.uri });
    }
    row += lines.length * DIN.line;
  };
  rows.forEach(write);
  if (rows.length > 0) row += DIN.line;
  write({ label: labels.date, value: labels.longDate(options.now) });

  // Fold and punch marks at the paper's start edge.
  for (const y of DIN.folds) boxes.push({ kind: "line", x1: DIN.markX, y1: y, x2: DIN.markX + DIN.foldLength, y2: y, weight: RULE.markWeight, tone: "strong" });
  boxes.push({ kind: "line", x1: DIN.markX, y1: DIN.punch, x2: DIN.markX + DIN.punchLength, y2: DIN.punch, weight: RULE.markWeight, tone: "strong" });

  // The subject: the position from the page's facts, else the template's word. Never "Betreff".
  const subject = TYPE.letterSubject;
  const text = input.target ? labels.subjectFor(input.target.value) : labels.subjectBare;
  const lines = wrap(text, subject, AREA, metrics);
  const subjectFirst = DIN.subjectTop + capHeight(subject, metrics);
  boxes.push(...textRuns(lines, MARGIN.start, subjectFirst, subject, metrics));
  return { boxes, subjectBaseline: subjectFirst + (lines.length - 1) * subject.leading };
}

function bodySections(input: DocumentInput, style: TextStyle, options: LetterOptions): FlowSection[] {
  const paragraphs = input.letter ?? [];
  const closing = closingOf(paragraphs, input.name);
  const body = closing ? closing.body : paragraphs;
  const units: Unit[] = body.map((paragraph) => paragraphUnit(wrap(paragraph, style, AREA, options.metrics), MARGIN.start, style, options.metrics, style.leading));
  if (closing) units.push(closingUnit(closing.greeting, closing.signer, style, options));
  else if (options.enclosure) units.push(closingUnit([], [], style, options));
  const last = units.at(-1);
  if (last) last.gapAfter = 0;
  return [{ title: null, titleDepth: 0, units }];
}

export function layoutLetter(input: DocumentInput, options: LetterOptions): LaidDocument {
  const { metrics, labels } = options;
  const head = top(input, options);
  const run = (style: TextStyle, limit: number) =>
    flow(bodySections(input, style, options), {
      start: head.subjectBaseline + DIN.subjectGap - baselineOffset(style, metrics),
      restart: BASELINE.letterContinue,
      limit,
      sectionGap: 0,
    });
  const overflow = run(TYPE.letterBody, Number.POSITIVE_INFINITY).lastBaseline - BASELINE.limit;
  const fitted = overflow > 0 && run(TYPE.letterBodyMin, Number.POSITIVE_INFINITY).lastBaseline <= BASELINE.limit;
  const body = run(fitted ? TYPE.letterBodyMin : TYPE.letterBody, BASELINE.limit).pages;
  const name = `${input.name}${SEPARATOR}${labels.documents.letter}`;
  const pages = body.map((boxes, index) => ({
    boxes: [
      ...(index === 0 ? head.boxes : runningHead(name, metrics)),
      ...boxes,
      ...footer({
        start: name,
        end: [...(input.online ? [{ text: input.online.text, uri: input.online.uri }] : []), ...(body.length > 1 ? [{ text: labels.page(index + 1, body.length) }] : [])],
        metrics,
      }),
    ],
  }));
  return { part: "letter", pages, fitted };
}

/** The address field (DIN 5008 Form B) in points: nothing is printed in it. */
export const ADDRESS_FIELD = DIN.address;
