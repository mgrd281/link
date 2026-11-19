"use client";

import { Button, Icon, Spinner } from "@linkyo/ui";
import { CircleCheck, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";

import { Link } from "@/i18n/navigation";

import { isStrongEnough } from "../password";
import { accountStore, useAccount } from "../store";
import type { AuthError } from "../types";
import { AuthHeading } from "./auth-shell";
import { FormError, PasswordField } from "./fields";

/**
 * The page the reset link leads to (real accounts): the link has signed the person in, so they
 * choose a new password here and carry on.
 */
export function ResetForm() {
  const t = useTranslations("auth");
  const snapshot = useAccount();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (snapshot.status === "loading") {
    return (
      <div className="grid place-items-center py-16 text-fg-tertiary">
        <Spinner className="size-icon-lg" />
      </div>
    );
  }
  if (snapshot.status === "signedOut") {
    return (
      <>
        <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
          <Icon icon={KeyRound} size="lg" />
        </span>
        <AuthHeading title={t("reset.title")} lead={t("reset.noSession")} />
        <Button asChild variant="primary" size="xl" block>
          <Link href="/forgot">{t("forgot.emailSubmit")}</Link>
        </Button>
      </>
    );
  }
  if (done) {
    return (
      <>
        <span className="grid size-control-xl place-items-center rounded-full bg-success-subtle text-success-strong">
          <Icon icon={CircleCheck} size="lg" />
        </span>
        <AuthHeading title={t("reset.doneTitle")} lead={t("reset.done")} />
        <Button asChild variant="primary" size="xl" block>
          <Link href="/app">{t("reset.toApp")}</Link>
        </Button>
      </>
    );
  }

  const { account } = snapshot;
  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isStrongEnough(password, account)) {
      setError("weakPassword");
      return;
    }
    setBusy(true);
    const result = await accountStore.setNewPassword(password);
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  };

  return (
    <>
      <AuthHeading title={t("reset.title")} lead={t("reset.lead")} />
      <form noValidate onSubmit={(event) => void submit(event)} className="grid grid-cols-1 gap-5">
        <FormError message={error ? t(`errors.${error}`) : null} />
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
          checks={{ email: account.email, username: account.username }}
        />
        <Button type="submit" variant="primary" size="xl" block loading={busy}>
          {t("reset.submit")}
        </Button>
      </form>
    </>
  );
}
