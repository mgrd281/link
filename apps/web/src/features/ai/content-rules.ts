/**
 * Content rules for AI-written page text (pure). The model may only say what the sources or the
 * owner said: free text loses addresses, e-mail addresses and phone numbers that are not in the
 * sources, and a number that appears nowhere in them marks the text as invented (the caller clears
 * the field or drops the block). The facts are the texts the model was given (already redacted), so
 * an e-mail address or phone number in an answer can never be "from the sources".
 */

export interface Facts {
  /** Every number of the sources, as digits only (24,99 → "2499"), and each of its digit groups. */
  numbers: ReadonlySet<string>;
  /** Hosts named in the sources (lio-vance.de, eventim.de), without "www.". */
  hosts: ReadonlySet<string>;
}

export interface TextCheck {
  /** The text without addresses, e-mails and phone numbers that are not in the sources. */
  text: string;
  /** Something was removed. */
  changed: boolean;
  /** A number in the text appears nowhere in the sources or the owner's text. */
  invented: boolean;
}

/** Arabic-Indic and Persian digits as Western digits (the prompt asks for Western digits anyway). */
const westernDigits = (text: string) => text.replace(/[٠-٩۰-۹]/g, (digit) => String((digit.codePointAt(0) ?? 0) % 16));

const NUMBER = /\d+(?:[.,]\d+)*/g;
const canonical = (number: string) => number.replace(/[.,]/g, "").replace(/^0+(?=\d)/, "");
const groups = (number: string) => number.split(/[.,]/).map((group) => group.replace(/^0+(?=\d)/, ""));

/** The numbers in a text, as digits only. */
export const numbersIn = (text: string): string[] => [...westernDigits(text).matchAll(NUMBER)].map((match) => canonical(match[0]));

/**
 * Common top-level domains: a bare "name.tld" only counts as an address with one of these, so
 * abbreviations ("z.B.", "Dr.med") are never mistaken for one. With http(s):// or www. any host counts.
 */
const TLDS = "com|de|net|org|io|co|app|me|at|ch|eu|info|shop|store|art|studio|music|tv|fm|ai|dev|page|link|bio|ee|to|gg|ly|be|uk|fr|it|es|nl|us|ca|sa|ae|eg|ma|tn|jo|lb|qa|kw|om|bh|tr|pl|se|dk|no|fi|pt|gr|cz|online|site|xyz|biz|social|club";
const URLISH = new RegExp(`\\b(?:https?:\\/\\/|www\\.)[^\\s<>"]+|\\b[\\p{L}\\p{N}][\\p{L}\\p{N}-]*(?:\\.[\\p{L}\\p{N}-]+)*\\.(?:${TLDS})\\b(?:\\/[^\\s<>"]*)?`, "giu");
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;

// ── Phone numbers ────────────────────────────────────────────────────────────

/** Digits as people write them on a page: Western, Arabic-Indic and Persian. */
const DIGIT = "[0-9\u0660-\u0669\u06f0-\u06f9]";
/** What stands between the digits of a phone number: spaces (also the non-breaking ones), dot, slash, brackets, hyphens and dashes. */
const SEPARATOR = "[ \\t\u00a0\u2009\u202f./()\\-\u2010-\u2015]";
/**
 * A phone-like run: 7 or more digits with at most three separator characters between two of them,
 * optionally after + or 00. Three, because the separator people type most has a space on both
 * sides: "0621 - 12 34 56", "040 / 12 34 56", "+49 (0) 151 – 234 567 89".
 */
