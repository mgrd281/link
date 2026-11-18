"use client";

import { Button, TextField } from "@linkyo/ui";
import { AtSign } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type SubmitEvent } from "react";

import { Link } from "@/i18n/navigation";

import { accountStore } from "../store";
import type { AuthError } from "../types";
import { AuthHeading } from "./auth-shell";
import { FormError, OrDivider, PasswordField } from "./fields";
import { SocialButtons, useLeaveWhenSignedIn } from "./shared";

export function LoginForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | "required" | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  // After a failed attempt the message is focused once it is on screen, so it is read out.
  useEffect(() => {
    if (attempt > 0) errorRef.current?.querySelector<HTMLElement>("[role=alert]")?.focus();
  }, [attempt]);
  const leaving = useLeaveWhenSignedIn();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("required");
      document.getElementById(email.trim() ? "login-password" : "login-email")?.focus();
      return;
    }
    setBusy(true);
    const result = await accountStore.logIn({ email, password });
    setBusy(false);
    if (result.ok) return;
    setError(result.error);
    setPassword("");
    setAttempt((count) => count + 1);
  };

  return (
    <>
      <AuthHeading title={t("login.title")} lead={t("login.lead")} />
      <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-5">
        <div ref={errorRef}>
          <FormError message={error ? t(`errors.${error}`) : null} />
        </div>
        <TextField
          id="login-email"
          label={t("fields.email")}
          size="lg"
          ltr
          type="email"
          icon={AtSign}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />
        <div className="grid grid-cols-1 gap-2">
          <PasswordField
            id="login-password"
            label={t("fields.password")}
            size="lg"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <Link href="/forgot" className="justify-self-end rounded-xs text-small font-medium text-link underline-offset-4 hover:underline focus-visible:focus-ring">
            {t("login.forgot")}
          </Link>
        </div>
        <Button type="submit" variant="primary" size="xl" block loading={busy || leaving}>
          {t("login.submit")}
        </Button>
      </form>
      <OrDivider label={t("social.or")} />
      <SocialButtons />
      <p className="text-small text-fg-secondary">
        {t("login.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-link underline-offset-4 hover:underline focus-visible:focus-ring">
          {t("login.signup")}
        </Link>
      </p>
    </>
  );
}
