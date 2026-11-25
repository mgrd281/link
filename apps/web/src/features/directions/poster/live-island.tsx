"use client";

import type { BlockOf } from "@linkyo/blocks";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore, type ReactNode } from "react";

import { capitalize, describeStart, MINUTE, remind } from "./live-time";

type Live = BlockOf<"live">;

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
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, minuteNow, serverNow);
}

/** What the next-live row draws where the page is rendered (`./live.tsx`): its classes and icons. */
export interface LiveRowParts {
  /** The row's own class, the card surface merged in. */
  row: string;
  /** The title's class. */
  title: string;
  /** The platform's name ("TikTok"). */
  platform: string;
  /** The platform's glyph, large (the tile after the live) and small (beside the channel). */
  glyph: ReactNode;
  smallGlyph: ReactNode;
  bell: ReactNode;
}

/**
 * The next planned live as one calm row: a calendar tile (TODAY · 21:00 in the visitor's own time),
 * what it is about, and a bell that adds it to the calendar. After it has passed, just the channel.
 */
export function LiveNextRowIsland({ block, parts }: { block: Live; parts: LiveRowParts }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const now = useNow();
  const { platform } = parts;
  const start = block.startsAt ? describeStart(block.startsAt, now, locale) : null;
  const planned = start && start.state !== "past" ? start : null;
  const summary = t("calendarTitle", { platform, title: block.title ?? block.channel });
  return (
    <div id={block.id} className={parts.row}>
      {planned ? (
        <span className="grid w-16 shrink-0 justify-items-center gap-1 rounded-md bg-creator-accent px-1 py-2 text-creator-accent-fg">
          <span className="max-w-full truncate text-caption font-bold tracking-wide uppercase">{planned.day}</span>
          <span className="text-body-lg leading-none font-bold tabular-nums">{planned.time}</span>
        </span>
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-md bg-creator-surface-2">{parts.glyph}</span>
      )}
      <a href={block.url} className="grid min-w-0 flex-1 gap-1 rounded-xs focus-visible:focus-ring">
        <span dir="auto" className={parts.title}>
          {block.title ?? platform}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-small text-creator-fg-muted">
          {parts.smallGlyph}
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
          {parts.bell}
        </button>
      ) : null}
    </div>
  );
}

/** Hero pill of a planned live: its next start in the visitor's own time (gone once it has passed). */
export function PlannedLiveIsland({ block, platform, icon }: { block: Live; platform: string; icon: ReactNode }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const now = useNow();
  if (!block.startsAt) return null;
  const start = describeStart(block.startsAt, now, locale);
  if (start.state === "past") return null;
  return (
    <a
      href={`#${block.id}`}
      data-block={block.id}
      className="inline-flex h-control-md items-center gap-2 rounded-full border border-creator-line-strong bg-creator-glass px-4 text-small font-semibold text-creator-fg backdrop-blur-glass transition-colors duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring"
    >
      {icon}
      {t("liveAt", { when: start.label, platform })}
    </a>
  );
}
