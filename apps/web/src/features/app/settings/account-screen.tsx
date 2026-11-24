"use client";

import { Badge, Button, cn, ConfirmDialog, Icon, toast } from "@linkyo/ui";
import { Download, Laptop, Mail, Smartphone, Tablet, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, type SubmitEvent } from "react";

import { STORAGE_KEY } from "@/features/account/local-store";
import { accountStore } from "@/features/account/store";
import type { AuthError, LoginEvent } from "@/features/account/types";
import { normalizeEmail } from "@/features/account/username";

import { Disclosure } from "../disclosure";
import { TextInput } from "../form";
import { FieldGroup, FormActions } from "../list";
import { Screen } from "../screen";
import { useExportData } from "../settings-screen";
import { useSite } from "../site-context";

/** Keeps an address or email in one left-to-right run inside a sentence in any direction. */
const isolate = (text: string) => `⁦${text}⁩`;

/** The account's email. Real accounts confirm a new one by email first; until then the old one signs in. */
function EmailGroup() {
  const t = useTranslations("app.settings");
  const tAuth = useTranslations("auth");
  const { account, announce } = useSite();
  const form = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(account.email);
  const [error, setError] = useState<AuthError | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  // Real accounts: the new address waiting for its confirmation link.
  const [pending, setPending] = useState<string | null>(null);
  const next = email.trim();
  const changed = normalizeEmail(email) !== account.email;
  // Cancel and Save go away once the field holds the address that signs in. Focus that came by
  // keyboard goes back to the field, not to the top of the page; a tap moves nothing (on a phone, a
  // focused field opens the keyboard).
  const byKeyboard = () => document.activeElement?.matches(":focus-visible") === true;
  const toField = () => form.current?.querySelector("input")?.focus();

  const change = async () => {
    // Asked now, while focus is still on Save or on the dialog's button.
    const keyboard = byKeyboard();
    setBusy(true);
    const result = await accountStore.changeEmail(next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (keyboard) toField();
    if (result.pending === "confirmEmail") {
      // The field shows the address that still signs in; the new one waits below it. The line below
      // is read out through the dashboard's live region: one that arrives with its words often is not.
      setPending(next);
      setEmail(account.email);
      announce(t("emailPending", { email: isolate(next) }));
      return;
    }
    toast({ title: t("emailChanged"), tone: "success" });
  };
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!changed || busy) return;
    // In the demo nothing is sent, so the change applies at once.
    if (accountStore.demo) void change();
    else setConfirm(true);
  };
  const resend = async () => {
    if (!pending) return;
    const result = await accountStore.changeEmail(pending);
    toast(
      result.ok
        ? { title: t("emailConfirm", { email: pending }), tone: "success" }
        : { title: tAuth(`errors.${result.error}`), tone: "danger" },
    );
  };

  return (
    <FieldGroup>
      <form ref={form} noValidate onSubmit={submit} className="grid grid-cols-1 gap-5">
        <TextInput
          label={tAuth("fields.email")}
          type="email"
          ltr
          icon={Mail}
          value={email}
          onValue={(value) => {
            setEmail(value);
            setError(null);
          }}
          autoComplete="email"
          hint={t("signInByCode")}
          error={error ? tAuth(`errors.${error}`) : undefined}
        />
        {pending ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-small text-fg-secondary min-w-0">
              {t("emailPending", { email: isolate(pending) })}
            </p>
            <Button variant="ghost" size="sm" onClick={() => void resend()}>
              {t("emailResend")}
            </Button>
          </div>
        ) : null}
        {changed ? (
          <FormActions>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                if (byKeyboard()) toField();
                setEmail(account.email);
                setError(null);
              }}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={busy}>
              {t("emailSave")}
            </Button>
          </FormActions>
        ) : null}
      </form>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("emailConfirmTitle")}
        description={t("emailConfirmBody", { new: isolate(next), old: isolate(account.email) })}
        confirmLabel={t("emailSave")}
        cancelLabel={t("cancel")}
        destructive={false}
        onConfirm={() => void change()}
      />
    </FieldGroup>
  );
}

const readAccounts = () => {
  try {
    return `${window.localStorage.getItem(STORAGE_KEY) ?? ""}|${window.localStorage.getItem("linkyo.device") ?? ""}`;
  } catch {
    return "";
  }
};
const DEVICE_ICONS = { mobile: Smartphone, tablet: Tablet, desktop: Laptop } as const;
/** Sign-ins shown before "Show all". */
const FIRST = 3;

