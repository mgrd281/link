"use client";

import { ChevronDown, CircleAlert } from "lucide-react";
import { forwardRef, useId, type ForwardedRef, type ReactNode, type SelectHTMLAttributes } from "react";

import { Icon } from "./icon";
import { cn } from "./lib/cn";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean | undefined;
  /** The option's own language (e.g. "ar" for "العربية"), so a screen reader reads it in that voice. */
  lang?: string | undefined;
}

export interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange" | "size" | "children"> {
  label: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean | undefined;
  value: T | "";
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  /** A first, empty choice ("Alle Rollen"), shown while nothing is chosen. */
  placeholder?: string | undefined;
  hint?: ReactNode;
  /** Error message. Says what happened and how to fix it (brand §2). */
  error?: string | undefined;
  /**
   * "md": 40 px (dense lists, the team console on laptops); "lg": 48 px; "auto": 48 px on touch screens
   * and 40 px with a mouse on wide screens, like `TextField`.
   */
  size?: "md" | "lg" | "auto";
}

/**
 * A select: the system's own list (the native picker on iOS and Android, the keyboard and screen
 * reader behaviour every browser already has), framed like a text field with Linkyo's chevron. One
 * component for the dashboard and the team console instead of unstyled `<select>`s (A-12).
 * Right to left it follows the page: the chevron sits at the end, the text at the start.
 */
function SelectInner<T extends string>(
  { label, hideLabel = false, value, onValueChange, options, placeholder, hint, error, size = "md", className, id, disabled, ...props }: SelectProps<T>,
  ref: ForwardedRef<HTMLSelectElement>,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const messageId = `${selectId}-message`;
  const hasMessage = hint !== undefined || error !== undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={selectId} className={cn("text-small text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className={cn("relative grid", disabled && "opacity-disabled")}>
        <select
          ref={ref}
          id={selectId}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          onChange={(event) => onValueChange(event.target.value as T)}
          className={cn(
            // 16 px text from touch screens up: iOS zooms into a smaller select when it is focused.
            "min-w-0 cursor-pointer appearance-none truncate rounded-md border text-start text-fg outline-none",
            "transition-[border-color,background-color] duration-micro ease-standard",
            "focus-visible:border-focus focus-visible:focus-field disabled:cursor-not-allowed",
            error
              ? "border-danger-strong bg-danger-subtle [--color-focus:var(--color-danger-strong)]"
              : "border-line-input bg-surface-elevated hover:border-fg-tertiary",
            size === "md" && "h-control-md ps-3 pe-10 text-small pointer-coarse:text-body",
            size === "lg" && "h-control-lg ps-4 pe-10 text-body",
            size === "auto" && "h-control-lg ps-4 pe-10 text-body lg:pointer-fine:h-control-md lg:pointer-fine:ps-3 lg:pointer-fine:text-small",
            value === "" && "text-fg-secondary",
          )}
          {...props}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled} lang={option.lang}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon icon={ChevronDown} size="sm" className="pointer-events-none absolute inset-y-0 end-3 my-auto text-fg-tertiary" />
      </div>
      {hasMessage ? (
        <div id={messageId} aria-live="polite" className="text-small">
          {error ? (
            <span className="flex items-start gap-2 text-danger-strong">
              <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
              {error}
            </span>
          ) : (
            <span className="block font-regular text-fg-secondary">{hint}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

export const Select = forwardRef(SelectInner) as <T extends string>(
  props: SelectProps<T> & { ref?: ForwardedRef<HTMLSelectElement> },
) => ReturnType<typeof SelectInner>;
