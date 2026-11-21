"use client";

import { isTemplate } from "@linkyo/tokens/creator";
import { Button, Icon, TextField } from "@linkyo/ui";
import { CircleCheck, Gift, Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type SubmitEvent } from "react";
import { z } from "zod";

import { isKind, STARTERS } from "@/features/app/kinds";
import { findLook } from "@/features/examples/looks";
import { isReferralCode } from "@/features/referrals/rules";
import { Link } from "@/i18n/navigation";

import { accountStore } from "../store";
import { readTryDraft } from "../try-draft";
import type { AuthError, CodeRequest, SignUpInput } from "../types";
import { newProvisionalUsername } from "../username";
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

/** A free neutral address for people who did not claim one yet; they pick theirs in the welcome flow. */
async function freeProvisionalUsername(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const name = newProvisionalUsername();
    if ((await accountStore.usernameStatus(name)) === "ok") return name;
  }
  return newProvisionalUsername();
}

const emailOk = (email: string) => z.email().safeParse(email.trim()).success;
const locales = ["de", "en", "ar"] as const;
const focusLater = (id: string) => window.setTimeout(() => document.getElementById(id)?.focus(), 0);
/** Stands in for a name while a message is formatted (messages take plain values). */
const NAME_SLOT = "\u0000";

/** A message around a name, the name in <bdi> so it keeps its own direction (an Arabic name in English text, and back). */
function WithName({ message, name }: { message: (slot: string) => string; name: string }) {
  const [before = "", after = ""] = message(NAME_SLOT).split(NAME_SLOT);
  return (
    <>
      {before}
      <bdi>{name}</bdi>
      {after}
    </>
  );
}

/**
 * Who invited this visitor (an invite link, `?ref=<code>`): the inviter's public page name, `name: null`
 * when their page isn't public yet, `null` for a code nobody has (then nothing shows and nothing is
 * sent). `undefined` while the answer is on its way.
 */
function useInviter(ref: string): { name: string | null } | null | undefined {
  const [answer, setAnswer] = useState<{ ref: string; inviter: { name: string | null } | null } | null>(null);
  useEffect(() => {
    if (!isReferralCode(ref)) return;
    let live = true;
    accountStore.referralInviter(ref).then(
      (inviter) => {
        if (live) setAnswer({ ref, inviter });
      },
      () => {
        if (live) setAnswer({ ref, inviter: null });
      },
    );
    return () => {
      live = false;
    };
  }, [ref]);
  if (!isReferralCode(ref)) return null;
  return answer?.ref === ref ? answer.inviter : undefined;
}

