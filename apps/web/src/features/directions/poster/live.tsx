"use client";

import type { BlockOf } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { BellRing, CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { PlatformGlyph, platformName } from "../shared/creator-kit";

type Live = BlockOf<"live">;

const MINUTE = 60_000;
/** After this long past its start, a scheduled live is no longer shown. */
const STALE_AFTER = 2 * 60 * MINUTE;

// One shared clock, ticking every 30 s while something on the page needs it.
const listeners = new Set<() => void>();
let timer: number | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= window.setInterval(() => {
    for (const notify of listeners) notify();
  }, MINUTE / 2);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}
const minuteNow = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const serverNow = () => null;

/** The visitor's clock (per minute); null while rendering on the server. */
function useNow(): number | null {
  return useSyncExternalStore(subscribe, minuteNow, serverNow);
}

const comma = (locale: string) => (locale === "ar" ? "، " : ", ");
const capitalize = (text: string, locale: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

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

/** Adds the live to the visitor's calendar (.ics, made in the browser; nothing is sent anywhere). */
function remind(block: Live, summary: string) {
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
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  link.download = "live.ics";
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * The next planned live as one calm row: a calendar tile (TODAY · 21:00 in the visitor's own time),
 * what it is about, and a bell that adds it to the calendar. After it has passed, just the channel.
 */
export function LiveNextRow({ block, surface }: { block: Live; surface: string }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const now = useNow();
  const platform = platformName(block.platform);
  const start = block.startsAt ? describeStart(block.startsAt, now, locale) : null;
  const planned = start && start.state !== "past" ? start : null;
  const summary = t("calendarTitle", { platform, title: block.title ?? block.channel });
  return (
    <div id={block.id} className={cn("flex scroll-mt-20 items-center gap-4 rounded-creator-card p-3", surface)}>
      {planned ? (
        <span className="grid w-16 shrink-0 justify-items-center gap-1 rounded-md bg-creator-accent px-1 py-2 text-creator-accent-fg">
          <span className="max-w-full truncate text-caption font-bold tracking-wide uppercase">{planned.day}</span>
          <span className="text-body-lg leading-none font-bold tabular-nums">{planned.time}</span>
        </span>
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-md bg-creator-surface-2">
          <PlatformGlyph platform={block.platform} size="lg" />
        </span>
      )}
      <a href={block.url} className="grid min-w-0 flex-1 gap-1 rounded-xs focus-visible:focus-ring">
        <span className="line-clamp-2 text-body font-semibold leading-snug">{block.title ?? platform}</span>
        <span className="flex min-w-0 items-center gap-2 text-small text-creator-fg-muted">
          <PlatformGlyph platform={block.platform} size="sm" className="shrink-0" />
          <span className="truncate">{planned?.relative ? `${platform} · ${capitalize(planned.relative, locale)}` : planned ? t("liveOn", { platform }) : `${platform} · ${t("offline")}`}</span>
        </span>
      </a>
      {planned?.state === "upcoming" ? (
        <button
          type="button"
          onClick={() => remind(block, summary)}
          aria-label={t("remindAbout", { title: block.title ?? platform })}
          className="grid size-touch-target shrink-0 place-items-center rounded-md text-creator-fg transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring active:scale-pressed"
        >
          <Icon icon={BellRing} size="md" />
        </button>
      ) : null}
    </div>
  );
}

/** Hero pill: "● LIVE · TikTok" while live, or the next start when one is planned. */
export function HeroLive({ block }: { block: Live }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const now = useNow();
  const platform = platformName(block.platform);
  if (block.isLive) {
    return (
      <a
        href={block.url}
        className="inline-flex h-control-md items-center gap-2 rounded-full bg-danger-fill px-4 text-small font-bold tracking-wide text-danger-fill-fg uppercase shadow-e2 transition-transform duration-micro hover:scale-lift focus-visible:focus-ring motion-reduce:hover:scale-none"
      >
        <span aria-hidden className="size-dot rounded-full bg-current motion-safe:animate-pulse" />
        {t("liveOn", { platform })}
      </a>
    );
  }
  if (!block.startsAt) return null;
  const start = describeStart(block.startsAt, now, locale);
  if (start.state === "past") return null;
  return (
    <a
      href={`#${block.id}`}
      className="inline-flex h-control-md items-center gap-2 rounded-full border border-creator-line-strong bg-creator-glass px-4 text-small font-semibold text-creator-fg backdrop-blur-glass transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring"
    >
      <Icon icon={CalendarClock} size="sm" />
      {t("liveAt", { when: start.label, platform })}
    </a>
  );
}
