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
  trailing?: ReactNode;
  size?: "md" | "lg" | "xl";
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel = false, hint, error, icon, trailing, size = "md", className, id, disabled, ...props },
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
        className={cn(
          "group/field flex items-center gap-2 rounded-md border border-line-input bg-surface-elevated text-fg",
          "transition-[border-color,box-shadow] duration-micro ease-standard",
          "hover:border-fg-tertiary focus-within:border-focus focus-within:focus-ring",
          size === "md" && "h-control-md px-3",
          size === "lg" && "h-control-lg px-4",
          size === "xl" && "h-control-xl px-4 text-body-lg",
          error && "border-danger-strong focus-within:border-danger-strong",
          disabled && "opacity-disabled",
        )}
      >
        {icon ? <Icon icon={icon} size={size === "md" ? "sm" : "md"} className="text-fg-tertiary" /> : null}
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