/**
 * One field, one button, no password: the email. The next step is the 6-digit code from the email.
 * An address claimed on the homepage comes along and shows as one line (with "Change"); everyone
 * else picks their address in the welcome flow.
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
  // From the homepage playground ("?template=pulse&accent=ff7a00&display=Juno Kade"): that look and name.
  const templateParam = useSearchParam("template");
  const accentParam = useSearchParam("accent").replace(/[^0-9a-f]/gi, "");
  const displayName = useSearchParam("display").trim().slice(0, 60);
  const tried = isTemplate(templateParam) ? { template: templateParam, ...(accentParam.length === 6 ? { accent: `#${accentParam}` } : {}) } : null;
  const kind = look ? look.kind : isKind(kindParam) ? kindParam : tried ? "other" : null;
  // From someone's invite link (`/i/<code>` → "?ref=<code>"): the program's word is "referral", not the prepared-page `invite`.
  const ref = useSearchParam("ref").toLowerCase().replace(/[^2-9a-hjkmnp-z]/g, "").slice(0, 8);
  const inviter = useInviter(ref);
  const [typed, setTyped] = useState<string | null>(null);
  const username = typed ?? prefill;
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<CodeRequest | null>(null);
  const [demoCode, setDemoCode] = useState<string | undefined>(undefined);
  const leaving = useLeaveWhenSignedIn();

  const status = useUsernameStatus(username);
  const usernameError = errors.username ?? (username.length >= 3 && status && status !== "ok" && status !== "checking" ? status : undefined);
  const locked = Boolean(invite && prefill);
  // The address field only shows to change the claimed address or when it has a problem.
  const showField = !locked && (editing || Boolean(usernameError));

  const showError = (error: AuthError) => {
    const field = FIELD_OF[error];
    if (field) {
      setErrors({ [field]: error } satisfies Errors);
      if (field === "username") setEditing(true);
      focusLater(`signup-${field}`);
    } else setBanner(error);
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Errors = {};
    if (username) {
      const nameStatus = await accountStore.usernameStatus(username);
      if (nameStatus !== "ok") next.username = nameStatus;
    }
    if (!emailOk(email)) next.email = "invalidEmail";
    setErrors(next);
    setBanner(null);
    const first = (["username", "email"] as const).find((field) => next[field]);
    if (first) {
      if (first === "username") setEditing(true);
      focusLater(`signup-${first}`);
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
        username: prepared.kind === "match" ? prepared.username : username || (await freeProvisionalUsername()),
        prepared: prepared.kind === "match" ? { page: prepared.page, theme: prepared.theme } : undefined,
        invite: invite || undefined,
        // From the playground the whole look waits in the draft (page color, type, buttons); the address has its template and accent.
        start: kind ? { kind, theme: look ? look.theme : tried ? (readTryDraft()?.theme ?? tried) : STARTERS[kind].theme, displayName: displayName || undefined } : undefined,
        // Only a code that belongs to someone; an unknown one is never sent.
        ref: inviter ? ref : undefined,
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
          focusLater("signup-email");
        }}
      />
    );
  }

  return (
    <>
      {invite ? <AuthHeading title={t("signup.preparedTitle")} lead={t("signup.preparedLead")} /> : <AuthHeading title={t("signup.title")} lead={look ? t("signup.fromTemplate") : t("signup.lead")} />}
      <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-4">
        <FormError message={banner ? t(`errors.${banner}`) : null} />
        {username && !showField ? (
          // The address claimed on the homepage (or reserved by an invite), as one quiet line.
          <div className="flex min-h-control-lg items-center gap-3 rounded-lg border border-line px-4 text-small">
            <Icon icon={status === "ok" ? CircleCheck : Link2} size="sm" className={status === "ok" ? "shrink-0 text-success-strong" : "shrink-0 text-fg-tertiary"} />
            <span className="min-w-0 flex-1 truncate text-start text-fg">
              {locked ? t("fields.usernameReserved", { name: username }) : status === "ok" ? t("fields.usernameOk", { name: username }) : `linkyo.app/${username}`}
            </span>
            {locked ? null : (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  focusLater("signup-username");
                }}
                className="shrink-0 rounded-xs font-semibold text-link focus-visible:focus-ring hover:text-fg transition-colors duration-micro"
              >
                {t("fields.changeAddress")}
              </button>
            )}
          </div>
        ) : null}
        {showField ? (
          <TextField
            id="signup-username"
            label={t("fields.username")}
            variant="filled"
            size="xl"
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
        ) : null}
        {inviter ? (
          // Who invited them, as one quiet line: not a field, so the sign-up keeps its one field (ADR 0039).
          <div className="flex min-h-control-lg items-center gap-3 rounded-lg border border-line px-4 text-small">
            <Icon icon={Gift} size="sm" className="shrink-0 text-fg-tertiary" />
            <span className="min-w-0 flex-1 truncate text-start text-fg">
              {inviter.name ? <WithName message={(name) => t("signup.invitedBy", { name })} name={inviter.name} /> : t("signup.invited")}
            </span>
          </div>
        ) : null}
        <TextField
          id="signup-email"
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
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          autoComplete="email"
          inputMode="email"
          required
          error={errors.email ? t(`errors.${errors.email}`) : undefined}
        />
        <Button type="submit" variant="primary" size="cta" block loading={busy || leaving}>
          {t("signup.submit")}
        </Button>
        <p className="text-caption text-pretty text-fg-secondary">{t("signup.terms")}</p>
        {inviter ? (
          // What the inviter will see of them: the page name, never the email (GDPR, ADR 0064).
          <p className="text-caption text-pretty text-fg-secondary">
            {inviter.name ? <WithName message={(name) => t("signup.invitedNote", { name })} name={inviter.name} /> : t("signup.invitedNoteAnon")}
          </p>
        ) : null}
      </form>
      <OrDivider label={t("social.or")} />
      <SocialButtons emailField="signup-email" />
      {invite ? <p className="-mt-3 text-caption text-fg-secondary">{t("signup.preparedGoogle")}</p> : null}
      <p className="text-center text-small text-fg-secondary">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="-mx-2 inline-flex min-h-touch-target items-center rounded-full px-2 font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed">
          {t("signup.login")}
        </Link>
      </p>
    </>
  );
}
