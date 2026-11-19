"use client";

import { tokens } from "@linkyo/tokens";
import { Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "./lib/cn";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={tokens.motion.delay.tooltip} skipDelayDuration={tokens.motion.delay.tooltipSkip}>
      {children}
    </T.Provider>
  );
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left" | undefined;
  /** Keyboard shortcut shown after the label. */
  shortcut?: string | undefined;
}

export function Tooltip({ content, children, side = "top", shortcut }: TooltipProps) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={tokens.spacing["2"]}
          collisionPadding={tokens.spacing["2"]}
          className={cn(
            "layer-tooltip flex items-center gap-2 rounded-sm bg-fg px-2 py-1 text-caption text-fg-inverse",
            "motion-safe:animate-fade-in",
          )}
        >
          {content}
          {shortcut ? <kbd className="font-sans text-caption opacity-secondary">{shortcut}</kbd> : null}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
