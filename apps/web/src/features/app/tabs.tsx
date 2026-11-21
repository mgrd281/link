"use client";

import { cn } from "@linkyo/ui";
import { useLocale } from "next-intl";
import { Tabs as TabsPrimitive } from "radix-ui";
import type { ReactNode } from "react";

import { isRtl } from "@/i18n/routing";

export interface TabsProps<T extends string> {
  /** Names the row of tabs for screen readers ("What to customize"). */
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  tabs: readonly { value: T; label: string }[];
  /** The active tab's content; the other tabs' content is not rendered. */
  children: (value: T) => ReactNode;
}

/**
 * A few tabs that look like the segmented control (a white pill in a pale track) but are real tabs:
 * `tablist` / `tab` / `tabpanel`, arrow keys move between them (mirrored in Arabic), Home and End
 * jump to the ends. Only the active panel holds content, so hidden controls never reach a screen
 * reader or a search; switching fades the new panel in (opacity only, and not at all under reduced
 * motion).
 */
export function Tabs<T extends string>({ label, value, onValueChange, tabs, children }: TabsProps<T>) {
  const rtl = isRtl(useLocale());
  return (
    <TabsPrimitive.Root value={value} onValueChange={(next) => onValueChange(next as T)} dir={rtl ? "rtl" : "ltr"} className="grid min-w-0 grid-cols-1 gap-4">
      <TabsPrimitive.List
        aria-label={label}
        className="inline-flex h-control-md w-full items-stretch gap-0.5 rounded-md bg-canvas-muted p-0.5 pointer-coarse:h-control-lg sm:w-auto sm:justify-self-start"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            // Radix focuses a pressed tab from script, which makes browsers draw the keyboard focus ring
            // for a mouse click. Select and focus it here instead, without the ring (the keyboard keeps it).
            onMouseDown={(event) => {
              if (event.button !== 0 || event.ctrlKey) return;
              event.preventDefault();
              onValueChange(tab.value);
              event.currentTarget.focus({ preventScroll: true, focusVisible: false });
            }}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center rounded-sm border border-transparent px-3 text-small font-medium whitespace-nowrap text-fg-secondary sm:flex-none",
              "transition-[background-color,border-color,color] duration-micro ease-standard hover:text-fg focus-visible:focus-ring",
              // As in the segmented control: the input-strength edge gives the chosen tab 3:1 on the track.
              "data-[state=active]:border-line-input data-[state=active]:bg-surface-elevated data-[state=active]:text-fg",
              // Forced colours flatten fills and borders to one system colour: an outline keeps the choice visible.
              "forced-colors:data-[state=active]:outline",
            )}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content key={tab.value} value={tab.value} className="min-w-0 rounded-sm focus-visible:focus-ring motion-safe:animate-fade-in">
          {tab.value === value ? children(tab.value) : null}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
