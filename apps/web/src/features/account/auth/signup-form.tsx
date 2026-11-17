"use client";

import { Button, Icon, TextField } from "@linkyo/ui";
import { ArrowRight, AtSign, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";
import { z } from "zod";

import { Link } from "@/i18n/navigation";

import { isStrongEnough } from "../password";
import { accountStore } from "../store";
import type { AuthError } from "../types";
import { AuthHeading } from "./auth-shell";
import { FormError, OrDivider, PasswordField } from "./fields";
import { SocialButtons, useLeaveWhenSignedIn, useSearchParam } from "./shared";

type Field = "username" | "email" | "password";
type Errors = Partial<Record<Field, AuthError | undefined>>;
const FIELD_OF: Partial<Record<AuthError, Field>> = {
  invalidUsername: "username",
  reservedUsername: "username",
  usernameTaken: "username",
  invalidEmail: "email",
  emailTaken: "email",
  weakPassword: "password",
};

const emailOk = (email: string) => z.email().safeParse(email.trim()).success;
const locales = ["de", "en", "ar"] as const;

/**
 * Three fields, one button. The address from the homepage is already filled in, availability is
 * checked while typing, and the password rules turn green as they are met.
 */
export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const prefill = useSearchParam("name").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
  const [typed, setTyped] = useState<string | null>(null);
  const username = typed ?? prefill;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const leaving = useLeaveWhenSignedIn();

  const status = username ? accountStore.usernameStatus(username) : null;
  const usernameError = errors.username ?? (username.length >= 3 && status && status !== "ok" ? status : undefined);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Errors = {};
    const nameStatus = accountStore.usernameStatus(username);
    if (nameStatus !== "ok") next.username = nameStatus;
    if (!emailOk(email)) next.email = "invalidEmail";
    if (!isStrongEnough(password, { email, username })) next.password = "weakPassword";
    setErrors(next);
    setBanner(null);
    const first = (["username", "email", "password"] as const).find((field) => next[field]);
    if (first) {
      document.getElementById(`signup-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const result = await accountStore.signUp({ email, password, username, locale: locales.find((code) => code === locale) ?? "de" });
    setBusy(false);
    if (result.ok) return; // useLeaveWhenSignedIn takes it from here.
    const field = FIELD_OF[result.error];
    if (field) {
      setErrors({ [field]: result.error } satisfies Errors);
      document.getElementById(`signup-${field}`)?.focus();
    } else {
      setBanner(result.error);
    }
  };

  return (
    <>
      <AuthHeading title={t("signup.title")} lead={t("signup.lead")} />
      <SocialButtons />
      <OrDivider label={t("social.or")} />
      <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-5">
        <FormError message={banner ? t(`errors.${banner}`) : null} />
        <TextField
          id="signup-username"
          label={t("fields.username")}
          size="lg"
          ltr
          leading="linkyo.app/"
          value={username}
          onChange={(event) => {
            setTyped(event.target.value.toLowerCase());
            setErrors((current) => ({ ...current, username: undefined }));
          }}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          required
          error={usernameError ? t(`errors.${usernameError}`) : undefined}
          hint={
            status === "ok" ? (
              <span className="flex items-center gap-2 text-success-strong">
                <Icon icon={CircleCheck} size="sm" />
                {t("fields.usernameOk", { name: username })}
              </span>
            ) : (
              t("fields.usernameHint")
            )
          }
        />
        <TextField
          id="signup-email"
          label={t("fields.email")}
          size="lg"
          ltr
          type="email"
          icon={AtSign}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          autoComplete="email"
          inputMode="email"
          required
          error={errors.email ? t(`errors.${errors.email}`) : undefined}
        />
        {errors.email === "emailTaken" ? (
          <p className="-mt-3 text-small">
            <Link href="/login" className="font-semibold text-link underline-offset-4 hover:underline focus-visible:focus-ring">
              {t("signup.loginInstead")}
            </Link>
          </p>
        ) : null}
        <PasswordField
          id="signup-password"
          label={t("fields.password")}
          size="lg"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          autoComplete="new-password"
          required
          checks={{ email, username }}
          error={errors.password ? t(`errors.${errors.password}`) : undefined}
        />
        <Button
          type="submit"
          variant="primary"
          size="xl"
          block
          loading={busy || leaving}
          trailing={<Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />}
        >
          {t("signup.submit")}
        </Button>
        <p className="text-caption text-fg-secondary">{t("signup.terms")}</p>
      </form>
      <p className="text-small text-fg-secondary">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-link underline-offset-4 hover:underline focus-visible:focus-ring">
          {t("signup.login")}
        </Link>
      </p>
    </>
  );
}
