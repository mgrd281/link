"use client";

import { Button, Icon, toast } from "@linkyo/ui";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { accountStore } from "@/features/account/store";
import type { Legal } from "@/features/account/types";

import { useLegalDraft } from "../drafts";
import { TextArea, TextInput } from "../form";
import { legalErrors, legalStatus, missingLegalFields, type LegalField } from "../legal";
import { FieldGroup, FormActions } from "../list";
import { HelpGroup } from "../help-link";
import { ColumnGroups, Screen } from "../screen";
import { useSite } from "../site-context";

const sameLegal = (a: Legal, b: Legal) =>
  a.name === b.name && a.address === b.address && a.email === b.email && a.phone === b.phone;

/**
 * Impressum: a record kept on purpose, saved with its own button. An incomplete notice may be saved
 * (the status says what is missing); only an entry whose format cannot be right blocks the save.
 * Unsaved edits are kept outside the form (useLegalDraft), so they survive a visit to another screen
 * and the shell's save status can say "Legal notice not saved".
 */
export function LegalScreen() {
  const t = useTranslations("app.settings");
  const tApp = useTranslations("app");
  const tEdit = useTranslations("app.edit");
  const locale = useLocale();
  const { account, site } = useSite();
  const [draft, setDraft] = useLegalDraft(account.id);
  const legal = draft ?? site.legal;
  const dirty = draft !== null;
  // Fields left once show their format errors; a save shows them all.
  const [touched, setTouched] = useState<Partial<Record<LegalField, true>>>({});
  const [failedSaves, setFailedSaves] = useState(0);
  const form = useRef<HTMLFormElement>(null);

  const errors = legalErrors(legal);
  const shown = (field: LegalField) => (failedSaves > 0 || touched[field] ? errors[field] : undefined);
  const message = (field: LegalField) => {
    const kind = shown(field);
    return kind ? t(`legalErrors.${kind}`) : undefined;
  };
  const blockers = Object.keys(errors).length;

  const set = (patch: Partial<Legal>) => {
    const next = { ...legal, ...patch };
    setDraft(sameLegal(next, site.legal) ? null : next);
  };
  const leave = (field: LegalField) => setTouched((current) => ({ ...current, [field]: true }));
  const forget = () => {
    setDraft(null);
    setTouched({});
    setFailedSaves(0);
  };
  // Save and Discard go away once used. A keyboard user on one of them goes on from the last field,
  // not from the top of the page; a tap moves nothing (on a phone, a focused field opens the keyboard).
  const keepFocus = () => {
    const root = form.current;
    const active = document.activeElement;
    if (
      !root ||
      !(active instanceof HTMLButtonElement) ||
      !root.contains(active) ||
      !active.matches(":focus-visible")
    )
      return;
    [...root.querySelectorAll<HTMLElement>("input, textarea")].at(-1)?.focus();
  };

  // After a save that needs fixes, the first field to fix takes focus once it shows its error.
  useEffect(() => {
    if (failedSaves > 0) form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [failedSaves]);

  const save = () => {
    if (blockers > 0) {
      setFailedSaves((count) => count + 1);
      return;
    }
    const result = accountStore.updateSite((current) => ({ ...current, legal }));
    if (!result.ok) {
      toast({ title: t("saveFailed"), tone: "danger" });
      return;
    }
    keepFocus();
    forget();
    toast({ title: t("legalSaved"), tone: "success" });
  };

  // How complete the saved notice is (what visitors would get), in the fields' own words.
  const status = legalStatus(site.legal);
  const labels = { name: t("legalName"), address: t("legalAddress"), email: t("legalEmail") } as const;
  const missing = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    missingLegalFields(site.legal).map((field) => labels[field]),
  );

  return (
    <Screen
      title={t("panes.legal")}
      lead={t("legalHint")}
      back={{ href: "/app/settings", label: tApp("nav.settings") }}
      preview
      grow
    >
      {/* Two columns where there is the room (leftover 1): the form, and beside it its help article. */}
      <ColumnGroups>
      <FieldGroup id="legal">
        <p role="status" className="text-small font-medium">
          {status === "complete" ? (
            <span className="text-success-strong inline-flex items-center gap-2">
              <Icon icon={Check} size="sm" />
              {t("legalState.complete")}
            </span>
          ) : status === "incomplete" ? (
            <span className="text-fg-secondary">{t("legalMissing", { fields: missing })}</span>
          ) : (
            <span className="text-fg-secondary">{t("legalState.missing")}</span>
          )}
        </p>
        <form
          ref={form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="grid grid-cols-1 gap-5"
        >
          {failedSaves > 0 && blockers > 0 ? (
            <p
              role="alert"
              className="border-danger-strong bg-danger-subtle text-small rounded-md border p-3"
            >
              {tEdit("fixErrors", { count: blockers })}
            </p>
          ) : null}
          <TextInput
            label={t("legalName")}
            value={legal.name}
            onValue={(name) => set({ name })}
            onBlur={() => leave("name")}
            error={message("name")}
            autoComplete="name"
            maxLength={120}
          />
          <TextArea
            label={t("legalAddress")}
            hint={t("legalAddressHint")}
            value={legal.address}
            onValue={(address) => set({ address })}
            onBlur={() => leave("address")}
            max={300}
            rows={3}
            autoComplete="street-address"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextInput
              label={t("legalEmail")}
              type="email"
              ltr
              value={legal.email}
              onValue={(email) => set({ email })}
              onBlur={() => leave("email")}
              error={message("email")}
              autoComplete="email"
            />
            <TextInput
              label={t("legalPhone")}
              type="tel"
              ltr
              value={legal.phone}
              onValue={(phone) => set({ phone })}
              onBlur={() => leave("phone")}
              error={message("phone")}
              autoComplete="tel"
            />
          </div>
          {dirty ? (
            <FormActions status={t("legalUnsaved")}>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  keepFocus();
                  forget();
                }}
              >
                {t("legalDiscard")}
              </Button>
              <Button type="submit" variant="primary" size="md">
                {t("legalSave")}
              </Button>
            </FormActions>
          ) : null}
        </form>
      </FieldGroup>
      <HelpGroup slug="impressum" />
      </ColumnGroups>
    </Screen>
  );
}