/** The account's own sign-ins (30 days): where and with what. Transparency, and a way to spot strangers. */
function SignInsGroup() {
  const t = useTranslations("app.settings");
  const locale = useLocale();
  // Demo: the log lives next to the accounts in this browser, so it is read again when they change.
  const raw = useSyncExternalStore(
    (listener) => accountStore.subscribe(listener),
    readAccounts,
    () => "",
  );
  const [signIns, setSignIns] = useState<LoginEvent[]>([]);
  useEffect(() => {
    let live = true;
    void accountStore.signIns().then((list) => {
      if (live) setSignIns(list.slice(0, 8));
    });
    return () => {
      live = false;
    };
  }, [raw]);
  const thisDevice = raw.split("|")[1];
  const place = (code: string | undefined, city: string | undefined) => {
    const country = code ? (new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code) : "";
    return [city, country].filter(Boolean).join(", ") || t("unknownPlace");
  };
  const when = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const row = (entry: LoginEvent) => (
    <li key={entry.id} className="flex items-start gap-4">
      <span className="size-control-sm bg-tinted text-tinted-fg grid shrink-0 place-items-center rounded-sm">
        <Icon icon={DEVICE_ICONS[entry.device.type]} size="sm" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-body flex flex-wrap items-center gap-x-2 gap-y-1 leading-snug">
          <bdi>
            {entry.device.os} · {entry.device.browser}
          </bdi>
          {entry.deviceId === thisDevice ? (
            <Badge size="sm" tone="primary">
              {t("thisDevice")}
            </Badge>
          ) : null}
          {entry.result === "failed" ? (
            <Badge size="sm" tone="danger">
              {t("failedSignIn")}
            </Badge>
          ) : null}
        </span>
        <span className="text-caption text-fg-secondary">
          {place(entry.country, entry.city)} · <bdi dir="ltr">{entry.ip || "–"}</bdi> ·{" "}
          {when.format(new Date(entry.at))}
        </span>
      </span>
    </li>
  );
  const rest = signIns.slice(FIRST);
  return (
    <FieldGroup id="signins" title={t("signIns")} description={t("signInsHint")}>
      {signIns.length === 0 ? (
        <p className="text-small text-fg-secondary">{t("signInsEmpty")}</p>
      ) : (
        // The rows sit flush with the group's padding: the first starts at its top, the last (or "Show all") ends at its bottom.
        <div className="grid">
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops the list semantics of a list without bullets */}
          <ul
            role="list"
            className={cn("divide-line divide-y *:py-3 *:first:pt-0", rest.length === 0 && "*:last:pb-0")}
          >
            {signIns.slice(0, FIRST).map(row)}
          </ul>
          {rest.length > 0 ? (
            <Disclosure
              summary={t("signInsAll", { count: signIns.length })}
              className="border-line border-t pt-1"
            >
              {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above */}
              <ul role="list" className="divide-line border-line divide-y border-t *:py-3 *:last:pb-0">
                {rest.map(row)}
              </ul>
            </Disclosure>
          ) : null}
        </div>
      )}
    </FieldGroup>
  );
}

/**
 * Deleting the account: last on the screen and alone, behind a dialog that asks for the address.
 * The dialog offers the export first (D-16): what goes is gone, so the file is one tap away.
 */
function DeleteGroup() {
  const t = useTranslations("app.settings");
  const tShare = useTranslations("app.share");
  const tAuth = useTranslations("auth");
  const { account } = useSite();
  const exportData = useExportData();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  // The file the export made while this dialog is open (its name, said under the button).
  const [exported, setExported] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportFirst = async () => {
    setExporting(true);
    try {
      setExported(await exportData());
    } finally {
      setExporting(false);
    }
  };
  return (
    <FieldGroup description={accountStore.demo ? t("deleteHint") : t("deleteHintReal")}>
      <Button
        variant="destructive"
        size="md"
        icon={Trash2}
        className="pointer-coarse:h-control-lg justify-self-start"
        onClick={() => setConfirm(true)}
      >
        {t("delete")}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={(open) => {
          setConfirm(open);
          setTyped("");
          setExported(null);
        }}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("cancel")}
        confirmDisabled={typed.trim().toLowerCase() !== account.username}
        initialFocus="first-field"
        onConfirm={() => {
          void accountStore.deleteAccount().then((result) => {
            if (result.ok) toast({ title: t("deleted") });
            else toast({ title: tAuth(`errors.${result.error}`), tone: "danger" });
          });
        }}
      >
        <div className="grid justify-items-start gap-2">
          <Button variant="tinted" size="md" icon={Download} loading={exporting} className="pointer-coarse:h-control-lg" onClick={() => void exportFirst()}>
            {tShare("exportFirst")}
          </Button>
          <p role="status" className="text-small text-fg-secondary empty:hidden">
            {exported ? tShare.rich("exported", { file: exported, bdi: (chunks) => <bdi>{chunks}</bdi> }) : null}
          </p>
        </div>
        <TextInput
          label={t("deleteType", { name: account.username })}
          ltr
          value={typed}
          onValue={setTyped}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
        />
      </ConfirmDialog>
    </FieldGroup>
  );
}

/** Konto: the email that signs in, recent sign-ins, and deleting the account (last, alone). */
export function AccountScreen() {
  const t = useTranslations("app.settings");
  const tApp = useTranslations("app");
  return (
    <Screen title={t("panes.account")} back={{ href: "/app/settings", label: tApp("nav.settings") }} preview>
      <EmailGroup />
      <SignInsGroup />
      <DeleteGroup />
    </Screen>
  );
}
