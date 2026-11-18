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
