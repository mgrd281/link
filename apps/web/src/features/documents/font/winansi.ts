/**
 * PDF's WinAnsiEncoding (ISO 32000-1, Annex D): the one-byte code of each character the documents
 * print, and back. Codes 0x20–0x7E are ASCII, 0xA0–0xFF are Latin-1, and 0x80–0x9F hold the
 * typographer's characters German and English need (€, „ “ ” ‘ ’, – —, …, •, ™, Œ œ Š š Ž ž Ÿ ƒ ˆ ˜
 * ‰ † ‡ ‹ ›). 0x81, 0x8D, 0x8F, 0x90 and 0x9D are unused. Pure: the page imports it through offer.ts.
 */

/** Unicode of the codes 0x80–0x9F; 0 where WinAnsi leaves the code unused. */
const HIGH = [
  0x20ac, 0, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0, 0x017d, 0,
  0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0, 0x017e, 0x0178,
];

/** The first and last code a document's fonts carry (`/FirstChar`, `/LastChar`). */
export const FIRST_CODE = 0x20;
export const LAST_CODE = 0xff;
/** The soft hyphen: in WinAnsi, but never drawn (the documents remove it before layout). */
export const SOFT_HYPHEN_CODE = 0xad;
/** The no-break space: a space that never breaks a line, drawn as a space. */
export const NBSP = "\u00A0";

/** Unicode for a WinAnsi code (0x20–0xFF), or null where the code is unused. */
export function unicodeOf(code: number): number | null {
  if (code < FIRST_CODE || code > LAST_CODE || code === 0x7f) return null;
  if (code < 0x80 || code > 0x9f) return code;
  const unicode = HIGH[code - 0x80] ?? 0;
  return unicode === 0 ? null : unicode;
}

const CODES = new Map<number, number>();
for (let code = FIRST_CODE; code <= LAST_CODE; code += 1) {
  const unicode = unicodeOf(code);
  if (unicode !== null) CODES.set(unicode, code);
}

/** The WinAnsi code of one character (a single code point), or null when WinAnsi has none. */
export const winAnsiCode = (char: string): number | null => CODES.get(char.codePointAt(0) ?? -1) ?? null;

/** Whether every character of a text (line breaks aside) has a WinAnsi code that is drawn (the soft hyphen is not). */
export function isWinAnsi(text: string): boolean {
  for (const char of text) {
    if (char === "\n") continue;
    const code = winAnsiCode(char);
    if (code === null || code === SOFT_HYPHEN_CODE) return false;
  }
  return true;
}
