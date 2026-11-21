"use client";

import type { LucideIcon } from "lucide-react";
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
  size?: "md" | "lg" | "xl";
  /** "filled": a soft teal-50 box without a frame (sign-up, sign-in); "outline" everywhere else. */
  variant?: "outline" | "filled";
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel = false, hint, error, icon, leading, trailing, ltr = false, size = "md", variant = "outline", className, id, disabled, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

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
          variant === "outline"
            ? "rounded-md border-line-input bg-surface-elevated hover:border-fg-tertiary"
            : "rounded-lg border-transparent bg-canvas-muted hover:border-line-input focus-within:bg-surface-elevated",
          "focus-within:border-focus focus-within:focus-field",
          size === "md" && "h-control-md px-3",
          size === "lg" && "h-control-lg px-4",
          size === "xl" && "h-control-xl px-4 text-body-lg",
          error && "border-danger-strong focus-within:border-danger-strong",
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
          aria-describedby={describedBy}
          className="h-full min-w-0 flex-1 bg-transparent text-inherit outline-none placeholder:text-fg-tertiary disabled:cursor-not-allowed"
          {...props}
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="text-small text-danger-strong">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-small text-fg-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
