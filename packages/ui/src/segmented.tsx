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
}

export interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string | undefined;
}

export function Segmented<T extends string>({ value, onValueChange, options, label, size = "md", className }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={label}
      className={cn(
        "inline-flex items-stretch gap-0.5 rounded-md bg-canvas-muted p-0.5",
        size === "sm" ? "h-control-sm" : "h-control-md",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          aria-label={option.iconOnly ? option.label : undefined}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-sm border border-transparent px-3 font-medium text-fg-secondary",
            "transition-[background-color,border-color,color] duration-micro ease-standard",
            "hover:text-fg focus-visible:focus-ring",
            "data-[state=on]:border-line data-[state=on]:bg-surface-elevated data-[state=on]:text-fg",
            size === "sm" ? "text-caption" : "text-small",
            option.iconOnly && "px-2",
          )}
        >
          {option.icon ? <Icon icon={option.icon} size="sm" /> : null}
          {option.iconOnly ? null : option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
