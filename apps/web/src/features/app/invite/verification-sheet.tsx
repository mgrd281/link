"use client";

import { normalizeUrl } from "@linkyo/blocks";
import { Button, toast } from "@linkyo/ui";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { accountStore } from "@/features/account/store";
import { FormError } from "@/features/account/auth/fields";
import { REFERRAL_RULES } from "@/features/referrals/rules";
import { isRtl } from "@/i18n/routing";
import type { VerificationResult } from "@/features/referrals/types";

import { TextArea, UrlInput } from "../form";
import { Sheet } from "../sheet";

/** At most this many official profiles per request (as SQL request_verification() allows). */
const MAX_LINKS = 3;
const NOTE_MAX = 300;

/**
 * "https://" kept left to right inside a right-to-left sentence (LRI … PDI). Otherwise its slashes,
 * at the end of an Arabic hint, are pulled to the far side and read "//:https".
 */
const isolateUrls = (text: string, rtl: boolean) => (rtl ? text.replace(/https:\/\//g, "\u2066$&\u2069") : text);

type Failure = Extract<VerificationResult, { ok: false }>["error"];

/**
 * Asking for the free verification review: one to three official profiles that carry the Linkyo
 * address in their bio, and an optional note. The team checks them by hand and sets the blue check.
 * Sent: the sheet closes, a toast says so, and the screen loads the program again (`onSent`).
 */
export function VerificationSheet({
  open,
  onOpenChange,
  username,
  retryAt,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  /** After a decline: from when a new request is allowed (for the "too soon" answer). */
  retryAt: string | null;
  onSent: () => void;
}) {
  const t = useTranslations("app.invite.sheet");
  const locale = useLocale();
  const rtl = isRtl(locale);
  const formId = useId();
  const [links, setLinks] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  // A sheet that opens again starts empty.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setLinks([""]);
      setNote("");
      setError(null);
    }
  }

  const message = (failure: Failure): string => {
    switch (failure) {
      case "tooSoon":
        return t("errors.tooSoon", { date: retryAt ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(retryAt)) : "" });
      case "notUnlocked":
        return t("errors.notUnlocked", { count: REFERRAL_RULES.verificationAt });
      default:
        return t(`errors.${failure}`);
    }
  };

  const submit = async () => {
    if (busy) return;
    // Typed without https:// and sent with Enter (before the field cleaned it up on leaving): cleaned here.
    const cleaned = links.map((link) => link.trim()).filter(Boolean).map((link) => normalizeUrl(link)?.toString() ?? link);
    if (cleaned.length === 0 || cleaned.some((link) => !link.startsWith("https://"))) {
      setError("invalidLinks");
      document.getElementById(`${formId}-link-0`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const result = await accountStore.requestVerification({ links: cleaned, ...(note.trim() ? { note: note.trim() } : {}) }).catch((): VerificationResult => ({ ok: false, error: "serverError" }));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (result.error === "invalidLinks") document.getElementById(`${formId}-link-0`)?.focus();
      return;
    }
    onOpenChange(false);
    toast({ title: t("sent"), tone: "success" });
    onSent();
  };

  // A wrong link is shown at the first field; any other answer as a banner above the fields.
  const fieldError = error === "invalidLinks" ? isolateUrls(message(error), rtl) : undefined;
  const banner = error && error !== "invalidLinks" ? message(error) : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title={t("title")}
      description={t("lead", { username })}
      closeLabel={t("close")}
      footer={
        <Button type="submit" form={formId} variant="primary" loading={busy}>
          {t("submit")}
        </Button>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="grid grid-cols-1 gap-5"
      >
        <FormError message={banner} />
        {links.map((link, index) => (
          <UrlInput
            // The fields are only ever added at the end, so their place is their identity.
            key={index}
            id={`${formId}-link-${index}`}
            label={index === 0 ? t("link") : t("linkN", { n: index + 1 })}
            hint={isolateUrls(t("linkHint"), rtl)}
            error={index === 0 ? fieldError : undefined}
            value={link}
            onValue={(value) => {
              setLinks((current) => current.map((entry, at) => (at === index ? value : entry)));
              if (error === "invalidLinks") setError(null);
            }}
          />
        ))}
        {links.length < MAX_LINKS ? (
          <Button
            variant="tinted"
            size="sm"
            icon={Plus}
            className="justify-self-start"
            onClick={() => {
              const next = links.length;
              setLinks((current) => [...current, ""]);
              // The new field takes focus once it is there.
              window.requestAnimationFrame(() => document.getElementById(`${formId}-link-${next}`)?.focus());
            }}
          >
            {t("addLink")}
          </Button>
        ) : null}
        <TextArea label={t("note")} value={note} onValue={setNote} max={NOTE_MAX} />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
