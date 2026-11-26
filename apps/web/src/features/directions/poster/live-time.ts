import type { BlockOf } from "@linkyo/blocks";

import { base64OfBytes, bridgeAvailable, post } from "@/features/app-mode/bridge";

/**
 * When a live starts, said for the visitor (pure: no React, so the page's server code, the island
 * and the tests share it). The clock itself (`useNow`) lives in the island, `./live-island.tsx`.
 */

type Live = BlockOf<"live">;

export const MINUTE = 60_000;
/** After this long past its start, a scheduled live is no longer shown. */
const STALE_AFTER = 2 * 60 * MINUTE;

const comma = (locale: string) => (locale === "ar" ? "، " : ", ");
export const capitalize = (text: string, locale: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

/**
 * "Today, 21:00" / "Tomorrow, 21:00" / "Sat 21 Nov, 21:00" in the visitor's own time zone, plus
 * "in 3 hours" when it is close. On the server (no visitor clock yet) the creator's time is shown.
 */
export function describeStart(startsAt: string, now: number | null, locale: string) {
  const start = new Date(startsAt);
  const zone = now === null ? { timeZone: "Europe/Berlin" } : {};
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", ...zone }).format(start);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", ...zone }).format(start);
  if (now === null) {
    const date = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", ...zone }).format(start);
    return { day: weekday, time, label: `${date}${comma(locale)}${time}`, relative: null, state: "upcoming" as const };
  }
  const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((dayStart(start) - dayStart(new Date(now))) / (24 * 60 * MINUTE));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const short = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const near = days === 0 || days === 1;
  const day = near ? capitalize(rtf.format(days, "day"), locale) : weekday;
  const dayLabel = near ? day : new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(start);
  const diff = start.getTime() - now;
  const relative = diff > 0 && diff < 12 * 60 * MINUTE ? (diff < 60 * MINUTE ? short.format(Math.max(1, Math.round(diff / MINUTE)), "minute") : short.format(Math.round(diff / (60 * MINUTE)), "hour")) : null;
  const state = diff > 0 ? ("upcoming" as const) : -diff < STALE_AFTER ? ("started" as const) : ("past" as const);
  return { day, time, label: `${dayLabel}${comma(locale)}${time}`, relative, state };
}

/**
 * Adds the live to the visitor's calendar (.ics, made in the browser; nothing is sent anywhere). In
 * Linkyo's iPhone app (app mode: the owner's "View my page") the web view saves no blob download, so
 * the file goes to the app (`download` through the bridge), which offers to add it to the calendar.
 */
export function remind(block: Live, summary: string) {
  if (!block.startsAt) return;
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (text: string) => text.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Linkyo//Live//EN",
    "BEGIN:VEVENT",
    `UID:${block.id}-${stamp(new Date(block.startsAt))}@linkyo.app`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(new Date(block.startsAt))}`,
    "DURATION:PT1H",
    `SUMMARY:${escape(summary)}`,
    `URL:${block.url}`,
    `DESCRIPTION:${escape(block.url)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  if (bridgeAvailable() && post({ type: "download", name: "live.ics", mime: "text/calendar", base64: base64OfBytes(new TextEncoder().encode(ics)) })) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  link.download = "live.ics";
  link.click();
  URL.revokeObjectURL(link.href);
}
