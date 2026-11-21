"use client";

import { Button, ConfirmDialog, Icon, toast } from "@linkyo/ui";
import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type SubmitEvent } from "react";

import { useUsernameStatus } from "@/features/account/auth/shared";
import { accountStore } from "@/features/account/store";
import type { AuthError } from "@/features/account/types";

import { TextInput } from "../form";
import { FieldGroup, FormActions } from "../list";
import { Screen } from "../screen";
import { useSite } from "../site-context";
import { toSlug } from "./slug";

const MAX = 30;
const MIN = 3;
/** The counter shows from here on. */
const COUNT_FROM = 24;

/**
 * Seitenadresse: the address is written as an address while it is typed ("Mila Aurel" → mila-aurel),
 * checked as it goes, and changed only after a confirm that names the address that stops working.
 */
export function AddressScreen() {
  const t = useTranslations("app.settings");
  const tAuth = useTranslations("auth");
  const tApp = useTranslations("app");
  const { account } = useSite();
  const [value, setValue] = useState(account.username);
  const [left, setLeft] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // What would be saved: a dash still waiting for the next word is not part of it. The saved address
  // stays as it is until it is edited (older ones may hold "--", which writing it out would merge).
  const next = value === account.username ? value : toSlug(value, true);
  const status = useUsernameStatus(next, account.username);
  const changed = next !== account.username;

  // Reserved or taken: at once. Too short: once the field is left (not while the first letters are typed).
  const problem = error
    ? tAuth(`errors.${error}`)
    : status === "reservedUsername" || status === "usernameTaken"
      ? tAuth(`errors.${status}`)
      : next.length < MIN
        ? left
          ? t("addressTooShort")
          : undefined
        : status === "invalidUsername"
          ? tAuth("errors.invalidUsername")
          : undefined;
  const hint =
    status === "ok" ? (
      <span className="text-success-strong flex items-start gap-2">
        <Icon icon={CircleCheck} size="sm" className="mt-0.5 shrink-0" />
        {tAuth("fields.usernameOk", { name: next })}
      </span>
    ) : status === "checking" ? (
      <span aria-hidden>…</span>
    ) : (
      t("addressHint")
    );

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    setValue(next);
    if (changed && status === "ok") setConfirm(true);
  };
  const change = async () => {
    // "Change address" goes away with the change. Focus that came by keyboard (on the dialog's button)
    // goes on from the field, not from the top of the page; a tap moves nothing (on a phone, a focused
    // field opens the keyboard).
    const keyboard = document.activeElement?.matches(":focus-visible") === true;
    setBusy(true);
    const result = await accountStore.changeUsername(next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (keyboard) form.current?.querySelector("input")?.focus();
    toast({ title: t("addressChanged", { url: `linkyo.app/${next}` }), tone: "success" });
  };

  return (
    <Screen title={t("panes.address")} back={{ href: "/app/settings", label: tApp("nav.settings") }} preview>
      <FieldGroup>
        <form ref={form} noValidate onSubmit={submit} className="grid grid-cols-1 gap-5">
          <TextInput
            label={t("addressLabel")}
            ltr
            leading="linkyo.app/"
            value={value}
            onValue={(typed) => {
              setValue(toSlug(typed).slice(0, MAX));
              setError(null);
            }}
            onBlur={() => {
              setValue(next);
              setLeft(true);
            }}
            maxLength={MAX}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            trailing={
              value.length >= COUNT_FROM ? (
                <span aria-hidden className="text-caption text-fg-tertiary shrink-0 tabular-nums">
                  {value.length}/{MAX}
                </span>
              ) : undefined
            }
            hint={hint}
            error={problem}
          />
          {/* Shown while the new address is free (or being checked); the old one stops working, so a confirm comes first. */}
          {changed && (status === "ok" || status === "checking") ? (
            <FormActions>
              <Button type="submit" variant="primary" size="md" disabled={status !== "ok"} loading={busy}>
                {t("addressSave")}
              </Button>
            </FormActions>
          ) : null}
        </form>
      </FieldGroup>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("addressConfirmTitle")}
        description={t("addressConfirmBody", { old: account.username })}
        confirmLabel={t("addressSave")}
        cancelLabel={t("cancel")}
        destructive={false}
        onConfirm={() => void change()}
      />
    </Screen>
  );
}
