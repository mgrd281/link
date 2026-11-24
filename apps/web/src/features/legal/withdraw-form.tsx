"use client";

import { Button, Icon, TextField } from "@linkyo/ui";
import { ArrowLeft, ArrowRight, CircleAlert, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type SyntheticEvent } from "react";
import { z } from "zod";

import { useAccount } from "@/features/account/store";
import { clockTime, shortDate, type EmailLocale } from "@/features/email/templates/render";
import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/config";

interface ContractOption {
  value: string;
  label: string;
}

const isEmail = (value: string) => z.email().safeParse(value.trim()).success;

/** The account's contracts that can still be withdrawn from: its orders and its bought Pro. */
async function loadContracts(labels: { order: (pkg: string, number: string) => string; pro: string }): Promise<ContractOption[]> {
  const db = browserSupabase();
  const [orders, entitlements] = await Promise.all([db.rpc("my_orders"), db.from("entitlements").select("status, source")]);
  const options: ContractOption[] = [];
  if (Array.isArray(orders.data)) {
    for (const row of orders.data as { number?: unknown; package?: unknown; status?: unknown }[]) {
      if (typeof row.number !== "string" || row.status === "refunded" || row.status === "withdrawn") continue;
      options.push({ value: row.number, label: labels.order(String(row.package), row.number) });
    }
  }
  if ((entitlements.data ?? []).some((row) => row.source === "stripe" && (row.status === "active" || row.status === "past_due"))) options.push({ value: labels.pro, label: labels.pro });
  return options;
}

/**
 * The online withdrawal function (§ 356a BGB), in two steps and without a login or a reason:
 * name, contract and e-mail → "Weiter" → a summary and "Widerruf bestätigen" → the receipt with the
 * server's date and time, which can be saved as a PDF. It never refuses a declaration: every one is
 * stored and receipted on screen (a held e-mail is said so).
 */
export function WithdrawForm() {
  const t = useTranslations("legal");
  const tPackage = useTranslations("orders.package");
  const locale = useLocale() as EmailLocale;
  const snapshot = useAccount();
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [name, setName] = useState("");
  const [contract, setContract] = useState("");
  // Signed in, the address starts as the account's (null = untouched).
  const [emailInput, setEmail] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; contract?: string; email?: string }>({});
  const [options, setOptions] = useState<ContractOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [receipt, setReceipt] = useState<{ receivedAt: string; mailed: boolean } | null>(null);
  const focusTarget = useRef<HTMLParagraphElement>(null);
  const contractId = useId();
  const signedIn = snapshot.status === "signedIn";
  const accountEmail = signedIn ? snapshot.account.email : "";
  const email = emailInput ?? accountEmail;

  useEffect(() => {
    if (!signedIn || !supabaseEnabled) return;
    let cancelled = false;
    void loadContracts({ order: (pkg, number) => t("withdraw.contractOrder", { package: pkg === "premium" ? tPackage("premium") : tPackage("start"), number }), pro: t("withdraw.contractPro") })
      .then((found) => {
        if (cancelled || found.length === 0) return;
        setOptions(found);
        setContract((current) => current || (found[0]?.value ?? ""));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [signedIn, t, tPackage]);

  // Each step starts where the eye and the screen reader are: its first sentence.
  useEffect(() => {
    if (step !== "form") focusTarget.current?.focus();
  }, [step]);

  const contractLabel = options.find((option) => option.value === contract)?.label ?? contract.trim();

  const next = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = {
      ...(name.trim() ? {} : { name: t("errors.required") }),
      ...(contract.trim() ? {} : { contract: t("errors.required") }),
      ...(email.trim() === "" ? { email: t("errors.required") } : isEmail(email) ? {} : { email: t("errors.email") }),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(found.name ? "withdraw-name" : found.contract ? contractId : "withdraw-email")?.focus();
      return;
    }
    setStep("review");
  };

  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contract: contract.trim(), email: email.trim(), locale }),
      });
      const data = (await response.json()) as { receivedAt?: unknown; mailed?: unknown };
      if (!response.ok || typeof data.receivedAt !== "string") throw new Error("not stored");
      setReceipt({ receivedAt: data.receivedAt, mailed: data.mailed === true });
      setStep("done");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (step === "done" && receipt) {
    const at = new Date(receipt.receivedAt);
    return (
      <div className="grid gap-5" data-withdraw-done>
        <p ref={focusTarget} tabIndex={-1} className="text-body-lg font-semibold text-pretty outline-none">
          {t("withdraw.done", { date: shortDate(at, locale), time: clockTime(at, locale) })}
        </p>
        <p className="text-body text-pretty">{receipt.mailed ? t("withdraw.doneMailed", { email: email.trim() }) : t("withdraw.doneHeld")}</p>
        <p className="text-body text-pretty text-fg-secondary">{t("withdraw.nextSteps")}</p>
        <Button type="button" variant="secondary" size="lg" icon={Printer} className="justify-self-start print:hidden" onClick={() => window.print()}>
          {t("print")}
        </Button>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="grid gap-5">
        <p ref={focusTarget} tabIndex={-1} className="rounded-lg border border-line bg-surface p-4 text-body-lg text-pretty outline-none" data-withdraw-review>
          {t("withdraw.review", { name: name.trim(), contract: contractLabel, email: email.trim() })}
        </p>
        {failed ? (
          <p role="alert" className="flex items-start gap-2 text-body text-danger-strong">
            <Icon icon={CircleAlert} size="md" className="mt-0.5 shrink-0" />
            {t("errors.server")}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="secondary" size="lg" onClick={() => setStep("form")} disabled={busy}>
            <Icon icon={ArrowLeft} size="md" />
            {t("withdraw.back")}
          </Button>
          <Button type="button" variant="primary" size="cta" loading={busy} onClick={() => void confirm()}>
            {t("withdraw.confirm")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={next} className="grid gap-5">
      <TextField
        id="withdraw-name"
        label={t("withdraw.name")}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
        maxLength={120}
        size="auto"
        error={errors.name}
        live
      />
      {options.length > 0 ? (
        <div className="grid gap-2">
          <label htmlFor={contractId} className="text-small text-fg">
            {t("withdraw.contract")}
          </label>
          <select
            id={contractId}
            value={contract}
            onChange={(event) => setContract(event.target.value)}
            className="h-control-lg rounded-md border border-line-input bg-surface-elevated px-3 text-body text-fg focus-visible:focus-field"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <TextField
          id={contractId}
          label={t("withdraw.contract")}
          hint={t("withdraw.contractHint")}
          value={contract}
          onChange={(event) => setContract(event.target.value)}
          maxLength={80}
          size="auto"
          error={errors.contract}
          live
        />
      )}
      <TextField
        id="withdraw-email"
        type="email"
        label={t("withdraw.email")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        ltr
        size="auto"
        error={errors.email}
        live
      />
      <Button type="submit" variant="primary" size="cta" className="group justify-self-start">
        {t("withdraw.next")}
        <Icon icon={ArrowRight} size="md" />
      </Button>
    </form>
  );
}
