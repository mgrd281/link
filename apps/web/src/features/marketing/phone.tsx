import { cn } from "@linkyo/ui";
import type { ReactNode } from "react";

/** A phone frame: ink bezel, rounded screen and a camera island. Decorative chrome, content inside. */
export function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-xl border border-line-strong bg-ink p-2", className)}>
      <div className="relative isolate aspect-[390/844] overflow-hidden rounded-lg bg-canvas-muted">{children}</div>
      <span aria-hidden className="absolute inset-x-0 top-4 mx-auto h-5 w-1/4 rounded-full bg-ink" />
    </div>
  );
}
