"use client";

import { cn, Icon, TextField, type TextFieldProps } from "@linkyo/ui";
import { Check, Circle, CircleAlert, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, useState } from "react";

import { passwordChecks } from "../password";

/** Password with show/hide and, for new passwords, live checks that turn green as they are met. */
export const PasswordField = forwardRef<
  HTMLInputElement,
  Omit<TextFieldProps, "type" | "trailing" | "hint"> & { checks?: { email?: string; username?: string } | undefined }
>(function PasswordField({ checks, value, ...props }, ref) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  const text = typeof value === "string" ? value : "";
  const results = checks ? passwordChecks(text, checks) : null;
  return (
    <TextField
      ref={ref}
      {...props}
      value={value}
      ltr
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t("fields.hide") : t("fields.show")}
          aria-pressed={visible}
          className="-me-2 grid size-control-sm shrink-0 place-items-center rounded-sm text-fg-tertiary hover:bg-hover hover:text-fg focus-visible:focus-ring"
        >
          <Icon icon={visible ? EyeOff : Eye} size="sm" />
        </button>
      }
      hint={
        results ? (
          <span className="grid grid-cols-1 gap-1">
            {(["length", "mixed", "personal"] as const).map((key) => (
              <span key={key} className={cn("flex items-center gap-2", results[key] && text ? "text-success-strong" : "text-fg-secondary")}>
                <Icon icon={results[key] && text ? Check : Circle} size="sm" className="shrink-0" />
                {t(`checks.${key}`)}
                <span className="sr-only">{results[key] && text ? t("checks.met") : t("checks.open")}</span>
              </span>
            ))}
          </span>
        ) : undefined
      }
    />
  );
});

/** One error banner for the whole form (focusable so it is announced and reachable). */
export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" tabIndex={-1} className="flex items-start gap-2 rounded-md border border-danger-strong bg-danger-subtle p-3 text-small text-fg focus-visible:focus-ring">
      <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0 text-danger-strong" />
      {message}
    </p>
  );
}

/** "or" divider between social sign-in and email. */
export function OrDivider({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-3 text-caption text-fg-tertiary before:flex-1 before:border-t before:border-line after:flex-1 after:border-t after:border-line">{label}</p>
  );
}
