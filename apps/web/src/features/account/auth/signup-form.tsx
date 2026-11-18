"use client";

import { Button, Icon, TextField } from "@linkyo/ui";
import { ArrowRight, AtSign, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";
import { z } from "zod";

import { isKind, STARTERS } from "@/features/app/kinds";
import { findLook } from "@/features/examples/looks";
import { Link } from "@/i18n/navigation";

import { isStrongEnough } from "../password";
import { accountStore } from "../store";
import type { AuthError, SignUpInput } from "../types";
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
  inviteMismatch: "email",
  reservedForCreator: "username",
};

type Prepared =
  | { kind: "match"; username: string; theme: NonNullable<SignUpInput["prepared"]>["theme"]; page: NonNullable<SignUpInput["prepared"]>["page"] }
  | { kind: "reserved" | "mismatch" | "none" };

/** Asks the server whether the Linkyo team prepared a page for this email (the invite list stays there). */
async function lookUpPrepared(input: { email: string; username: string; invite: string; locale: string }): Promise<Prepared> {
  try {
    const response = await fetch("/api/prepared", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, invite: input.invite || undefined }),
    });
    return response.ok ? ((await response.json()) as Prepared) : { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}

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
  // From a prepared page's invite link: the address is theirs, only the email decides.
  const invite = useSearchParam("invite").replace(/[^a-z0-9-]/g, "").slice(0, 64);
  // From an example page ("?kind=journalist"): the new page starts with that kind's template.
  // From the template gallery ("?look=…"): exactly that example's look.
  const kindParam = useSearchParam("kind");
  const lookParam = useSearchParam("look");
  const look = findLook(lookParam);
  const kind = look ? look.kind : isKind(kindParam) ? kindParam : null;
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
    const signupLocale = locales.find((code) => code === locale) ?? "de";
    const prepared = await lookUpPrepared({ email, username, invite, locale: signupLocale });
    if (prepared.kind === "mismatch" || prepared.kind === "reserved") {
      setBusy(false);
      const field = prepared.kind === "mismatch" ? "email" : "username";
      setErrors({ [field]: prepared.kind === "mismatch" ? "inviteMismatch" : "reservedForCreator" } satisfies Errors);
      document.getElementById(`signup-${field}`)?.focus();
      return;
    }
    const result = await accountStore.signUp({
      email,
      password,
      username: prepared.kind === "match" ? prepared.username : username,
      locale: signupLocale,
      prepared: prepared.kind === "match" ? { page: prepared.page, theme: prepared.theme } : undefined,
      start: kind ? { kind, theme: look ? look.theme : STARTERS[kind].theme } : undefined,
    });
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
      {invite ? <AuthHeading title={t("signup.preparedTitle")} lead={t("signup.preparedLead")} /> : <AuthHeading title={t("signup.title")} lead={t("signup.lead")} />}
      <SocialButtons />
      {invite ? <p className="-mt-4 text-caption text-fg-secondary">{t("signup.preparedGoogle")}</p> : null}
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
          readOnly={Boolean(invite && prefill)}
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
                {invite && prefill ? t("fields.usernameReserved", { name: username }) : t("fields.usernameOk", { name: username })}
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
