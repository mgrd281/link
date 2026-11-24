"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { Icon } from "./icon";
import { cn } from "./lib/cn";
import { Spinner } from "./spinner";
import { Tooltip } from "./tooltip";

const iconButtonVariants = cva(
  [
    "relative inline-grid shrink-0 place-items-center rounded-md text-fg",
    "transition-[background-color,color,scale] duration-micro ease-standard",
    "focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none",
    "disabled:pointer-events-none disabled:opacity-disabled",
    // 40 px visual, 44 pt hit area on touch screens.
    "before:absolute before:inset-0 pointer-coarse:before:-inset-0.5",
  ],
  {
    variants: {
      variant: {
        ghost: "hover:bg-hover active:bg-pressed data-[state=on]:bg-selected",
        secondary: "border border-line-strong bg-surface hover:bg-surface-elevated active:bg-pressed",
        /** A soft teal fill, as on iOS: quiet controls next to content (a sheet's close, previous, next). */
        tinted: "bg-tinted text-tinted-fg hover:bg-tinted-hover active:bg-tinted-hover",
        primary: "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-pressed",
      },
      size: {
        sm: "size-control-sm",
        md: "size-icon-button",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label">,
    VariantProps<typeof iconButtonVariants> {
  icon: LucideIcon;
  /** Required: used for aria-label and the tooltip (brand §7). */
  label: string;
  shortcut?: string | undefined;
  loading?: boolean | undefined;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  /** A filled glyph: media transport (play, pause, stop), as on `Icon`. */
  solid?: boolean | undefined;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, shortcut, loading = false, variant, size, className, tooltipSide, solid = false, ...props },
  ref,
) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-busy={loading || undefined}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {/* Directional glyphs mirror themselves in right-to-left text (Icon): never flip the button too. */}
        {loading ? <Spinner className="size-icon-md" /> : <Icon icon={icon} size="md" solid={solid} />}
      </button>
    </Tooltip>
  );
});
