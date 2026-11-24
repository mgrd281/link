import { tokens } from "@linkyo/tokens";
import type { ReactNode } from "react";

import { Icon, MIRROR_IN_RTL } from "./icon";
import { icons } from "./icons";
import { cn } from "./lib/cn";
import { Skeleton } from "./skeleton";

export interface KpiDelta {
  /** The signed change; its sign picks the arrow (up, down, or a dash for none). */
  change: number;
  /** The change as shown, with its sign and unit ("+12 %", "−3"). */
  text: string;
  /** The direction in words, read before the text ("Gestiegen", "Gesunken", "Unverändert"). */
  label: string;
  /** What it compares with ("ggü. Vormonat"). Shown after the chip. */
  context?: string | undefined;
  /** Which way is good news; colour only ever adds to the arrow and the words. Default "up". */
  good?: "up" | "down" | "none" | undefined;
}

export interface KpiTileProps {
  label: string;
  /** The figure, formatted in the page's language. */
  value: string;
  delta?: KpiDelta | undefined;
  /** A small sparkline of the recent values, oldest first. */
  trend?: readonly number[] | undefined;
  /** What the sparkline shows ("Letzte 12 Wochen"), for screen readers. The numbers belong in a ChartTable. */
  trendLabel?: string | undefined;
  /** A note under the figure ("Noch nicht gemessen"), or a link to the details. */
  footer?: ReactNode;
  loading?: boolean | undefined;
  className?: string | undefined;
}

/** -1, 0 or 1. */
const direction = (change: number) => (change > 0 ? 1 : change < 0 ? -1 : 0);

/** Points of a sparkline in a 100 × 32 box (the svg stretches to its tile; the line keeps its width). */
export function sparklinePoints(values: readonly number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = values.length > 1 ? index * step : 50;
      const y = max === min ? 16 : 30 - ((value - min) / span) * 28;
      return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    })
    .join(" ");
}

/**
 * A key figure: label, value, the change as a chip (an arrow, a signed number and the direction in
 * words: never colour alone, WCAG 1.4.1) and an optional sparkline in the palette's primary role, so
 * it is teal in the team area and black in the dashboard (A-19). Time runs in the reading direction:
 * right to left, the trend arrow and the sparkline mirror.
 */
export function KpiTile({ label, value, delta, trend, trendLabel, footer, loading = false, className }: KpiTileProps) {
  const way = delta ? direction(delta.change) : 0;
  const good = delta?.good ?? "up";
  const tone = !delta || way === 0 || good === "none" ? "neutral" : (way > 0) === (good === "up") ? "good" : "bad";
  return (
    <div className={cn("grid min-w-0 content-start gap-2 rounded-lg border border-line bg-surface p-4", className)}>
      <dt className="truncate text-small text-fg-secondary">{label}</dt>
      <dd className="grid gap-2">
        {loading ? (
          <Skeleton className="h-control-sm w-24" />
        ) : (
          <span className="text-h2 tabular-nums">{value}</span>
        )}
        {delta && !loading ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 text-caption font-semibold tabular-nums",
                tone === "good" && "bg-success-subtle text-success-strong",
                tone === "bad" && "bg-danger-subtle text-danger-strong",
                tone === "neutral" && "bg-canvas-muted text-fg-secondary",
              )}
              data-tone={tone}
            >
              <Icon icon={way > 0 ? icons.increase : way < 0 ? icons.decrease : icons.unchanged} size="xs" strong />
              <span className="sr-only">{delta.label}: </span>
              <bdi dir="ltr">{delta.text}</bdi>
            </span>
            {delta.context ? <span className="text-caption text-fg-tertiary">{delta.context}</span> : null}
          </span>
        ) : null}
        {trend && trend.length > 1 && !loading ? (
          <svg
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
            className={cn("h-8 w-full text-primary", MIRROR_IN_RTL)}
            role={trendLabel ? "img" : undefined}
            aria-label={trendLabel}
            aria-hidden={trendLabel ? undefined : true}
            focusable="false"
          >
            <polyline
              points={sparklinePoints(trend)}
              fill="none"
              stroke="currentColor"
              strokeWidth={tokens.borderWidth.focus}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
        {footer ? <span className="text-caption text-fg-secondary">{footer}</span> : null}
      </dd>
    </div>
  );
}
