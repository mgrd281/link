"use client";

import type { BlockOf } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { Ticket } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useCreatorFormat } from "../shared/creator-kit";
import { displayStyle, pressable } from "./styles";

type EventItem = BlockOf<"events">["items"][number];

/** Sold-out dates are not links (nothing to do); everything else leads to tickets. */
function EventLink({ href, className, children }: { href: string | null; className: string; children: ReactNode }) {
  return href ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

function EventRow({ event, surface }: { event: EventItem; surface: string }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const f = useCreatorFormat(locale);
  const soldOut = event.status === "soldout";
  const place = event.name ? `${event.city} · ${event.venue}` : event.venue;
  return (
    <EventLink href={soldOut ? null : event.url} className={cn("flex items-center gap-4 rounded-creator-card p-3", surface, !soldOut && pressable)}>
      <span className="grid size-16 shrink-0 content-center justify-items-center gap-1 rounded-md bg-creator-bg leading-none">
        <span className="font-creator-display text-h2 leading-none" style={displayStyle}>
          {f.date(event.date, { day: "2-digit" })}
        </span>
        <span className="text-caption font-semibold text-creator-fg-muted uppercase">{f.date(event.date, { month: "short" })}</span>
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn("line-clamp-2 text-body-lg leading-snug font-semibold", soldOut && "text-creator-fg-muted line-through")}>{event.name ?? event.city}</span>
        <span className="truncate text-small text-creator-fg-muted">
          {place}
          {event.time ? ` · ${event.time}` : null}
        </span>
        {event.status === "few" || soldOut ? (
          <span className={cn("text-caption font-semibold tracking-wide uppercase", soldOut ? "text-creator-fg-muted" : "text-creator-accent-text")}>
            {soldOut ? t("soldOut") : t("fewLeft")}
          </span>
        ) : null}
      </span>
      {soldOut ? null : (
        <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-creator-accent text-creator-accent-fg">
          <Icon icon={Ticket} size="sm" label={t("tickets")} />
        </span>
      )}
    </EventLink>
  );
}

const monthKey = (iso: string): string => iso.slice(0, 7);

/**
 * Dates grouped by month behind tabs ("All" first, so nothing is hidden by default or without JS).
 * ARIA tabs: arrow keys move (mirrored in RTL), Home/End jump, focus follows selection.
 */
export function EventTabs({ items, surface }: { items: EventItem[]; surface: string }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const baseId = useId();
  const months = [...new Set(items.map((item) => monthKey(item.date)))].sort();
  const tabs = ["all", ...months];
  const [selected, setSelected] = useState("all");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
  const visible = selected === "all" ? items : items.filter((item) => monthKey(item.date) === selected);

  const list = (
    <ol className="grid gap-2">
      {visible.map((event) => (
        <li key={event.date + event.city}>
          <EventRow event={event} surface={surface} />
        </li>
      ))}
    </ol>
  );
  if (months.length < 2) return list;

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = isRtl ? "ArrowLeft" : "ArrowRight";
    const previous = isRtl ? "ArrowRight" : "ArrowLeft";
    let target: number | null = null;
    if (event.key === next) target = (index + 1) % tabs.length;
    else if (event.key === previous) target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    if (target === null) return;
    event.preventDefault();
    setSelected(tabs[target] ?? "all");
    refs.current[target]?.focus();
  };

  return (
    <div className="grid gap-3">
      <div className="-mx-creator-gutter overflow-x-auto px-creator-gutter @prose:mx-0 @prose:px-0">
        <div role="tablist" aria-label={t("filterMonths")} className="flex w-max gap-2">
          {tabs.map((tab, index) => {
            const isSelected = tab === selected;
            return (
              <button
                key={tab}
                ref={(node) => {
                  refs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab}`}
                aria-selected={isSelected}
                aria-controls={`${baseId}-panel`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setSelected(tab)}
                onKeyDown={(event) => move(event, index)}
                className={cn(
                  "inline-flex h-control-sm shrink-0 items-center rounded-full px-4 text-small font-semibold uppercase transition-colors duration-micro focus-visible:focus-ring",
                  isSelected ? "bg-creator-accent text-creator-accent-fg" : "bg-creator-surface-2 text-creator-fg hover:bg-creator-surface",
                )}
              >
                {tab === "all" ? t("allDates") : monthLabel.format(new Date(`${tab}-01T12:00:00Z`))}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${selected}`} tabIndex={0} className="rounded-creator-card focus-visible:focus-ring">
        {list}
      </div>
    </div>
  );
}
