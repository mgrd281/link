import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "./lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium", {
  variants: {
    tone: {
      neutral: "bg-canvas-muted text-fg-secondary",
      primary: "bg-selected text-selected-fg",
      success: "bg-success-subtle text-success-strong",
      warning: "bg-warning-subtle text-warning-strong",
      danger: "bg-danger-subtle text-danger-strong",
      /** Spark: Live, celebration. Use sparingly (≤ 5 % of a screen). */
      spark: "bg-spark text-spark-fg",
      outline: "border border-line-strong text-fg-secondary",
    },
    size: {
      sm: "h-5 px-2 text-caption",
      md: "h-6 px-3 text-caption",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Leading status dot (pulses for "spark" when motion is allowed). */
  dot?: boolean;
}

export function Badge({ tone, size, dot, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden
          className={cn("size-dot rounded-full bg-current", tone === "spark" && "motion-safe:animate-pulse")}
        />
      ) : null}
      {children}
    </span>
  );
}
