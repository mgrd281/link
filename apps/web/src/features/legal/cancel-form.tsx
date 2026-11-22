"use client";

import { Button, cn, TextField } from "@linkyo/ui";
import { Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { z } from "zod";

import { useAccount } from "@/features/account/store";
import { TextArea } from "@/features/app/form";
import { calendarDay, clockTime, shortDate, type EmailLocale } from "@/features/email/templates/render";

const isEmail = (value: string) => z.email().safeParse(value.trim()).success;

type Kind = "ordinary" | "extraordinary";
type When = "next" | "date";

interface Done {
  receivedAt: string;
  mailed: boolean;
  kind: Kind;
  wantedDate: string | null;
  confirmationEmail: string;
}

/** A radio choice as a full-width row (44 px and up), the native radio drawn in the brand colour. */
function Choice({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-touch-target cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-body transition-colors duration-micro has-[:focus-visible]:focus-ring hover:bg-hover",
        checked ? "border-focus bg-selected" : "border-line-strong bg-surface",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-icon-md shrink-0 cursor-pointer accent-primary" />
      {children}
    </label>
  );
}

/**
 * The cancellation page (§ 312k BGB): only the fields the law names, and one button, "Jetzt
 * kündigen". No login, no "pause instead", no offer. The done screen is built only from what was
 * typed and the server's time, so it reads the same whether or not an account matched; the exact end
 * date goes to the account's own e-mail address.
 */
export function CancelForm() {
  const t = useTranslations("legal");
  const locale = useLocale() as EmailLocale;
  const snapshot = useAccount();
  const [kind, setKind] = useState<Kind>("ordinary");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  // Signed in, both addresses start as the account's (typed input like any other; null = untouched).
  const [accountEmailInput, setAccountEmail] = useState<string | null>(null);
  const [when, setWhen] = useState<When>("next");
  const [wantedDate, setWantedDate] = useState("");
  const [confirmationEmailInput, setConfirmationEmail] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"reason" | "name" | "accountEmail" | "wantedDate" | "confirmationEmail", string>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const contractId = useId();
  const dateId = useId();
  const signedInEmail = snapshot.status === "signedIn" ? snapshot.account.email : "";
  const accountEmail = accountEmailInput ?? signedInEmail;
  const confirmationEmail = confirmationEmailInput ?? signedInEmail;

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const emailError = (value: string) => (value.trim() === "" ? t("errors.required") : isEmail(value) ? undefined : t("errors.email"));

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dated = kind === "ordinary" && when === "date";
    const found = Object.fromEntries(
      Object.entries({
        reason: kind === "extraordinary" && !reason.trim() ? t("errors.required") : undefined,
        name: name.trim() ? undefined : t("errors.required"),
        accountEmail: emailError(accountEmail),
        wantedDate: dated && !/^\d{4}-\d{2}-\d{2}$/.test(wantedDate) ? t("errors.required") : undefined,
        confirmationEmail: emailError(confirmationEmail),
      }).filter(([, message]) => message !== undefined),
    ) as typeof errors;
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      const field = first === "reason" ? document.querySelector<HTMLElement>('textarea[name="cancel-reason"]') : document.getElementById(first === "wantedDate" ? dateId : `cancel-${first}`);
      field?.focus();
      return;
    }
    setBusy(true);
    setFailed(false);
    const wanted = dated ? wantedDate : null;
    try {
      const response = await fetch("/api/cancellations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ...(kind === "extraordinary" ? { reason: reason.trim() } : {}),
          name: name.trim(),
          accountEmail: accountEmail.trim(),
          contract: "pro-monthly",
          wantedDate: wanted,
          confirmationEmail: confirmationEmail.trim(),
          locale,
        }),
      });
      const data = (await response.json()) as { receivedAt?: unknown; mailed?: unknown };
      if (!response.ok || typeof data.receivedAt !== "string") throw new Error("not stored");
      setDone({ receivedAt: data.receivedAt, mailed: data.mailed === true, kind, wantedDate: wanted, confirmationEmail: confirmationEmail.trim() });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const at = new Date(done.receivedAt);
    return (
      <div className="grid gap-5" data-cancel-done>
        <p ref={doneRef} tabIndex={-1} className="text-body-lg font-semibold text-pretty outline-none">
          {t("cancel.done", { date: shortDate(at, locale), time: clockTime(at, locale) })}
        </p>
        <p className="text-body text-pretty">
          {done.kind === "extraordinary"
            ? t("cancel.doneExtraordinary")
            : done.wantedDate
              ? t("cancel.doneOrdinaryDate", { date: calendarDay(done.wantedDate, locale) })
              : t("cancel.doneOrdinary")}
        </p>
        <p className="text-body text-pretty">{done.mailed ? t("cancel.doneMailed", { email: done.confirmationEmail }) : t("cancel.doneHeld")}</p>
        <p className="text-body text-pretty text-fg-secondary">{t("cancel.doneSave")}</p>
        <Button type="button" variant="secondary" size="lg" icon={Printer} className="justify-self-start print:hidden" onClick={() => window.print()}>
          {t("print")}
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-2 text-small text-fg">{t("cancel.kind")}</legend>
        <Choice name="cancel-kind" value="ordinary" checked={kind === "ordinary"} onChange={() => setKind("ordinary")}>
          {t("cancel.kindOrdinary")}
        </Choice>
        <Choice name="cancel-kind" value="extraordinary" checked={kind === "extraordinary"} onChange={() => setKind("extraordinary")}>
          {t("cancel.kindExtraordinary")}
        </Choice>
      </fieldset>
      {kind === "extraordinary" ? (
        <TextArea name="cancel-reason" label={t("cancel.reason")} value={reason} onValue={setReason} max={2000} rows={3} error={errors.reason} />
      ) : null}
      <TextField id="cancel-name" label={t("cancel.name")} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} size="auto" error={errors.name} live />
      <TextField
        id="cancel-accountEmail"
        type="email"
        label={t("cancel.accountEmail")}
        value={accountEmail}
        onChange={(event) => setAccountEmail(event.target.value)}
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        ltr
        size="auto"
        error={errors.accountEmail}
        live
      />
      <div className="grid gap-2">
        <label htmlFor={contractId} className="text-small text-fg">
          {t("cancel.contract")}
        </label>
        <select id={contractId} defaultValue="pro-monthly" className="h-control-lg rounded-md border border-line-input bg-surface-elevated px-3 text-body text-fg focus-visible:focus-field">
          <option value="pro-monthly">{t("cancel.contractPro")}</option>
        </select>
      </div>
      {kind === "ordinary" ? (
        <fieldset className="grid min-w-0 gap-2">
          <legend className="mb-2 text-small text-fg">{t("cancel.when")}</legend>
          <Choice name="cancel-when" value="next" checked={when === "next"} onChange={() => setWhen("next")}>
            {t("cancel.whenNext")}
          </Choice>
          <Choice name="cancel-when" value="date" checked={when === "date"} onChange={() => setWhen("date")}>
            {t("cancel.whenDate")}
          </Choice>
          {when === "date" ? (
            <TextField
              id={dateId}
              type="date"
              label={t("cancel.date")}
              value={wantedDate}
              onChange={(event) => setWantedDate(event.target.value)}
              size="auto"
              className="pt-2"
              error={errors.wantedDate}
              live
            />
          ) : null}
        </fieldset>
      ) : null}
      <TextField
        id="cancel-confirmationEmail"
        type="email"
        label={t("cancel.confirmationEmail")}
        value={confirmationEmail}
        onChange={(event) => setConfirmationEmail(event.target.value)}
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        ltr
        size="auto"
        error={errors.confirmationEmail}
        live
      />
      {failed ? (
        <p role="alert" className="text-body text-danger-strong">
          {t("errors.server")}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="cta" loading={busy} className="w-full sm:w-auto sm:justify-self-start">
        {t("cancel.submit")}
      </Button>
    </form>
  );
}
