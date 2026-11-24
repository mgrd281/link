"use client";

import { ChartTable, cn } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState, type CSSProperties, type KeyboardEvent } from "react";

/**
 * Charts for the team console (dataviz rules: one series = one hue, the primary; recessive grid;
 * hover and arrow keys read a point out; every chart has the same numbers as a table).
 */

const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
};

export interface Point {
  date: string;
  value: number;
}

/** Columns over time, one series. `format` turns a value into its label (count, money …). */
export function ColumnChart({
  points,
  label,
  format,
  dateStyle = "day",
}: {
  points: Point[];
  label: string;
  format: (value: number) => string;
  dateStyle?: "day" | "month";
}) {
  const t = useTranslations("admin.charts");
  const ui = useTranslations("ui");
  const locale = useLocale();
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...points.map((point) => point.value)));
  const ticks = [0, 0.5, 1].map((fraction) => top * fraction);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(
      locale,
      dateStyle === "month"
        ? { month: "short", year: "2-digit", timeZone: "UTC" }
        : { day: "numeric", month: "short", timeZone: "UTC" },
    ).format(new Date(iso));
  const shown = points[active ?? points.length - 1];
  const every = Math.max(1, Math.ceil(points.length / 6));

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (![forward, back, "Home", "End", "Escape"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Escape") {
      setActive(null);
      return;
    }
    setActive((index) => {
      if (event.key === "Home") return 0;
      if (event.key === "End") return points.length - 1;
      const from = index ?? points.length - 1;
      return Math.max(0, Math.min(points.length - 1, from + (event.key === forward ? 1 : -1)));
    });
  };

  return (
    <figure className="grid grid-cols-1 gap-2">
      <p aria-hidden className="text-small text-fg-secondary flex items-baseline gap-2">
        <span className="text-body-lg text-fg font-semibold tabular-nums">
          {shown ? format(shown.value) : ""}
        </span>
        <span>{shown ? date(shown.date) : ""}</span>
      </p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div
          aria-hidden
          className="text-caption text-fg-tertiary relative h-(--container-menu) w-12 text-end tabular-nums"
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute end-0 bottom-(--y) translate-y-1/2"
              style={{ "--y": `${(tick / top) * 100}%` } as CSSProperties}
            >
              {format(tick)}
            </span>
          ))}
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label={t("keys", { label })}
          aria-valuemin={1}
          aria-valuemax={points.length}
          aria-valuenow={(active ?? points.length - 1) + 1}
          aria-valuetext={shown ? `${date(shown.date)}: ${format(shown.value)}` : ""}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="focus-visible:focus-ring relative h-(--container-menu) rounded-sm"
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden
              className="border-line absolute inset-x-0 bottom-(--y) border-t"
              style={{ "--y": `${(tick / top) * 100}%` } as CSSProperties}
            />
          ))}
          <ol aria-hidden className="absolute inset-0 grid auto-cols-fr grid-flow-col items-end gap-0.5">
            {points.map((point, index) => (
              <li
                key={point.date}
                onPointerEnter={() => setActive(index)}
                className="flex h-full items-end justify-center"
              >
                <span
                  className={cn(
                    "bg-primary duration-micro h-(--h) w-full max-w-8 rounded-t-xs transition-opacity",
                    active !== null && active !== index && "opacity-secondary",
                  )}
                  style={
                    {
                      "--h": `${point.value > 0 ? Math.max(2, (point.value / top) * 100) : 0}%`,
                    } as CSSProperties
                  }
                />
              </li>
            ))}
          </ol>
        </div>
        <span aria-hidden />
        <div aria-hidden className="text-caption text-fg-tertiary mt-1 grid h-4 auto-cols-fr grid-flow-col">
          {points.map((point, index) => (
            <span key={point.date} className="relative">
              {index % every === 0 ? (
                // Every other label hides on narrow screens so neighbours never touch.
                <span className={cn("absolute start-1/2 -translate-x-1/2 whitespace-nowrap rtl:translate-x-1/2", (index / every) % 2 === 1 && "max-sm:hidden")}>
                  {date(point.date)}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
      {/* The same numbers as a table, one tap away (A-12: the kit's toggle, no native disclosure). */}
      <ChartTable
        caption={label}
        columns={[
          { key: "date", label: t("date"), cell: (point: Point) => date(point.date) },
          { key: "value", label, numeric: true, cell: (point: Point) => format(point.value) },
        ]}
        rows={points}
        rowKey={(point) => point.date}
        showLabel={ui("chartTable.show")}
        hideLabel={ui("chartTable.hide")}
      />
    </figure>
  );
}

/** Ranked horizontal bars, one series (countries, devices, kinds …). Values are on the bars. */
export function RankedBars({
  items,
  label,
  format,
}: {
  items: { key: string; label: string; value: number }[];
  label: string;
  format: (value: number) => string;
}) {
  const top = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul aria-label={label} className="grid grid-cols-1 gap-2">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-1 gap-1">
          <div className="text-small flex items-baseline justify-between gap-3">
            <span className="truncate">{item.label}</span>
            <span className="text-fg-secondary shrink-0 tabular-nums">{format(item.value)}</span>
          </div>
          <span aria-hidden className="bg-canvas-muted block h-2 overflow-hidden rounded-full">
            <span
              className="bg-primary block h-full w-(--w) rounded-full"
              style={{ "--w": `${(item.value / top) * 100}%` } as CSSProperties}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sequential steps of the brand teal for 0–100 %, light to dark; text turns white from teal-500 (AA on every step). */
const STEPS = [
  "bg-teal-50",
  "bg-teal-100",
  "bg-teal-200",
  "bg-teal-300",
  "bg-teal-400",
  "bg-teal-500",
  "bg-teal-700",
] as const;
const step = (share: number) => Math.min(STEPS.length - 1, Math.round(share * (STEPS.length - 1)));

/** Weekly cohorts: rows by sign-up week, columns weeks later, each cell the share still active. */
export function CohortGrid({
  rows,
  label,
}: {
  rows: { start: string; size: number; cells: (number | null)[] }[];
  label: string;
}) {
  const t = useTranslations("admin.charts");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const weeks = rows[0]?.cells.length ?? 0;
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
        <table className="min-w-prose text-caption w-full border-separate border-spacing-0.5">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-fg-tertiary">
              <th scope="col" className="px-2 py-1 text-start font-medium">
                {t("cohort")}
              </th>
              <th scope="col" className="px-2 py-1 text-end font-medium">
                {t("size")}
              </th>
              {Array.from({ length: weeks }, (_, week) => (
                <th key={week} scope="col" className="px-1 py-1 text-center font-medium">
                  {t("week", { week })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.start}>
                <th scope="row" className="px-2 py-1 text-start font-medium whitespace-nowrap">
                  {date.format(new Date(row.start))}
                </th>
                <td className="text-fg-secondary px-2 py-1 text-end tabular-nums">{row.size}</td>
                {row.cells.map((cell, week) =>
                  cell === null ? (
                    <td key={week} />
                  ) : (
                    <td
                      key={week}
                      className={cn(
                        "rounded-xs px-1 py-2 text-center tabular-nums",
                        STEPS[step(cell)],
                        step(cell) >= 5 ? "text-white" : "text-ink",
                      )}
                    >
                      {percent.format(cell)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-hidden className="text-caption text-fg-tertiary flex items-center gap-2">
        <span>0 %</span>
        <span className="flex gap-0.5">
          {STEPS.map((color) => (
            <span key={color} className={cn("size-3 rounded-xs", color)} />
          ))}
        </span>
        <span>100 %</span>
      </div>
    </div>
  );
}
