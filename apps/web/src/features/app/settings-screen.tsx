"use client";

import { Button, ConfirmDialog, Icon, TextField, toast } from "@linkyo/ui";
import { AtSign, CircleCheck, Download, LogOut, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type SubmitEvent } from "react";

import { LocaleSwitch } from "@/components/locale-switch";
import { ThemeSwitch } from "@/components/theme-switch";
import { PasswordField } from "@/features/account/auth/fields";
import { isStrongEnough } from "@/features/account/password";
import { accountStore } from "@/features/account/store";
import type { AuthError, Legal } from "@/features/account/types";

import { TextArea, TextInput } from "./form";
import { pickFiles } from "./images";
import { parseImport, type ImportedSite } from "./import";
import { ProfileFields, useProfileDraft } from "./profile-form";
import { Panel, Screen } from "./screen";
import { useSite } from "./site-context";

function ProfilePanel() {
  const t = useTranslations("app.profile");
  const form = useProfileDraft();
  return (
    <Panel title={t("title")} id="profile-title">
      <ProfileFields profile={form.profile} onChange={form.change} errors={form.errors} />
      {form.dirty ? (
        <div className="sticky bottom-20 flex flex-wrap justify-end gap-2 rounded-lg border border-line bg-surface-elevated p-3 shadow-e3 lg:bottom-4">
          <Button variant="ghost" onClick={form.reset}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (form.save(t("nameRequired"))) toast({ title: t("saved"), tone: "success" });
            }}
          >
            {t("save")}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function AddressPanel() {
  const t = useTranslations("app.settings");
  const tAuth = useTranslations("auth");
  const { account } = useSite();
  const [value, setValue] = useState(account.username);
  const [error, setError] = useState<AuthError | null>(null);
  const normalized = value.trim().toLowerCase();
  const status = normalized && normalized !== account.username ? accountStore.usernameStatus(normalized) : null;
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const result = accountStore.changeUsername(normalized);
    if (result.ok) toast({ title: t("addressChanged", { url: `linkyo.app/${normalized}` }), tone: "success" });
    else setError(result.error);
  };
  return (
    <Panel title={t("address")} id="address-title">
      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4">
        <TextField
          label={t("addressLabel")}
          ltr
          leading="linkyo.app/"
          value={value}
          onChange={(event) => {
            setValue(event.target.value.toLowerCase());
            setError(null);
          }}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          error={error ? tAuth(`errors.${error}`) : status && status !== "ok" && normalized.length >= 3 ? tAuth(`errors.${status}`) : undefined}
          hint={
            status === "ok" ? (
              <span className="flex items-center gap-2 text-success-strong">
                <Icon icon={CircleCheck} size="sm" />
                {tAuth("fields.usernameOk", { name: normalized })}
              </span>
            ) : (
              t("addressHint")
            )
          }
        />
        <Button type="submit" className="justify-self-start" disabled={status !== "ok"}>
          {t("addressSave")}
        </Button>
      </form>
    </Panel>
  );
}

function AccountPanel() {
  const t = useTranslations("app.settings");
  const tAuth = useTranslations("auth");
  const { account } = useSite();
  const [email, setEmail] = useState(account.email);
  const [emailError, setEmailError] = useState<AuthError | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordError, setPasswordError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);

  const saveEmail = (event: SubmitEvent) => {
    event.preventDefault();
    const result = accountStore.changeEmail(email);
    if (result.ok) toast({ title: t("emailChanged"), tone: "success" });
    else setEmailError(result.error);
  };
  const savePassword = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!isStrongEnough(next, account)) {
      setPasswordError("weakPassword");
      return;
    }
    setBusy(true);
    const result = await accountStore.changePassword({ current, next });
    setBusy(false);
    if (result.ok) {
      setCurrent("");
      setNext("");
      setPasswordError(null);
      toast({ title: t("passwordChanged"), tone: "success" });
    } else setPasswordError(result.error);
  };

  return (
    <Panel title={t("account")} id="account-title">
      <form onSubmit={saveEmail} noValidate className="grid grid-cols-1 gap-4">
        <TextField
          label={tAuth("fields.email")}
          type="email"
          ltr
          icon={AtSign}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError(null);
          }}
          autoComplete="email"
          error={emailError ? tAuth(`errors.${emailError}`) : undefined}
        />
        <Button type="submit" className="justify-self-start" disabled={email.trim().toLowerCase() === account.email}>
          {t("emailSave")}
        </Button>
      </form>
      <form onSubmit={(event) => void savePassword(event)} noValidate className="grid grid-cols-1 gap-4 border-t border-line pt-4">
        <p className="text-small font-semibold">{t("password")}</p>
        <PasswordField label={t("currentPassword")} value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" />
        <PasswordField
          label={tAuth("fields.newPassword")}
          value={next}
          onChange={(event) => {
            setNext(event.target.value);
            setPasswordError(null);
          }}
          autoComplete="new-password"
          checks={account}
          error={passwordError ? tAuth(`errors.${passwordError}`) : undefined}
        />
        <Button type="submit" className="justify-self-start" loading={busy} disabled={!current || !next}>
          {t("passwordSave")}
        </Button>
      </form>
    </Panel>
  );
}

