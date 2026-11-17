"use client";

import { Button, Icon, TextField } from "@linkyo/ui";
import { ArrowLeft, AtSign, CircleCheck, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";

import { Link } from "@/i18n/navigation";

import { accountStore } from "../store";
import type { AuthError } from "../types";
import { AuthHeading } from "./auth-shell";
import { FormError, PasswordField } from "./fields";

/**
 * Reset. With real accounts this sends a link by email. In demo mode no email can be sent, so it
 * says so and lets the person set a new password right here (the data is only in this browser).
 */
export function ForgotForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | "required" | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("required");
      return;
    }
    setBusy(true);
    const result = await accountStore.resetPassword({ email, password });
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  };

  if (done) {
    return (
      <>
        <span className="grid size-control-xl place-items-center rounded-full bg-success-subtle text-success-strong">
          <Icon icon={CircleCheck} size="lg" />
        </span>
        <AuthHeading title={t("forgot.doneTitle")} lead={t("forgot.done")} />
        <Button asChild variant="primary" size="xl" block>
          <Link href="/login">{t("forgot.toLogin")}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading title={t("forgot.title")} lead={t("forgot.lead")} />
      <p className="flex items-start gap-2 rounded-md bg-selected p-3 text-small text-selected-fg">
        <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
        {t("forgot.demoNote")}
      </p>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-5">
        <FormError message={error ? t(`errors.${error}`) : null} />
        <TextField
          label={t("fields.email")}
          size="lg"
          ltr
          type="email"
          icon={AtSign}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          autoComplete="email"
          inputMode="email"
          required
        />
        <PasswordField
          label={t("fields.newPassword")}
          size="lg"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          autoComplete="new-password"
          required
          checks={{ email }}
        />
        <Button type="submit" variant="primary" size="xl" block loading={busy}>
          {t("forgot.submit")}
        </Button>
      </form>
      <Link href="/login" className="inline-flex items-center gap-2 justify-self-start rounded-xs text-small font-medium text-link underline-offset-4 hover:underline focus-visible:focus-ring">
        <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
        {t("forgot.back")}
      </Link>
    </>
  );
}
