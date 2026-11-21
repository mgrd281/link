"use client";

import { CircleAlert, type LucideIcon } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { Icon } from "./icon";
import { cn } from "./lib/cn";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean | undefined;
  hint?: ReactNode;
  /** Error message. Says what happened and how to fix it (brand §2). */
  error?: string | undefined;
  icon?: LucideIcon | undefined;
  /** Text before the value inside the box, e.g. "linkyo.app/". */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Lay the box out left-to-right in every language (addresses, emails, URLs). */
  ltr?: boolean | undefined;
  /**
   * "auto": 48 px on touch screens, 40 px with a mouse on wide screens (the dashboard's density), with
   * 16 px text so iOS does not zoom into the field.
   */
  size?: "md" | "lg" | "xl" | "auto";
  /** "filled": a soft teal-50 box without a frame (sign-up and sign-in); "outline": dashboard, welcome and admin. */
  variant?: "outline" | "filled";
  /**
   * Keep the message container mounted even with no hint or error, so an error that appears later is
   * announced (it is a polite live region).
   */
  live?: boolean | undefined;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel = false, hint, error, icon, leading, trailing, ltr = false, size = "md", variant = "outline", live = false, className, id, disabled, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const hasMessage = live || hint !== undefined || error !== undefined;
  // Free text runs in its own direction: a German name on an Arabic page reads left to right, with its
  // full stop at the end. An empty field follows the page (placeholder and caret on the page's side).
  // Left-to-right boxes, and dates, times and numbers (the browser lays those out), keep their direction.
  const freeText = props.type === undefined || props.type === "text" || props.type === "search";
  const textDir = !ltr && freeText && typeof props.value === "string" && props.value ? "auto" : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className={cn("text-small text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      <div
        dir={ltr ? "ltr" : undefined}
        className={cn(
          "group/field flex items-center gap-2 border text-fg",
          "transition-[border-color,background-color] duration-micro ease-standard",
          variant === "outline" ? "rounded-md" : "rounded-lg",
          // An invalid field is framed in red whatever its variant (the variant's own border and fill
          // would hide it), and its focus frame turns red too, so focus never covers the error.
          error
            ? "border-danger-strong bg-danger-subtle focus-within:border-danger-strong [--color-focus:var(--color-danger-strong)]"
            : variant === "outline"
              ? "border-line-input bg-surface-elevated hover:border-fg-tertiary focus-within:border-focus"
              : "border-transparent bg-canvas-muted hover:border-line-input focus-within:border-focus focus-within:bg-surface-elevated",
          "focus-within:focus-field",
          size === "md" && "h-control-md px-3",
          size === "lg" && "h-control-lg px-4",
          size === "xl" && "h-control-xl px-4 text-body-lg",
          size === "auto" && "h-control-lg px-4 text-body lg:pointer-fine:h-control-md lg:pointer-fine:px-3",
          disabled && "opacity-disabled",
        )}
      >
        {icon ? <Icon icon={icon} size={size === "md" ? "sm" : "md"} className="text-fg-tertiary" /> : null}
        {leading ? <span className="-me-2 shrink-0 text-fg-tertiary select-none">{leading}</span> : null}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          dir={textDir}
          className="h-full min-w-0 flex-1 bg-transparent text-start text-inherit outline-none placeholder:text-fg-tertiary disabled:cursor-not-allowed"
          {...props}
        />
        {trailing}
      </div>
      {/* One message element for the hint and the error, so the field's description is always the same
          element and a change is announced. Empty, it takes no space inside the gap-2 column. */}
      {hasMessage ? (
        <div id={messageId} aria-live="polite" className="text-small empty:-mt-2">
          {error ? (
            <span className="flex items-start gap-2 text-danger-strong">
              <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
              {error}
            </span>
          ) : hint ? (
            <span className="block font-regular text-fg-secondary">{hint}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
