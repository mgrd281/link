"use client";

import { Button, TextField } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";
import { z } from "zod";

import { Link } from "@/i18n/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";

import { accountStore } from "../store";
import type { AuthError, CodeRequest } from "../types";
import { AuthHeading } from "./auth-shell";
import { CodeStep } from "./code-step";
import { FormError } from "./fields";
import { useLeaveWhenSignedIn, useSearchParam } from "./shared";

const locales = ["de", "en", "ar"] as const;

/**
 * Sign in without a password: the email, then the 6-digit code we send to it. With real accounts an
 * account that has a password (the team) can use it instead.
 */
export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<AuthError | "required" | "passwordRequired" | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<CodeRequest | null>(null);
  const [demoCode, setDemoCode] = useState<string | undefined>(undefined);
  const [withPassword, setWithPassword] = useState(false);
  const [password, setPassword] = useState("");
  const leaving = useLeaveWhenSignedIn();
  // Back from an email link that no longer works (expired or used): say so until the next try.
  const linkExpired = useSearchParam("link") === "expired";

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!z.email().safeParse(email.trim()).success) {
      // An empty field says what is missing; only a typed address that is not one "looks incomplete".
      setError(email.trim() === "" ? "required" : "invalidEmail");
      document.getElementById("login-email")?.focus();
      return;
    }
    if (withPassword) {
      if (password === "") {
        setError("passwordRequired");
        document.getElementById("login-password")?.focus();
        return;
      }
      setBusy(true);
      setError(null);
      const result = await accountStore.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        document.getElementById("login-password")?.focus();
      }
      return;
    }
    setBusy(true);
    setError(null);
    const codeRequest: CodeRequest = {
      email: email.trim(),
      locale: locales.find((code) => code === locale) ?? "de",
    };
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
        <FormError
          message={
            error && error !== "invalidEmail" && error !== "required" && error !== "passwordRequired"
              ? t(`errors.${error}`)
              : linkExpired
                ? t("errors.linkExpired")
                : null
          }
        />
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
            if (error === "invalidEmail" || error === "required") setError(null);
          }}
          autoComplete="email"
          inputMode="email"
          required
          error={error === "invalidEmail" || error === "required" ? t(`errors.${error}`) : undefined}
        />
        {withPassword && (
          <TextField
            id="login-password"
            label={t("fields.password")}
            hideLabel
            placeholder={t("fields.password")}
            variant="filled"
            size="xl"
            ltr
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error === "passwordRequired" || error === "wrongPassword") setError(null);
            }}
            autoComplete="current-password"
            required
            error={error === "passwordRequired" ? t("errors.passwordRequired") : undefined}
          />
        )}
        <Button type="submit" variant="primary" size="cta" block loading={busy || leaving}>
          {withPassword ? t("login.passwordSubmit") : t("login.submit")}
        </Button>
        {supabaseEnabled && (
          <button
            type="button"
            onClick={() => {
              setWithPassword((value) => !value);
              setPassword("");
              setError(null);
              window.setTimeout(
                () => document.getElementById(withPassword ? "login-email" : "login-password")?.focus(),
                0,
              );
            }}
            className="min-h-touch-target text-small text-link duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed mx-auto inline-flex items-center rounded-full px-3 font-semibold transition-colors"
          >
            {withPassword ? t("login.withCode") : t("login.withPassword")}
          </button>
        )}
      </form>
      <p className="text-small text-fg-secondary text-center">
        {t("login.noAccount")}{" "}
        <Link
          href="/signup"
          className="min-h-touch-target text-link duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed -mx-2 inline-flex items-center rounded-full px-2 font-semibold transition-colors"
        >
          {t("login.signup")}
        </Link>
      </p>
    </>
  );
}
