"use client";

import { NO_IMAGE, profileSchema, type Page } from "@linkyo/blocks";
import { Button } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ImageInput, SelectField, TextArea, TextInput, UrlInput } from "./form";
import { PreviewButton } from "./preview";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";

type Profile = Page["profile"];

/** Name, line, bio, photos: the top of the page. Changes show in the preview while typing. */
export function ProfileFields({
  profile,
  onChange,
  errors,
  nameLabel,
  taglineHint,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
  errors: Partial<Record<"displayName", string>>;
  /** The welcome flow words these for the kind of page ("Name of your shop"). */
  nameLabel?: string | undefined;
  taglineHint?: string | undefined;
}) {
  const t = useTranslations("app.profile");
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
      />
      <ImageInput label={t("logo")} kind="logo" withAlt={false} image={profile.logo} onImage={(image) => onChange(image ? { ...profile, logo: { ...image, alt: profile.displayName } } : { ...profile, logo: undefined })} />
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
    </div>
  );
}

export function useProfileDraft() {
  const { doc, dispatch, setProfileDraft } = useSite();
  const [draft, setLocal] = useState<Profile | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"displayName", string>>>({});
  const profile = draft ?? doc.profile;
  return {
    profile,
    errors,
    dirty: draft !== null && draft !== doc.profile,
    change: (next: Profile) => {
      setLocal(next);
      setProfileDraft(next);
      if (errors.displayName && next.displayName.trim()) setErrors({});
    },
    /** Returns false (and shows the error) when the profile cannot be saved yet. */
    save: (requiredMessage: string): boolean => {
      if (!draft) return true;
      if (!profileSchema.shape.displayName.safeParse(draft.displayName.trim()).success) {
        setErrors({ displayName: requiredMessage });
        return false;
      }
      dispatch({ type: "profile", patch: { ...draft, displayName: draft.displayName.trim() } });
      setLocal(null);
      setProfileDraft(null);
      return true;
    },
    reset: () => {
      setLocal(null);
      setProfileDraft(null);
      setErrors({});
    },
  };
}

/** Profile in a sheet (from the page editor and the home checklist). */
export function ProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("app.profile");
  const form = useProfileDraft();
  const close = () => {
    form.reset();
    onOpenChange(false);
  };
  const save = () => {
    if (form.save(t("nameRequired"))) onOpenChange(false);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t("title")}
      description={t("lead")}
      closeLabel={t("close")}
      besidePreview
      headerAction={<PreviewButton className="xl:hidden" />}
      confirm={{ label: t("save"), onConfirm: save }}
      cancel={{ label: t("cancel"), onCancel: close }}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t("cancel")}
          </Button>
          <Button variant="primary" onClick={save}>
            {t("save")}
          </Button>
        </>
      }
    >
      <ProfileFields profile={form.profile} onChange={form.change} errors={form.errors} />
    </Sheet>
  );
}
