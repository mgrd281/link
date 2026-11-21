import type { HTMLAttributes } from "react";

import { cn } from "./lib/cn";

/** A key or shortcut. Reads left to right in every language ("⌘K", not "K⌘" in Arabic). */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      dir="ltr"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line-strong bg-surface px-1 font-sans text-caption text-fg-secondary",
        className,
      )}
      {...props}
    />
  );
}
