import { tokens } from "@linkyo/tokens";
import { createTranslator } from "next-intl";

import { COMPANY } from "@/features/legal/company";
import type { LegalDoc } from "@/features/legal/texts";

import type { EmailMessage, EmailTag } from "../types";

/**
 * What every Linkyo e-mail is made of: a list of blocks, rendered twice, as plain text and as simple
 * HTML (inline layout only: no images, no tracking pixels, no remote fonts, no stylesheet). Templates
 * are pure `(data, t) => EmailMessage`; `t` comes from next-intl's `createTranslator` for the
 * e-mail's locale (contract e-mails: the order's locale, German in phase 1).
 *
 * The date and time helpers are shared with the screens that show the same moment (a withdrawal's
 * receipt on screen and in the e-mail must read the same), so they stay free of server code.
 */

export type EmailLocale = "de" | "en" | "ar";

/** A translator over all messages (keys with their namespace, e.g. "email.order.subject"). */
export interface EmailT {
  (key: string, values?: Record<string, string | number | Date>): string;
  raw(key: string): unknown;
}

/** next-intl's translator for one locale's messages, loosely typed for templates. */
export function emailTranslator(locale: EmailLocale, messages: Record<string, unknown>): EmailT {
  return createTranslator({ locale, messages }) as unknown as EmailT;
}

export const TIME_ZONE = "Europe/Berlin";

/** Western digits in every locale (Arabic included), Berlin time. */
const options = (extra: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => ({ timeZone: TIME_ZONE, numberingSystem: "latn", ...extra });

/** "Montag, 30. November 2026" — a due date. */
export function longDate(at: Date, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale, options({ weekday: "long", day: "numeric", month: "long", year: "numeric" })).format(at);
}

/** "22.11.2026" — when a declaration arrived (receipts and subjects). */
export function shortDate(at: Date, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale, options({ day: "2-digit", month: "2-digit", year: "numeric" })).format(at);
}

