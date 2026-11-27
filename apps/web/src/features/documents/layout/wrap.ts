import { NBSP } from "../font/winansi";

import { measure, type Metrics } from "./measure";
import type { TextStyle } from "./types";

/**
 * Line breaking on measured widths: greedy, ragged, no hyphenation. A line breaks at a space, or
 * after "-", "–" or "/" between two runs of at least three letters (so "(m/w/d)" never breaks). A
 * no-break space never breaks, and the glue rules make some spaces no-break: before " · ", between a
 * number and the word after it ("40 Filialen", "1. März"), after "§", after a short abbreviation
 * ("z. B.", "Nr. 5") and inside a year range ("2021 – heute"). A word wider than its line is broken
 * by characters as a last resort (an e-mail address after "@" or "." first).
 */

const LETTER = /\p{L}/u;
const BREAK_AFTER = new Set(["-", "–", "/"]);
const MIN_RUN = 3;

/** The glue rules: the spaces that must not break a line become no-break spaces. */
export function glue(text: string): string {
  return text
    .replace(/ (?=·)/gu, NBSP)
    .replace(/(\d\.?) (?=\p{L})/gu, `$1${NBSP}`)
    .replace(/§ /gu, `§${NBSP}`)
    .replace(/(?<!\p{L})(\p{L}{1,2})\. (?=\S)/gu, `$1.${NBSP}`)
    .replace(/(\d{4}) – /gu, `$1${NBSP}–${NBSP}`);
}

/** How many letters run on from `index` in `step` direction. */
function run(chars: readonly string[], index: number, step: 1 | -1): number {
  let count = 0;
  for (let at = index; at >= 0 && at < chars.length && LETTER.test(chars[at] ?? ""); at += step) count += 1;
  return count;
}

/** A word cut after the hyphens, dashes and slashes where it may break. */
function parts(word: string): string[] {
  const chars = Array.from(word);
  const pieces: string[] = [];
  let start = 0;
  for (let index = 1; index < chars.length - 1; index += 1) {
    if (!BREAK_AFTER.has(chars[index] ?? "")) continue;
    if (run(chars, index - 1, -1) >= MIN_RUN && run(chars, index + 1, 1) >= MIN_RUN) {
      pieces.push(chars.slice(start, index + 1).join(""));
      start = index + 1;
    }
  }
  pieces.push(chars.slice(start).join(""));
  return pieces;
}

interface Piece {
  text: string;
  /** A space follows (it is dropped at a line's end). */
  space: boolean;
}

function piecesOf(line: string): Piece[] {
  const words = line.split(" ");
  return words.flatMap((word, index) => {
    const cut = parts(word);
    return cut.map((text, at) => ({ text, space: at === cut.length - 1 && index < words.length - 1 }));
  });
}

/** A word too wide for its line, broken by characters: after "@" or "." where that fits, else as many characters as fit. */
function breakWord(word: string, fits: (text: string) => boolean): string[] {
  const lines: string[] = [];
  let rest = Array.from(word);
  while (rest.length > 0 && !fits(rest.join(""))) {
    let cut = 0;
    for (let length = 1; length <= rest.length; length += 1) {
      if (!fits(rest.slice(0, length).join(""))) break;
      cut = length;
    }
    // An address breaks after its "@" when that fits ("jonas.brandt@" / "example.com"), else after its last "." that fits.
    const at = rest.slice(0, cut).lastIndexOf("@") + 1;
    const dot = rest.slice(0, cut).lastIndexOf(".") + 1;
    const soft = at > 0 ? at : dot;
    const take = Math.max(1, soft > 0 ? soft : cut);
    lines.push(rest.slice(0, take).join(""));
    rest = rest.slice(take);
  }
  if (rest.length > 0) lines.push(rest.join(""));
  return lines;
}

/** A text's lines in a column of `width` points. Line breaks in the text stay. */
export function wrap(text: string, style: TextStyle, width: number, metrics: Metrics): string[] {
  const fits = (candidate: string) => measure(candidate, style, metrics) <= width + 1e-6;
  return glue(text)
    .split("\n")
    .flatMap((hard) => {
      const lines: string[] = [];
      let line = "";
      for (const piece of piecesOf(hard)) {
        const candidate = line + piece.text;
        if (line === "" || fits(candidate)) {
          line = candidate;
        } else {
          lines.push(line.trimEnd());
          line = piece.text;
        }
        // A piece alone wider than the line: broken by characters, the last part carries on.
        if (!fits(line)) {
          const broken = breakWord(line, fits);
          lines.push(...broken.slice(0, -1));
          line = broken.at(-1) ?? "";
        }
        if (piece.space) line += " ";
      }
      lines.push(line.trimEnd());
      return lines;
    })
    .filter((line, index, all) => line !== "" || all.length === 1);
}
