"use client";

import { hasImage, NO_IMAGE, normalizeUrl, profileSchema, type Page } from "@linkyo/blocks";
import { Button, ConfirmDialog } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Disclosure } from "./disclosure";
import { ImageInput, SelectField, TextArea, TextInput, UrlInput } from "./form";
import { PreviewButton } from "./preview";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";

type Profile = Page["profile"];
export type ProfileErrors = Partial<Record<"displayName" | "motion", string>>;

/** Written without https:// it gets one, as the link field does when it is left. */
const withScheme = (value: string): string => {
  const trimmed = value.trim();
  return trimmed && !/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? (normalizeUrl(trimmed)?.toString() ?? trimmed) : trimmed;
};

/** A moving header is a direct link to a video file (MP4, WebM or MOV; a query string is fine). Empty is fine too. */
export function isMotionUrl(value: string): boolean {
  const src = withScheme(value);
  if (!src) return true;
  try {
    const url = new URL(src);
    return /^https?:$/.test(url.protocol) && /\.(?:mp4|webm|mov)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

const validName = (name: string) => profileSchema.shape.displayName.safeParse(name.trim()).success;

/**
 * Name, line, bio, photo: the top of the page. What only some templates show (location, header photo,
 * moving header, logo) waits behind "More for the header", open when one of them is set. Changes show
 * in the preview while typing. The page's language is asked only where it is not a setting of its own
 * (the welcome flow).
 */
export function ProfileFields({
  profile,
  onChange,
  errors,
  nameLabel,
  taglineHint,
  withLanguage = false,
  onCheck,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
  errors: ProfileErrors;
  /** The welcome flow words these for the kind of page ("Name of your shop"). */
  nameLabel?: string | undefined;
  taglineHint?: string | undefined;
  /** Shows "Language of your page" (the welcome flow; in the dashboard it is a setting). */
  withLanguage?: boolean;
  /** A field was left: check it now (the moving header's link). */
  onCheck?: ((field: "motion") => void) | undefined;
}) {
  const t = useTranslations("app.profile");
  const extras = Boolean(profile.location) || hasImage(profile.hero) || Boolean(profile.motion?.src) || hasImage(profile.logo);
  return (
    <div className="grid grid-cols-1 gap-6">
      <ImageInput
        label={t("avatar")}
        kind="avatar"
        shape="round"
        withAlt={false}
        image={profile.avatar}
        onImage={(image) => onChange({ ...profile, avatar: image ? { ...image, alt: profile.displayName } : { src: NO_IMAGE, alt: "" } })}
      />
      <TextInput label={nameLabel ?? t("name")} value={profile.displayName} onValue={(displayName) => onChange({ ...profile, displayName })} maxLength={60} error={errors.displayName} autoComplete="name" />
      <TextInput label={t("tagline")} hint={taglineHint ?? t("taglineHint")} value={profile.tagline ?? ""} onValue={(tagline) => onChange({ ...profile, tagline: tagline || undefined })} maxLength={80} />
      <TextArea label={t("bio")} hint={t("bioHint")} value={profile.bio} onValue={(bio) => onChange({ ...profile, bio })} max={160} />
      {withLanguage ? (
        <SelectField
          label={t("language")}
          value={profile.locale}
          onValue={(locale) => onChange({ ...profile, locale })}
          options={[
            { value: "de", label: "Deutsch" },
            { value: "en", label: "English" },
            { value: "ar", label: "العربية" },
          ]}
        />
      ) : null}
      <Disclosure summary={t("more")} defaultOpen={extras}>
        <div className="grid grid-cols-1 gap-6 pt-4">
          <TextInput label={t("location")} value={profile.location ?? ""} onValue={(location) => onChange({ ...profile, location: location || undefined })} maxLength={60} />
          <ImageInput
            label={t("hero")}
            kind="photo"
            shape="wide"
            withAlt={false}
            image={profile.hero}
            onImage={(image) => onChange(image ? { ...profile, hero: { ...image, alt: profile.displayName } } : { ...profile, hero: undefined })}
          />
          <UrlInput
            label={t("motion")}
            hint={t("motionHint")}
            value={profile.motion?.src ?? ""}
            onValue={(src) => onChange(src.trim() ? { ...profile, motion: { src: src.trim() } } : { ...profile, motion: undefined })}
            onBlur={() => onCheck?.("motion")}
            error={errors.motion}
          />
          <ImageInput
            label={t("logo")}
            kind="logo"
            withAlt={false}
            hint={t("logoHint")}
            image={profile.logo}
            onImage={(image) => onChange(image ? { ...profile, logo: { ...image, alt: profile.displayName } } : { ...profile, logo: undefined })}
          />
        </div>
      </Disclosure>
    </div>
  );
}

export function useProfileDraft() {
  const t = useTranslations("app.profile");
  const { doc, dispatch, setProfileDraft } = useSite();
  const [draft, setLocal] = useState<Profile | null>(null);
  // The name's message once a save found it missing (the welcome flow words it its own way).
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  // The moving header's link is checked once it has been left, or at a save.
  const [motionChecked, setMotionChecked] = useState(false);
  const profile = draft ?? doc.profile;
  // A form that goes away unsaved (its screen closed) leaves nothing behind in the preview.
  useEffect(() => () => setProfileDraft(null), [setProfileDraft]);
  const errors: ProfileErrors = {
    ...(nameMessage && !validName(profile.displayName) ? { displayName: nameMessage } : {}),
    ...(motionChecked && !isMotionUrl(profile.motion?.src ?? "") ? { motion: t("motionInvalid") } : {}),
  };
  const forget = () => {
    setLocal(null);
    setProfileDraft(null);
    setNameMessage(null);
    setMotionChecked(false);
  };
  return {
    profile,
    errors,
    dirty: draft !== null && draft !== doc.profile,
    change: (next: Profile) => {
      setLocal(next);
      setProfileDraft(next);
    },
    /** A field was left: the moving header's link (the only one checked before a save). */
    check: () => {
      setMotionChecked(true);
    },
    /** Returns false (and shows the errors) when the profile cannot be saved yet. */
    save: (requiredMessage: string): boolean => {
      if (!draft) return true;
      const nameOk = validName(draft.displayName);
      const motionOk = isMotionUrl(draft.motion?.src ?? "");
      if (!nameOk || !motionOk) {
        if (!nameOk) setNameMessage(requiredMessage);
        if (!motionOk) setMotionChecked(true);
        return false;
      }
      dispatch({
        type: "profile",
        patch: { ...draft, displayName: draft.displayName.trim(), ...(draft.motion ? { motion: { src: withScheme(draft.motion.src) } } : {}) },
      });
      forget();
      return true;
    },
    reset: forget,
  };
}

/** Focuses the first field that needs fixing, opening "More for the header" first when it is in there. */
function focusFirstInvalid() {
  const field = document.querySelector<HTMLElement>("[role=dialog] [aria-invalid=true]");
  if (!field) return;
  const folded = field.closest("[inert]")?.parentElement;
  if (!folded?.id) {
    field.focus();
    return;
  }
  document.querySelector<HTMLButtonElement>(`[aria-controls="${CSS.escape(folded.id)}"]`)?.click();
  requestAnimationFrame(() => field.focus());
}

/** Profile in a sheet (from the page editor, the home checklist and Settings). */
export function ProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("app.profile");
  const tEdit = useTranslations("app.edit");
  const form = useProfileDraft();
  const [discard, setDiscard] = useState(false);
  const [failedSaves, setFailedSaves] = useState(0);
  // After a save that needs fixes, the first field to fix takes focus once it shows its error.
  useEffect(() => {
    if (failedSaves > 0) focusFirstInvalid();
  }, [failedSaves]);
  const close = () => {
    form.reset();
    onOpenChange(false);
  };
  // Cancel, Escape, a tap beside the sheet or pulling it down: changes are not thrown away unasked.
  const requestClose = () => {
    if (form.dirty) setDiscard(true);
    else close();
  };
  const save = () => {
    if (form.save(t("nameRequired"))) onOpenChange(false);
    else setFailedSaves((count) => count + 1);
  };
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
        title={t("title")}
        description={t("lead")}
        closeLabel={t("close")}
        besidePreview
        headerAction={<PreviewButton className="desk:hidden" />}
        // The navigation row has room for one short word; the button's name stays "Save profile".
        confirm={{ label: t("saveShort"), ariaLabel: t("save"), onConfirm: save }}
        cancel={{ label: t("cancel"), onCancel: requestClose }}
        footer={
          <>
            <Button variant="ghost" onClick={requestClose}>
              {t("cancel")}
            </Button>
            <Button variant="primary" onClick={save}>
              {t("save")}
            </Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <ProfileFields profile={form.profile} onChange={form.change} errors={form.errors} onCheck={form.check} />
          {/* Enter in a single-line field saves. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Sheet>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title={tEdit("discardTitle")}
        description={tEdit("discardBody")}
        confirmLabel={tEdit("discard")}
        cancelLabel={tEdit("keepEditing")}
        onConfirm={() => {
          setDiscard(false);
          close();
        }}
      />
    </>
  );
}