function LegalPanel() {
  const t = useTranslations("app.settings");
  const { site } = useSite();
  const [legal, setLegal] = useState<Legal>(site.legal);
  const dirty = JSON.stringify(legal) !== JSON.stringify(site.legal);
  const set = (patch: Partial<Legal>) => setLegal((current) => ({ ...current, ...patch }));
  return (
    <Panel title={t("legal")} id="legal">
      <p className="text-small text-fg-secondary">{t("legalHint")}</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const result = accountStore.updateSite((current) => ({ ...current, legal }));
          toast(result.ok ? { title: t("legalSaved"), tone: "success" } : { title: t("saveFailed"), tone: "danger" });
        }}
        className="grid grid-cols-1 gap-4"
      >
        <TextInput label={t("legalName")} value={legal.name} onValue={(name) => set({ name })} autoComplete="name" maxLength={120} />
        <TextArea label={t("legalAddress")} value={legal.address} onValue={(address) => set({ address })} max={300} rows={3} autoComplete="street-address" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput label={t("legalEmail")} type="email" ltr value={legal.email} onValue={(email) => set({ email })} autoComplete="email" />
          <TextInput label={t("legalPhone")} type="tel" ltr value={legal.phone} onValue={(phone) => set({ phone })} autoComplete="tel" />
        </div>
        <Button type="submit" variant={dirty ? "primary" : "secondary"} className="justify-self-start" disabled={!dirty}>
          {t("legalSave")}
        </Button>
      </form>
    </Panel>
  );
}

function DataPanel() {
  const t = useTranslations("app.settings");
  const { account, doc, dispatch } = useSite();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [incoming, setIncoming] = useState<ImportedSite | null>(null);
  const chooseImport = async () => {
    const [file] = await pickFiles({ accept: "application/json,.json" });
    if (!file) return;
    const parsed = parseImport(await file.text());
    if (parsed) setIncoming(parsed);
    else toast({ title: t("importInvalid"), tone: "danger" });
  };
  const applyImport = () => {
    if (!incoming) return;
    dispatch({
      type: "replace",
      doc: { ...doc, profile: { ...incoming.page.profile, username: account.username }, blocks: incoming.page.blocks, theme: incoming.theme },
    });
    const { legal } = incoming;
    if (legal) accountStore.updateSite((current) => ({ ...current, legal }));
    setIncoming(null);
    toast({ title: t("imported"), tone: "success", action: { label: t("undo"), onAction: () => dispatch({ type: "undo" }) } });
  };
  const exportData = () => {
    const blob = new Blob([accountStore.exportData()], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `linkyo-${account.username}-export.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <Panel title={t("data")} id="data-title">
      <div className="grid grid-cols-1 gap-2">
        <p className="text-small text-fg-secondary">{t("exportHint")}</p>
        <Button icon={Download} className="justify-self-start" onClick={exportData}>
          {t("export")}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t border-line pt-4">
        <p className="text-small text-fg-secondary">{t("importHint")}</p>
        <Button icon={Upload} className="justify-self-start" onClick={() => void chooseImport()}>
          {t("import")}
        </Button>
      </div>
      <ConfirmDialog
        open={incoming !== null}
        onOpenChange={(open) => {
          if (!open) setIncoming(null);
        }}
        title={t("importTitle")}
        description={t("importBody", { name: incoming?.page.profile.displayName ?? "", count: incoming?.page.blocks.length ?? 0 })}
        confirmLabel={t("importConfirm")}
        cancelLabel={t("cancel")}
        destructive={false}
        onConfirm={applyImport}
      />
      <div className="grid grid-cols-1 gap-2 border-t border-line pt-4">
        <p className="text-small text-fg-secondary">{t("deleteHint")}</p>
        <Button variant="destructive" icon={Trash2} className="justify-self-start" onClick={() => setConfirm(true)}>
          {t("delete")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={(open) => {
          setConfirm(open);
          setTyped("");
        }}
        title={t("deleteTitle")}
        description={
          <span className="grid grid-cols-1 gap-4">
            <span>{t("deleteBody")}</span>
            <TextField label={t("deleteType", { name: account.username })} ltr value={typed} onChange={(event) => setTyped(event.target.value)} autoCapitalize="none" spellCheck={false} />
          </span>
        }
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("cancel")}
        confirmDisabled={typed.trim().toLowerCase() !== account.username}
        onConfirm={() => {
          accountStore.deleteAccount();
          toast({ title: t("deleted") });
        }}
      />
    </Panel>
  );
}

/** Settings: profile, address, login, legal notice, the dashboard's own look, and your data. */
export function SettingsScreen() {
  const t = useTranslations("app.settings");
  return (
    <Screen title={t("title")} lead={t("lead")}>
      <ProfilePanel />
      <AddressPanel />
      <AccountPanel />
      <LegalPanel />
      <Panel title={t("dashboard")} id="dashboard-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-small">{t("theme")}</span>
          <ThemeSwitch />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-small">{t("language")}</span>
          <LocaleSwitch />
        </div>
      </Panel>
      <DataPanel />
      <Button variant="ghost" icon={LogOut} className="justify-self-start" onClick={() => accountStore.logOut()}>
        {t("logout")}
      </Button>
    </Screen>
  );
}
