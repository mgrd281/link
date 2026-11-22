"use client";

import { Button, Icon, IconButton } from "@linkyo/ui";
import { CircleAlert, ImagePlus, Send, ShieldCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { clockTime, longDate, type EmailLocale } from "@/features/email/templates/render";
import { accessToken } from "@/lib/supabase/access-token";

import { TextArea } from "../form";
import { pickFiles } from "../images";
import { uploadToBucket } from "../media-upload";

/** File types the `briefing` bucket accepts, with their extension. */
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const MAX_PHOTOS = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_LINKS = 20;

interface Photo {
  path: string;
  name: string;
  preview: string;
}

const LANGUAGES = [
  { value: "de", label: "Deutsch", lang: "de" },
  { value: "en", label: "English", lang: "en" },
  { value: "ar", label: "العربية", lang: "ar" },
] as const;

/**
 * The briefing of a page-service order: links (one per line), photos into the account's private
 * folder of this order (`briefing/<uid>/<order>/…`), wishes and the page's language. For Start the
 * line on what goes to the AI provider sits right above the button. Sending it fixes the ready date
 * (on time: the promised one).
 */
export function BriefingForm({ orderId, accountId, pkg, onSent }: { orderId: string; accountId: string; pkg: "start" | "premium"; onSent: (dueAt: string) => void }) {
  const t = useTranslations("app.orders.briefing");
  const tLegal = useTranslations("legal.errors");
  const locale = useLocale() as EmailLocale;
  const [links, setLinks] = useState("");
  const [wishes, setWishes] = useState("");
  const [pageLocale, setPageLocale] = useState<EmailLocale>(locale);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const languageId = useId();
  const photosId = useId();

  // Previews are local object URLs: let them go with the form.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    const list = previews.current;
    return () => list.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const addPhotos = async () => {
    const files = (await pickFiles({ multiple: true, accept: Object.keys(PHOTO_TYPES).join(",") })).filter((file) => file.type in PHOTO_TYPES && file.size <= MAX_BYTES);
    const room = MAX_PHOTOS - photos.length;
    if (files.length === 0 || room <= 0) return;
    setUploading(true);
    setProblem("");
    try {
      const added: Photo[] = [];
      for (const file of files.slice(0, room)) {
        const path = `${accountId}/${orderId}/${crypto.randomUUID()}.${PHOTO_TYPES[file.type] ?? "jpg"}`;
        await uploadToBucket("briefing", path, file, file.type);
        const preview = URL.createObjectURL(file);
        previews.current.push(preview);
        added.push({ path, name: file.name, preview });
      }
      setPhotos((current) => [...current, ...added]);
    } catch {
      setProblem(tLegal("server"));
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    setBusy(true);
    setProblem("");
    try {
      const list = links
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, MAX_LINKS);
      const token = await accessToken();
      const response = await fetch(`/api/orders/${orderId}/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ links: list, photos: photos.map((photo) => photo.path), wishes: wishes.trim(), pageLocale }),
      });
      const data = (await response.json()) as { dueAt?: unknown };
      if (!response.ok || typeof data.dueAt !== "string") throw new Error("not sent");
      onSent(data.dueAt);
    } catch {
      setProblem(tLegal("server"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <TextArea label={t("links")} hint={t("linksHint")} value={links} onValue={setLinks} max={MAX_LINKS * 300} rows={4} dir="ltr" inputMode="url" />

      <div className="grid gap-3">
        <p id={photosId} className="text-small text-fg">
          {t("photos")}
        </p>
        {photos.length > 0 ? (
          <ul aria-labelledby={photosId} className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((photo) => (
              <li key={photo.path} className="relative aspect-square overflow-hidden rounded-md border border-line bg-canvas-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (object URL) of a private upload */}
                <img src={photo.preview} alt={photo.name} className="size-full object-cover" />
                <IconButton
                  icon={X}
                  label={`${t("removePhoto")}: ${photo.name}`}
                  size="sm"
                  variant="secondary"
                  className="absolute end-1 top-1"
                  onClick={() => setPhotos((current) => current.filter((item) => item.path !== photo.path))}
                />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="lg" loading={uploading} disabled={photos.length >= MAX_PHOTOS} onClick={() => void addPhotos()}>
            <Icon icon={ImagePlus} size="md" />
            {t("addPhotos")}
          </Button>
          <span className="text-small text-fg-secondary">{t("photosHint")}</span>
        </div>
      </div>

      <TextArea label={t("wishes")} hint={t("wishesHint")} value={wishes} onValue={setWishes} max={2000} rows={4} />

      <div className="grid gap-2">
        <label htmlFor={languageId} className="text-small text-fg">
          {t("language")}
        </label>
        <select
          id={languageId}
          value={pageLocale}
          onChange={(event) => setPageLocale(event.target.value as EmailLocale)}
          className="h-control-lg rounded-md border border-line-input bg-surface-elevated px-3 text-body text-fg focus-visible:focus-field lg:pointer-fine:h-control-md"
        >
          {LANGUAGES.map((language) => (
            <option key={language.value} value={language.value} lang={language.lang}>
              {language.label}
            </option>
          ))}
        </select>
      </div>

      {pkg === "start" ? (
        <p className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4 text-small text-pretty text-fg-secondary" data-briefing-privacy>
          <Icon icon={ShieldCheck} size="md" className="mt-0.5 shrink-0 text-fg" />
          {t("privacy")}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="flex items-start gap-2 text-body text-danger-strong">
          <Icon icon={CircleAlert} size="md" className="mt-0.5 shrink-0" />
          {problem}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" loading={busy} disabled={uploading} className="w-full sm:w-auto sm:justify-self-start">
        <Icon icon={Send} size="md" className="rtl:-scale-x-100" />
        {t("submit")}
      </Button>
    </form>
  );
}

/** "Fertig bis Dienstag, 24. November 2026, 18:00 Uhr" pieces for the order screen. */
export function dueParts(iso: string, locale: EmailLocale): { date: string; time: string } {
  const at = new Date(iso);
  return { date: longDate(at, locale), time: clockTime(at, locale) };
}