/** "18:00" — always 24 hours. */
export function clockTime(at: Date, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale, options({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" })).format(at);
}

/** "Freitag, 27. November, 12:00 Uhr" — a deadline inside a sentence (the briefing). */
export function deadline(at: Date, locale: EmailLocale): string {
  const day = new Intl.DateTimeFormat(locale, options({ weekday: "long", day: "numeric", month: "long" })).format(at);
  return `${day}, ${clockTime(at, locale)}${locale === "de" ? " Uhr" : ""}`;
}

/** A date given as a calendar day (YYYY-MM-DD, e.g. "cancel as of"), shown as that day. */
export function calendarDay(day: string, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", numberingSystem: "latn", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${day}T12:00:00Z`));
}

export type EmailBlock =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string }
  | { kind: "lines"; lines: readonly string[] }
  | { kind: "list"; items: readonly string[] }
  /** Words the customer agreed to, repeated verbatim. */
  | { kind: "quote"; text: string }
  /** A link that looks like a button (the only links in our e-mails). */
  | { kind: "button"; label: string; href: string }
  /** A highlighted note (test mode). */
  | { kind: "note"; text: string }
  /** One of our legal texts (features/legal/texts.ts), in full. */
  | { kind: "legal"; doc: LegalDoc };

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// Inline styles from the design tokens (e-mail clients read no stylesheet and no CSS variables).
const color = tokens.color;
const px = (value: number) => `${String(value)}px`;
const STYLE = {
  body: `margin:0;padding:${px(tokens.spacing[6])} ${px(tokens.spacing[4])};background:${color.white};color:${color.ink}`,
  column: `max-width:${px(tokens.layout.prose)};margin:0 auto`,
  heading: `margin:${px(tokens.spacing[6])} 0 ${px(tokens.spacing[2])};font-size:${px(tokens.text.h3.fontSize)};line-height:${String(tokens.text.h3.lineHeight)};font-weight:${String(tokens.text.h3.fontWeight)}`,
  text: `margin:0 0 ${px(tokens.spacing[3])};font-size:${px(tokens.text.body.fontSize)};line-height:${String(tokens.text.body.lineHeight)}`,
  small: `margin:0 0 ${px(tokens.spacing[2])};font-size:${px(tokens.text.small.fontSize)};line-height:${String(tokens.text.small.lineHeight)};color:${color.gray["600"]}`,
  quote: `margin:0 0 ${px(tokens.spacing[3])};padding:${px(tokens.spacing[3])} ${px(tokens.spacing[4])};border:${px(tokens.borderWidth.hairline)} solid ${color.gray["200"]};border-radius:${px(tokens.radius.md)};font-size:${px(tokens.text.body.fontSize)};line-height:${String(tokens.text.body.lineHeight)}`,
  note: `margin:0 0 ${px(tokens.spacing[4])};padding:${px(tokens.spacing[3])} ${px(tokens.spacing[4])};background:${color.teal["50"]};border-radius:${px(tokens.radius.md)};font-weight:${String(tokens.font.weight.semibold)}`,
  button: `display:inline-block;margin:${px(tokens.spacing[2])} 0 ${px(tokens.spacing[4])};padding:${px(tokens.spacing[3])} ${px(tokens.spacing[5])};background:${color.teal["700"]};color:${color.white};border-radius:${px(tokens.radius.full)};font-weight:${String(tokens.font.weight.semibold)};text-decoration:none`,
  footer: `margin:${px(tokens.spacing[8])} 0 0;padding-top:${px(tokens.spacing[4])};border-top:${px(tokens.borderWidth.hairline)} solid ${color.gray["200"]};font-size:${px(tokens.text.small.fontSize)};color:${color.gray["600"]}`,
} as const;

function legalText(doc: LegalDoc): string[] {
  return doc.flatMap((block) => {
    switch (block.kind) {
      case "h2":
      case "h3":
        return [block.text, ""];
      case "p":
        return [block.text, ""];
      case "list":
        return [...block.items.map((item) => `- ${item}`), ""];
      case "lines":
        return [...block.lines, ""];
    }
  });
}

function legalHtml(doc: LegalDoc): string {
  return doc
    .map((block) => {
      switch (block.kind) {
        case "h2":
          return `<h3 style="${STYLE.heading}">${escape(block.text)}</h3>`;
        case "h3":
          return `<p style="${STYLE.text}"><strong>${escape(block.text)}</strong></p>`;
        case "p":
          return `<p style="${STYLE.text}">${escape(block.text)}</p>`;
        case "list":
          return `<ul style="${STYLE.text}">${block.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
        case "lines":
          return `<p style="${STYLE.text}">${block.lines.map(escape).join("<br>")}</p>`;
      }
    })
    .join("\n");
}

function blockText(block: EmailBlock): string[] {
  switch (block.kind) {
    case "heading":
      return ["", block.text, ""];
    case "text":
    case "note":
      return [block.text, ""];
    case "lines":
      return [...block.lines, ""];
    case "list":
      return [...block.items.map((item) => `- ${item}`), ""];
    case "quote":
      return [`„${block.text}“`, ""];
    case "button":
      return [`${block.label}: ${block.href}`, ""];
    case "legal":
      return legalText(block.doc);
  }
}

function blockHtml(block: EmailBlock): string {
  switch (block.kind) {
    case "heading":
      return `<h2 style="${STYLE.heading}">${escape(block.text)}</h2>`;
    case "text":
      return `<p style="${STYLE.text}">${escape(block.text)}</p>`;
    case "note":
      return `<p style="${STYLE.note}">${escape(block.text)}</p>`;
    case "lines":
      return `<p style="${STYLE.text}">${block.lines.map(escape).join("<br>")}</p>`;
    case "list":
      return `<ul style="${STYLE.text}">${block.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
    case "quote":
      return `<blockquote style="${STYLE.quote}">${escape(block.text)}</blockquote>`;
    case "button":
      return `<p style="${STYLE.text}"><a href="${escape(block.href)}" style="${STYLE.button}">${escape(block.label)}</a></p>`;
    case "legal":
      return legalHtml(block.doc);
  }
}

/** The closing lines every e-mail shares: the signature, then who we are and how to reach us. */
export function closing(t: EmailT): { signature: string; footer: string } {
  return { signature: t("email.common.signature"), footer: t("email.common.footer", { address: COMPANY.address, email: COMPANY.email }) };
}

export function greeting(t: EmailT, name: string | null | undefined): string {
  const clean = name?.trim();
  return clean ? t("email.common.greeting", { name: clean }) : t("email.common.greetingNoName");
}

/** Text and HTML of one e-mail from its blocks (the test-mode note first when set). */
export function renderEmail(input: { to: string; subject: string; locale: EmailLocale; tag: EmailTag; blocks: readonly EmailBlock[]; t: EmailT; testMode?: boolean }): EmailMessage {
  const { signature, footer } = closing(input.t);
  const blocks: EmailBlock[] = [...(input.testMode ? [{ kind: "note", text: input.t("email.common.testMode") } as const] : []), ...input.blocks];
  const text = [...blocks.flatMap(blockText), signature, "", "--", footer].join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const dir = input.locale === "ar" ? "rtl" : "ltr";
  const html = [
    "<!doctype html>",
    `<html lang="${input.locale}" dir="${dir}">`,
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(input.subject)}</title></head>`,
    `<body style="${STYLE.body}">`,
    `<div style="${STYLE.column}">`,
    ...blocks.map(blockHtml),
    `<p style="${STYLE.text}">${escape(signature)}</p>`,
    `<p style="${STYLE.footer}">${escape(footer)}</p>`,
    "</div>",
    "</body>",
    "</html>",
  ].join("\n");
  return { to: input.to, subject: input.subject, text: `${text}\n`, html, locale: input.locale, tag: input.tag };
}
