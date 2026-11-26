import { isWinAnsi, NBSP } from "./font/winansi";

/**
 * Text as the documents print it, and whether they can (ADR draft-laufbahn-pdfs). The PDFs set every
 * text in Geist with WinAnsiEncoding, which holds German, English and most Western European letters;
 * a page whose words need any other letter gets no PDF (a letter is never dropped or replaced).
 * Pure: the page imports it through offer.ts.
 */

/** Characters that carry no letter of their own: the soft hyphen, the joiners, variation selectors and tag characters. */
const INVISIBLE = /\u00AD|\u200B|\u200C|\u200D|\u2060|\p{Variation_Selector}|[\u{E0000}-\u{E007F}]/gu;
/**
 * Pictographs (emoji, and the keycap, skin-tone and flag parts they are built of): decoration, not
 * letters. ©, ® and ™ are pictographs to Unicode but letters to WinAnsi, so they stay.
 */
const PICTOGRAPH = /(?![\u00A9\u00AE\u2122])[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u20E3]/gu;
/** Spaces that may break a line, and the ones that may not (the figure space, the narrow no-break space). */
const BREAKING_SPACE = /[\t\u2000-\u2006\u2008-\u200A\u205F\u3000]/gu;
const FIXED_SPACE = /[\u2007\u202F]/gu;
/** The hyphen and the non-breaking hyphen are printed as the hyphen-minus every font has. */
const HYPHEN = /[\u2010\u2011]/gu;

/**
 * Text as printed: NFC; the soft hyphen, joiners, variation selectors and pictographs removed; thin
 * and other breaking spaces become a space, the figure and narrow no-break spaces a no-break space;
 * U+2010 and U+2011 become "-". Runs of spaces left by a removed pictograph close up, and the text is
 * trimmed: "Lager 🚜" prints "Lager". Line breaks stay.
 */
export function printable(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .replace(INVISIBLE, "")
    .replace(PICTOGRAPH, "")
    .replace(BREAKING_SPACE, " ")
    .replace(FIXED_SPACE, NBSP)
    .replace(HYPHEN, "-")
    .replace(/ {2,}/gu, " ")
    .replace(/ *\n */gu, "\n")
    .trim();
}

/** Whether a text, as printed, can be drawn with WinAnsiEncoding (Geist covers all of WinAnsi but U+00AD, which `printable` removes). */
export const isPrintable = (text: string): boolean => isWinAnsi(printable(text));
