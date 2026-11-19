"use client";

import { tokens } from "@linkyo/tokens";
import type { LucideIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";

import { Icon } from "./icon";
import { cn } from "./lib/cn";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  destructive?: boolean;
  onSelect: () => void;
}

export function Menu({ trigger, items, align = "end" }: { trigger: ReactNode; items: MenuItem[]; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={tokens.spacing["1"]}
          collisionPadding={tokens.spacing["2"]}
          className="layer-popover min-w-menu rounded-md border border-line bg-surface-elevated p-1 text-fg motion-safe:animate-pop-in"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              onSelect={item.onSelect}
              className={cn(
                "flex h-control-sm cursor-default select-none items-center gap-2 rounded-sm px-2 text-small outline-none",
                "data-highlighted:bg-hover",
                item.destructive && "text-danger-strong",
              )}
            >
              {item.icon ? <Icon icon={item.icon} size="sm" /> : null}
              <span className="flex-1">{item.label}</span>
              {item.shortcut ? <span className="text-caption text-fg-tertiary">{item.shortcut}</span> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
