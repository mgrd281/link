"use client";

import { Button, Icon, TextField } from "@linkyo/ui";
import { ArrowRight, AtSign, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";
import { z } from "zod";

import { isKind, STARTERS } from "@/features/app/kinds";
import { findLook } from "@/features/examples/looks";
import { Link } from "@/i18n/navigation";

import { accountStore } from "../store";
import type { AuthError, CodeRequest, SignUpInput } from "../types";
import { AuthHeading } from "./auth-shell";
import { CodeStep } from "./code-step";
import { FormError, OrDivider } from "./fields";
import { SocialButtons, useLeaveWhenSignedIn, useSearchParam, useUsernameStatus } from "./shared";

type Field = "username" | "email";
type Errors = Partial<Record<Field, AuthError | undefined>>;
const FIELD_OF: Partial<Record<AuthError, Field>> = {
  invalidUsername: "username",
  reservedUsername: "username",
  usernameTaken: "username",
  invalidEmail: "email",
  emailTaken: "email",
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
 * Two fields, one button, no password: the page address (filled in from the homepage, checked
 * while typing) and the email. The next step is the 6-digit code from the email.
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
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<CodeRequest | null>(null);
  const [demoCode, setDemoCode] = useState<string | undefined>(undefined);
  const leaving = useLeaveWhenSignedIn();

  const status = useUsernameStatus(username);
  const usernameError = errors.username ?? (username.length >= 3 && status && status !== "ok" && status !== "checking" ? status : undefined);

  const showError = (error: AuthError) => {
    const field = FIELD_OF[error];
    if (field) {
      setErrors({ [field]: error } satisfies Errors);
      document.getElementById(`signup-${field}`)?.focus();
    } else setBanner(error);
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Errors = {};
    const nameStatus = await accountStore.usernameStatus(username);
    if (nameStatus !== "ok") next.username = nameStatus;
    if (!emailOk(email)) next.email = "invalidEmail";
    setErrors(next);
    setBanner(null);
    const first = (["username", "email"] as const).find((field) => next[field]);
    if (first) {
      document.getElementById(`signup-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const signupLocale = locales.find((code) => code === locale) ?? "de";
    const prepared = await lookUpPrepared({ email, username, invite, locale: signupLocale });
    if (prepared.kind === "mismatch" || prepared.kind === "reserved") {
      setBusy(false);
      showError(prepared.kind === "mismatch" ? "inviteMismatch" : "reservedForCreator");
      return;
    }
    const codeRequest: CodeRequest = {
      email: email.trim(),
      locale: signupLocale,
      signUp: {
        username: prepared.kind === "match" ? prepared.username : username,
        prepared: prepared.kind === "match" ? { page: prepared.page, theme: prepared.theme } : undefined,
        invite: invite || undefined,
        start: kind ? { kind, theme: look ? look.theme : STARTERS[kind].theme } : undefined,
      },
    };
    const result = await accountStore.requestCode(codeRequest);
    setBusy(false);
    if (result.ok) {
      setDemoCode(result.demoCode);
      setRequest(codeRequest);
    } else showError(result.error);
  };

  if (request) {
    return (
      <CodeStep
        email={request.email}
        intent="signUp"
        demoCode={demoCode}
        // A correct code signs in; useLeaveWhenSignedIn then opens the welcome flow.
        onVerify={(code) => accountStore.verifyCode({ ...request, code })}
        onResend={async () => {
          const result = await accountStore.requestCode(request);
          if (result.ok) setDemoCode(result.demoCode);
          return result;
        }}
        onChangeEmail={() => {
          setRequest(null);
          setDemoCode(undefined);
          window.setTimeout(() => document.getElementById("signup-email")?.focus(), 0);
        }}
      />
    );
  }

  return (
    <>
      {invite ? <AuthHeading title={t("signup.preparedTitle")} lead={t("signup.preparedLead")} /> : <AuthHeading title={t("signup.title")} lead={t("signup.lead")} />}
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
        <Button
          type="submit"
          variant="primary"
          size="xl"
          block
          loading={busy || leaving}
          trailing={<Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover/button:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover/button:-translate-x-0.5" />}
        >
          {t("signup.submit")}
        </Button>
        <p className="text-caption text-pretty text-fg-secondary">{t("signup.terms")}</p>
      </form>
      <OrDivider label={t("social.or")} />
      <SocialButtons emailField="signup-email" />
      {invite ? <p className="-mt-4 text-caption text-fg-secondary">{t("signup.preparedGoogle")}</p> : null}
      <p className="text-small text-fg-secondary">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-link underline-offset-4 hover:underline focus-visible:focus-ring">
          {t("signup.login")}
        </Link>
      </p>
    </>
  );
}
