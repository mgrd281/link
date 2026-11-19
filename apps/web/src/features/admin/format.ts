import { useSyncExternalStore } from "react";

/** "5 min ago", "yesterday", then a date: how recent team activity reads best. */
export function timeAgo(iso: string, now: number, locale: string): string {
  const seconds = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(seconds);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  if (abs < 60) return relative.format(0, "minute");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86400) return relative.format(Math.round(seconds / 86400), "day");
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

const noop = () => () => undefined;
/** This site's origin, for links the team copies and sends (empty while rendering on the server). */
export const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");

/** Euro amounts from cents: "€ 1.234" (whole euros) or "€ 8,00" (with cents). */
export const money = (cents: number, locale: string, exact = false) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: exact ? 2 : 0, minimumFractionDigits: exact ? 2 : 0 }).format(cents / 100);

export const percent = (share: number, locale: string) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: share < 0.1 ? 1 : 0 }).format(share);

export const count = (value: number, locale: string) => new Intl.NumberFormat(locale, { notation: value >= 100_000 ? "compact" : "standard" }).format(value);

/** "Germany" for "DE" in the reader's language; an empty code reads as unknown. */
export function country(code: string, locale: string, unknown: string) {
  if (!code) return unknown;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const dateTime = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const date = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
