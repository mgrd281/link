"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Icon } from "./icon";
import { cn } from "./lib/cn";
import { Spinner } from "./spinner";

/**
 * Button shapes (one rule everywhere, plan §5 row 9, D-14):
 * - **rounded-md** is the default shape of every button: inside cards, lists, sheets, dialogs, toolbars
 *   and empty states, on every surface.
 * - **pill** (`rounded-full`) only for the footer of a step-by-step flow (welcome, checkout: "Weiter",
 *   "Zurück") and for the lone call to action of a website section (`size="cta"`, which is a pill).
 * - Icon-only round buttons (a sheet's close, a rail's previous and next) are `IconButton` with
 *   `rounded-full`; they carry no text, so they do not count as pills.
 * Never mix the two shapes in one row.
 */
export const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
    "transition-[background-color,border-color,color,scale,translate] duration-micro ease-standard",
    "focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none",
    "disabled:pointer-events-none disabled:opacity-disabled aria-disabled:pointer-events-none aria-disabled:opacity-disabled",
    "data-loading:pointer-events-none",
    // Forced colours (Windows High Contrast) draw a transparent border in the system colour, so a
    // filled button keeps a visible edge there; normal rendering does not change.
    "forced-colors:border forced-colors:border-transparent",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-pressed",
        secondary:
          "border border-line-strong bg-surface text-fg hover:bg-surface-elevated hover:border-line-input active:bg-pressed",
        /** The quiet partner of a primary action (as on iOS): a soft teal fill, never an outline. */
        tinted: "bg-tinted text-tinted-fg hover:bg-tinted-hover active:bg-tinted-hover",
        ghost: "bg-transparent text-fg hover:bg-hover active:bg-pressed",
        destructive: "bg-transparent text-danger-strong hover:bg-danger-subtle active:bg-pressed",
        /** Only inside confirmation dialogs (brand §7). */
        "destructive-solid": "bg-danger-fill text-danger-fill-fg hover:bg-danger-strong active:bg-danger-strong",
      },
      size: {
        /** 32 px to see, a 48 px tall target on touch screens (the hit area grows past the edges). */
        sm: "h-control-sm rounded-sm px-3 text-small before:absolute before:inset-x-0 before:-inset-y-2 pointer-fine:before:hidden",
        md: "h-control-md px-4 text-small",
        lg: "h-control-lg px-5 text-body",
        xl: "h-control-xl px-6 text-body",
        /** A lone primary action on the website (sign-up, keep this page, see all): one shape everywhere. */
        cta: "h-control-xl rounded-full px-6 text-body font-semibold",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [
      // Only the website's lone call to action lifts on hover; buttons inside the product stay put.
      { variant: "primary", size: "cta", class: "hover:-translate-y-0.5 active:translate-y-0 motion-reduce:hover:translate-y-0" },
    ],
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Leading icon (16/20 px). Only when it adds meaning. A directional glyph (an arrow back, a chevron)
   * mirrors itself in right-to-left text: never add `[&_svg]:rtl:-scale-x-100` or flip the button.
   */
  icon?: LucideIcon | undefined;
  /** Shows a spinner; keeps the label and width, blocks clicks. */
  loading?: boolean | undefined;
  /** Render the child element (e.g. a link) with button styles. */
  asChild?: boolean | undefined;
  /** Trailing element, e.g. a <Kbd>. */
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, icon, loading = false, asChild = false, trailing, children, disabled, ...props },
  ref,
) {
  const iconSize = size === "lg" || size === "xl" || size === "cta" ? "md" : "sm";
  const leading = icon ? (
    loading ? (
      <Spinner className={iconSize === "md" ? "size-icon-md" : "size-icon-sm"} />
    ) : (
      <Icon icon={icon} size={iconSize} />
    )
  ) : null;

  const classes = cn(buttonVariants({ variant, size, block }), className);

  if (asChild) {
    // A link styled as a button keeps its icon: the icon and any trailing element go inside the link.
    // They must be direct children of the slot, next to <Slottable>, for the slot to find its target.
    return (
      <Slot.Root ref={ref} className={classes} aria-disabled={disabled ? true : undefined} aria-busy={loading || undefined} {...props}>
        {leading}
        <Slot.Slottable>{children}</Slot.Slottable>
        {trailing}
      </Slot.Root>
    );
  }

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
      data-loading={loading ? "" : undefined}
      type={props.type ?? "button"}
      {...props}
    >
      {leading}
      {/* Without an icon the spinner overlays the label; the label keeps the width and the accessible name. */}
      <span className={cn("inline-flex items-center gap-2", loading && !icon && "opacity-0")}>{children}</span>
      {loading && !icon ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner className={iconSize === "md" ? "size-icon-md" : "size-icon-sm"} />
        </span>
      ) : null}
      {trailing}
    </button>
  );
});
