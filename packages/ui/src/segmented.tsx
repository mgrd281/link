"use client";

import type { LucideIcon } from "lucide-react";
import { ToggleGroup } from "radix-ui";

import { Icon } from "./icon";
import { cn } from "./lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Hide the label visually (icon-only segment). */
  iconOnly?: boolean;
  /** A fuller name for screen readers, when the visible label is short (a code like "DE"). */
  ariaLabel?: string;
  /** A count after the label ("Alle 14"), as a small badge. Read together with the label. */
  count?: number;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string | undefined;
  /** Formats a count for the badge (thousands separators in the page's language). Default: as is. */
  formatCount?: ((count: number) => string) | undefined;
}

/**
 * A segmented control: one choice out of a few. Segments never wrap ("Alle 14" stays on one line);
 * when they do not fit, the track scrolls sideways instead of breaking a label (A-11). The chosen
 * segment is a raised tile with an input-strength border, never colour alone.
 */
export function Segmented<T extends string>({ value, onValueChange, options, label, size = "md", className, formatCount = String }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={label}
      className={cn(
        "inline-flex max-w-full items-stretch gap-0.5 overflow-x-auto overscroll-x-contain rounded-md bg-canvas-muted p-0.5",
        size === "sm" ? "h-control-sm" : "h-control-md",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel ?? (option.iconOnly ? (option.count === undefined ? option.label : `${option.label} ${formatCount(option.count)}`) : undefined)}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-transparent px-3 font-medium text-fg-secondary",
            "transition-[background-color,border-color,color] duration-micro ease-standard",
            // Inside the edge: the track scrolls sideways, which would clip a ring drawn outside the segment.
            "hover:text-fg focus-visible:focus-field",
            // The input-strength border gives the selected segment 3:1 against the track (WCAG 1.4.11):
            // a white pill on the pale track alone is barely visible.
            "data-[state=on]:border-line-input data-[state=on]:bg-surface-elevated data-[state=on]:text-fg",
            // Forced colours flatten fills and borders to one system colour: an outline keeps the choice visible.
            "forced-colors:data-[state=on]:outline",
            size === "sm" ? "text-caption" : "text-small",
            option.iconOnly && "px-2",
          )}
        >
          {option.icon ? <Icon icon={option.icon} size="sm" /> : null}
          {option.iconOnly ? null : option.label}
          {option.count !== undefined && !option.iconOnly ? (
            <span className="rounded-full bg-hover px-2 text-caption font-medium tabular-nums text-fg-secondary">{formatCount(option.count)}</span>
          ) : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
