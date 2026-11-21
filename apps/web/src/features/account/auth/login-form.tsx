"use client";

import { Button, TextField } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";
import { z } from "zod";

import { Link } from "@/i18n/navigation";

import { accountStore } from "../store";
import type { AuthError, CodeRequest } from "../types";
import { AuthHeading } from "./auth-shell";
import { CodeStep } from "./code-step";
import { FormError, OrDivider } from "./fields";
import { SocialButtons, useLeaveWhenSignedIn, useSearchParam } from "./shared";

const locales = ["de", "en", "ar"] as const;

/** Sign in without a password: the email, then the 6-digit code we send to it. */
export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<CodeRequest | null>(null);
  const [demoCode, setDemoCode] = useState<string | undefined>(undefined);
  const leaving = useLeaveWhenSignedIn();
  // Back from an email link that no longer works (expired or used): say so until the next try.
  const linkExpired = useSearchParam("link") === "expired";

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!z.email().safeParse(email.trim()).success) {
      setError("invalidEmail");
      document.getElementById("login-email")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const codeRequest: CodeRequest = { email: email.trim(), locale: locales.find((code) => code === locale) ?? "de" };
    const result = await accountStore.requestCode(codeRequest);
    setBusy(false);
    if (result.ok) {
      setDemoCode(result.demoCode);
      setRequest(codeRequest);
    } else {
      setError(result.error);
      document.getElementById("login-email")?.focus();
    }
  };

  if (request) {
    return (
      <CodeStep
        email={request.email}
        intent="logIn"
        demoCode={demoCode}
        onVerify={(code) => accountStore.verifyCode({ ...request, code })}
        onResend={async () => {
          const result = await accountStore.requestCode(request);
          if (result.ok) setDemoCode(result.demoCode);
          return result;
        }}
        onChangeEmail={() => {
          setRequest(null);
          setDemoCode(undefined);
          window.setTimeout(() => document.getElementById("login-email")?.focus(), 0);
        }}
      />
    );
  }

  return (
    <>
      <AuthHeading title={t("login.title")} lead={t("login.lead")} />
      <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-4">
        <FormError message={error && error !== "invalidEmail" ? t(`errors.${error}`) : linkExpired ? t("errors.linkExpired") : null} />
        <TextField
          id="login-email"
          label={t("fields.email")}
          hideLabel
          placeholder={t("fields.email")}
          variant="filled"
          size="xl"
          ltr
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error === "invalidEmail") setError(null);
          }}
          autoComplete="email"
          inputMode="email"
          required
          error={error === "invalidEmail" ? t("errors.invalidEmail") : undefined}
        />
        <Button type="submit" variant="primary" size="cta" block loading={busy || leaving}>
          {t("login.submit")}
        </Button>
      </form>
      <OrDivider label={t("social.or")} />
      <SocialButtons emailField="login-email" />
      <p className="text-center text-small text-fg-secondary">
        {t("login.noAccount")}{" "}
        <Link href="/signup" className="-mx-2 inline-flex min-h-touch-target items-center rounded-full px-2 font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed">
          {t("login.signup")}
        </Link>
      </p>
    </>
  );
}
