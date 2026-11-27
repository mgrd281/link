import { createTranslator } from "next-intl";

import de from "@/messages/de.json";
import en from "@/messages/en.json";

import type { DocumentKind, DocumentLocale } from "./offer";
import { printable } from "./printable";

/**
 * The template's own words on paper (messages `documents.paper.*`): section titles, "heute",
 * "Datum", "Stand", "Anlage", "Seite x von y", the subject's fallback and the contact labels. Never a
 * fact: facts come from the page (input.ts). Read without a request, so the routes, the page and the
 * tests share them.
 */
export interface PaperLabels {
  locale: DocumentLocale;
  /** "Lebenslauf", "Anschreiben", "Bewerbung": running heads, footers and outline entries. */
  documents: Record<DocumentKind, string>;
  /** The document's title in the PDF's information: "Lebenslauf – Jonas Brandt". */
  title: (kind: DocumentKind, name: string) => string;
  profile: string;
  facts: string;
  career: string;
  skills: string;
  present: string;
  phone: string;
  email: string;
  online: string;
  location: string;
  date: string;
  asOf: (date: string) => string;
  page: (page: number, pages: number) => string;
  enclosure: string;
  enclosureCv: string;
  subjectFor: (value: string) => string;
  subjectBare: string;
  /** A day in long form, in Berlin: "26. November 2026", "26 November 2026". */
  longDate: (at: Date) => string;
}

const MESSAGES = { de, en } as const;
const LANGUAGE_TAGS: Record<DocumentLocale, string> = { de: "de-DE", en: "en-GB" };

export function paperLabels(locale: DocumentLocale): PaperLabels {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "documents.paper" });
  const day = new Intl.DateTimeFormat(LANGUAGE_TAGS[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const titles = { cv: "titleCv", letter: "titleLetter", application: "titleApplication" } as const;
  return {
    locale,
    documents: { cv: t("cv"), letter: t("letter"), application: t("application") },
    title: (kind, name) => t(titles[kind], { name }),
    profile: t("profile"),
    facts: t("facts"),
    career: t("career"),
    skills: t("skills"),
    present: t("present"),
    phone: t("phone"),
    email: t("email"),
    online: t("online"),
    location: t("location"),
    date: t("date"),
    asOf: (date) => t("asOf", { date }),
    page: (page, pages) => t("page", { page, pages }),
    enclosure: t("enclosure"),
    enclosureCv: t("enclosureCv"),
    subjectFor: (value) => t("subjectFor", { value }),
    subjectBare: t("subjectBare"),
    // ICU may separate the parts with narrow no-break spaces; paper prints them as WinAnsi can.
    longDate: (at) => printable(day.format(at)),
  };
}

/** The PDF's language tag (`/Lang`). */
export const languageTag = (locale: DocumentLocale): string => LANGUAGE_TAGS[locale];
