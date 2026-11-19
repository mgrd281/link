"use client";

import { Button, cn, Icon } from "@linkyo/ui";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";

import type { AuthError, Result } from "../types";
import { AuthHeading } from "./auth-shell";
import { FormError } from "./fields";

const LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * The 6-digit code as six boxes. One real input underneath (one label, paste and the phone's
 * "code from Mail/SMS" suggestion work), drawn as boxes; the digits stay left to right in Arabic.
 */
export function CodeField({ id, label, value, onValue, error, describedBy }: { id: string; label: string; value: string; onValue: (value: string) => void; error?: string | null | undefined; describedBy?: string | undefined }) {
  const [focused, setFocused] = useState(false);
  const errorId = `${id}-error`;
  return (
    <div className="grid grid-cols-1 gap-2">
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <div dir="ltr" className="relative max-w-preview">
        <div aria-hidden className="grid grid-cols-6 gap-2 sm:gap-3">
          {Array.from({ length: LENGTH }, (_, index) => {
            const digit = value[index] ?? "";
            const active = focused && (index === value.length || (value.length === LENGTH && index === LENGTH - 1));
            return (
              <span
                key={index}
                className={cn(
                  "grid aspect-square place-items-center rounded-lg border bg-canvas-muted text-h2 font-semibold tabular-nums transition-[border-color] duration-micro",
                  error ? "border-danger" : active ? "border-focus focus-ring" : digit ? "border-line-strong" : "border-transparent",
                )}
              >
                {digit || (active ? <span className="h-6 w-0.5 animate-pulse rounded-full bg-fg motion-reduce:animate-none" /> : null)}
              </span>
            );
          })}
        </div>
        <input
          id={id}
          value={value}
          onChange={(event) => {
            onValue(event.target.value.replace(/\D/g, "").slice(0, LENGTH));
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined}
          className="absolute inset-0 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
        />
      </div>
      {error ? (
        <p id={errorId} className="text-small text-danger-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Second step of signing up or in: the code from the email. Submits by itself once six digits are
 * in; a new code can be sent after 30 seconds, and the email can be changed.
 */
export function CodeStep({
  email,
  intent,
  demoCode,
  onVerify,
  onResend,
  onChangeEmail,
}: {
  email: string;
  intent: "signUp" | "logIn";
  demoCode?: string | undefined;
  onVerify: (code: string) => Promise<Result>;
  onResend: () => Promise<Result>;
  onChangeEmail: () => void;
}) {
  const t = useTranslations("auth");
  const id = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const tried = useRef("");

  // The code field takes focus at once (the heading and lead are read with it).
  useEffect(() => {
    document.getElementById(id)?.focus();
  }, [id]);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => {
      setWait((seconds) => seconds - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [wait]);

  const verify = async (value: string) => {
    if (value.length !== LENGTH) {
      setError("invalidCode");
      document.getElementById(id)?.focus();
      return;
    }
    tried.current = value;
    setBusy(true);
    setError(null);
    const result = await onVerify(value);
    setBusy(false);
    if (result.ok) return;
    setError(result.error);
    setCode("");
    document.getElementById(id)?.focus();
  };

  const resend = async () => {
    setError(null);
    setResent(false);
    const result = await onResend();
    if (result.ok) {
      setResent(true);
      setWait(RESEND_SECONDS);
      setCode("");
      document.getElementById(id)?.focus();
    } else setError(result.error);
  };

  const fieldError = error === "invalidCode" || error === "codeExpired" ? t(`errors.${error}`) : null;
  return (
    <>
      <AuthHeading title={t("code.title")} lead={t(intent === "signUp" ? "code.lead" : "code.leadLogin", { email })} />
      <form
        noValidate
        onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
          event.preventDefault();
          void verify(code);
        }}
        className="grid grid-cols-1 gap-5"
      >
        <FormError message={error && !fieldError ? t(`errors.${error}`) : null} />
        {demoCode ? (
          <p id={`${id}-demo`} className="flex items-start gap-2 rounded-lg bg-selected p-3 text-small text-selected-fg">
            <Icon icon={FlaskConical} size="sm" className="mt-0.5 shrink-0" />
            <span>{t.rich("code.demo", { code: demoCode, strong: (chunks) => <strong className="font-semibold tabular-nums">{chunks}</strong> })}</span>
          </p>
        ) : null}
        <CodeField
          id={id}
          label={t("fields.code")}
          value={code}
          onValue={(value) => {
            setCode(value);
            if (error) setError(null);
            // Six digits in: go on by itself (once per code, so a wrong one isn't sent twice).
            if (value.length === LENGTH && value !== tried.current && !busy) void verify(value);
          }}
          error={fieldError}
          describedBy={["auth-lead", demoCode ? `${id}-demo` : null].filter(Boolean).join(" ")}
        />
        <Button type="submit" variant="primary" size="xl" block loading={busy} trailing={<Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover/button:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover/button:-translate-x-0.5" />}>
          {t(intent === "signUp" ? "code.submit" : "code.submitLogin")}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3 text-small">
          <button type="button" onClick={onChangeEmail} className="rounded-xs font-medium text-fg-secondary hover:text-fg focus-visible:focus-ring">
            {t("code.change")}
          </button>
          <button
            type="button"
            disabled={wait > 0}
            onClick={() => void resend()}
            className="rounded-xs font-semibold text-link transition-colors duration-micro focus-visible:focus-ring enabled:hover:text-fg disabled:font-medium disabled:text-fg-tertiary"
          >
            {wait > 0 ? t("code.resendIn", { seconds: wait }) : t("code.resend")}
          </button>
        </div>
        <p role="status" className="text-caption text-fg-secondary">
          {resent ? t("code.resent") : t("code.spam")}
        </p>
      </form>
    </>
  );
}