const PHONE = new RegExp(`(?:\\+|\\b00)?\\(?${DIGIT}(?:${SEPARATOR}{0,3}${DIGIT}){6,}`, "g");
const DAY = /(?:0?[1-9]|[12]\d|3[01])/.source;
const MONTH = /(?:0?[1-9]|1[0-2])/.source;
const YEAR = /(?:19|20)\d{2}/.source;
const CLOCK = /(?:[01]?\d|2[0-4])[.:][0-5]\d/.source;
/**
 * Digit runs that are no phone numbers although they look like one to a digit counter: real dates
 * (2026-11-22, 22.11.2026, 11/22/2026), opening hours (10:00 – 18:00) and year ranges (2019 – 2024,
 * 2019/2020). Only real ones: "12.34.56" is the end of a phone number, not a date.
 */
const NOT_A_PHONE = new RegExp(
  `\\b(?:\\d{4}-${MONTH}-${DAY}|${DAY}[./]${MONTH}[./](?:\\d{4}|\\d{2})|${MONTH}/${DAY}/(?:\\d{4}|\\d{2})|${CLOCK}\\s?[-–—]\\s?${CLOCK}|${YEAR}\\s?[-–—/]\\s?${YEAR})\\b`,
  "g",
);
/** Stands in for a date while phone numbers are looked for (a private-use character, removed from the input first). */
const ASIDE = "\ue002";

/**
 * Replaces every phone-like run of 7 or more digits with `replacement()`. Dates, opening hours and
 * year ranges stay as they are; prices (24,99) and short numbers have too few digits in one run.
 * The one definition of "a phone number" for what we send to the model and for what it answers.
 */
export function replacePhones(text: string, replacement: () => string): string {
  const kept: string[] = [];
  const aside = text.replaceAll(ASIDE, "").replace(NOT_A_PHONE, (match) => {
    kept.push(match);
    return ASIDE;
  });
  let next = 0;
  return aside.replace(PHONE, replacement).replaceAll(ASIDE, () => kept[next++] ?? "");
}

const PLACEHOLDER = /\[(?:E-Mail|Telefon)\]/g;
const TLD = /\.[a-z]{2,}$/i;

const hostOf = (candidate: string): string | null => {
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    return TLD.test(url.hostname) ? url.hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

/** Facts from every text the model was given: the owner's sentence and name, profile texts, link words. */
export function factsFrom(texts: readonly (string | undefined)[]): Facts {
  const numbers = new Set<string>();
  const hosts = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of westernDigits(text).matchAll(NUMBER)) {
      numbers.add(canonical(match[0]));
      for (const group of groups(match[0])) numbers.add(group);
    }
    for (const match of text.matchAll(URLISH)) {
      const host = hostOf(match[0]);
      if (host) hosts.add(host);
    }
  }
  return { numbers, hosts };
}

const tidy = (text: string) =>
  text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();

/** Checks one free text (tagline, bio, a title, a paragraph) against the facts. */
export function checkFreeText(input: string, facts: Facts): TextCheck {
  const removed = { any: false };
  const drop = () => {
    removed.any = true;
    return "";
  };
  let text = input.replace(EMAIL, drop).replace(PLACEHOLDER, drop);
  text = text.replace(URLISH, (match) => {
    const host = hostOf(match);
    return host && facts.hosts.has(host) ? match : drop();
  });
  text = replacePhones(text, drop);
  if (removed.any) text = tidy(text);
  const invented = [...westernDigits(text).matchAll(NUMBER)].some((match) => {
    const number = match[0];
    return !facts.numbers.has(canonical(number)) && !groups(number).every((group) => facts.numbers.has(group));
  });
  return { text, changed: removed.any, invented };
}

/** Share of Arabic letters among all letters (0–1); 1 for a text without letters. */
export function arabicShare(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 1;
  return letters.filter((letter) => /\p{Script=Arabic}/u.test(letter)).length / letters.length;
}

/**
 * Is the page text plausibly in the page language? Only Arabic is checked, and only as a warning
 * (names and brands stay in Latin letters): at least half of the letters should be Arabic.
 */
export const languageWarning = (locale: "de" | "en" | "ar", texts: readonly string[]): boolean => locale === "ar" && arabicShare(texts.join(" ")) < 0.5;
