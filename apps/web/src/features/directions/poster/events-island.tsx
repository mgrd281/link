"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "../shared/cx";

/** One date of the list, drawn where the page is rendered (`./events.tsx`), with its month ("2026-12"). */
export interface EventRowNode {
  key: string;
  month: string;
  node: ReactNode;
}

/**
 * Dates grouped by month behind tabs ("All" first, so nothing is hidden by default or without JS).
 * ARIA tabs: arrow keys move (mirrored in RTL), Home/End jump, focus follows selection. The rows come
 * drawn; the island only chooses which of them show.
 */
export function EventTabsIsland({ months, rows }: { months: string[]; rows: EventRowNode[] }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const baseId = useId();
  const tabs = ["all", ...months];
  const [selected, setSelected] = useState("all");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
  const visible = selected === "all" ? rows : rows.filter((row) => row.month === selected);

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
                className={cx(
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
        <ol className="grid gap-2">
          {visible.map((row) => (
            <li key={row.key}>{row.node}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
