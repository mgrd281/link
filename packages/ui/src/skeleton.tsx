import type { HTMLAttributes } from "react";

import { cn } from "./lib/cn";

/** Loading placeholder. Match the final layout's size so nothing jumps (CLS 0). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("rounded-sm bg-skeleton motion-safe:animate-pulse", className)} {...props} />;
}
