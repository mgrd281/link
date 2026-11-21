"use client";

import { tokens } from "@linkyo/tokens";
import type { LucideIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Fragment, type ReactNode } from "react";

import { Icon } from "./icon";
import { cn } from "./lib/cn";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  destructive?: boolean;
  onSelect: () => void;
}

/**
 * A dropdown menu. With a mouse the rows stay compact; on touch screens they grow to a 48 px target
 * with body text, as in an iOS context menu, and keyboard hints are left out (a phone has no ⌥ key).
 * A destructive item is set apart by a separator, so it is not tapped by mistake.
 * It opens from its trigger and fades out quickly when closed; while it fades, it takes no clicks.
 */
export function Menu({ trigger, items, align = "end" }: { trigger: ReactNode; items: MenuItem[]; align?: "start" | "end" }) {
  const firstDestructive = items.findIndex((item) => item.destructive);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={tokens.spacing["1"]}
          collisionPadding={tokens.spacing["2"]}
          className={cn(
            "layer-popover min-w-menu origin-(--radix-dropdown-menu-content-transform-origin) rounded-md border border-line bg-surface-elevated p-1 text-fg",
            "motion-safe:animate-pop-in",
            // The duration shares the fade's variants, so it is emitted after the animation shorthand and wins.
            "data-[state=closed]:pointer-events-none data-[state=closed]:motion-safe:animate-fade-out data-[state=closed]:motion-safe:[animation-duration:var(--duration-micro)]",
          )}
        >
          {items.map((item, index) => (
            <Fragment key={item.label}>
              {index === firstDestructive && index > 0 ? <DropdownMenu.Separator className="my-1 border-t border-line" /> : null}
              <DropdownMenu.Item
                onSelect={item.onSelect}
                className={cn(
                  "flex h-control-sm pointer-coarse:h-control-lg cursor-default select-none items-center gap-2 pointer-coarse:gap-3 rounded-sm px-2 pointer-coarse:px-3 text-small pointer-coarse:text-body outline-none",
                  "focus-visible:focus-field",
                  item.destructive
                    ? "text-danger-strong data-highlighted:bg-danger-subtle"
                    : "data-highlighted:bg-selected data-highlighted:text-selected-fg",
                )}
              >
                {item.icon ? <Icon icon={item.icon} size="sm" /> : null}
                <span className="flex-1">{item.label}</span>
                {/* Shortcuts read left to right in every language ("⌥↑", not "↑⌥" in Arabic). */}
                {item.shortcut ? (
                  <span dir="ltr" className="hidden text-caption text-fg-tertiary pointer-fine:inline">
                    {item.shortcut}
                  </span>
                ) : null}
              </DropdownMenu.Item>
            </Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
