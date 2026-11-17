"use client";

import { detectLink, detectMany, type Block, type BlockType } from "@linkyo/blocks";
import { Badge, Button, Icon, toast } from "@linkyo/ui";
import { ClipboardPaste, ImagePlus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { blockIcon } from "@/features/directions/editor/ui";

import { ADDABLE, blankBlock, blockFromLink, newBlockId } from "./blocks";
import { ImageError, pickFiles, prepareImage } from "./images";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";

/**
 * Add anything in one step: paste a link (we recognise the platform and make the right block), pick
 * a type, or upload photos. Reachable from every screen (sidebar button, the + in the tab bar).
 */
export function AddSheet() {
  const t = useTranslations("app.add");
  const tTypes = useTranslations("dashboard.types");
  const tFields = useTranslations("app.fields");
  const { addOpen, setAddOpen, addBlocks, edit, doc } = useSite();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const detection = useMemo(() => (value.trim() ? detectLink(value.trim()) : null), [value]);
  const labels = useMemo(() => ({ video: tTypes("video"), music: tTypes("music"), event: tTypes("events") }), [tTypes]);

  const close = () => {
    setAddOpen(false);
    setValue("");
    setError(false);
  };

  const addText = (text: string) => {
    const found = detectMany(text);
    if (found.length === 0) {
      setError(true);
      document.getElementById(inputId)?.focus();
      return;
    }
    addBlocks(found.map((d) => blockFromLink(d, labels, doc.profile.displayName)));
    close();
  };

  const pick = (type: BlockType) => {
    close();
    // Let the add sheet hand focus back before the edit sheet opens.
    requestAnimationFrame(() => edit({ mode: "create", block: blankBlock(type, { artist: doc.profile.displayName, newsletter: tFields("newsletterDefault") }) }));
  };

  const upload = async () => {
    const files = await pickFiles({ multiple: true });
    if (files.length === 0) return;
    setUploading(true);
    try {
      const images = await Promise.all(files.slice(0, 24).map((file) => prepareImage(file, "photo")));
      const base = { visible: true, highlight: false };
      const first = images[0];
      const block: Block | null =
        images.length === 1 && first
          ? { ...base, id: newBlockId("image"), type: "image", image: { src: first.src, alt: "", tone: first.tone } }
          : images.length > 1
            ? { ...base, id: newBlockId("gallery"), type: "gallery", images: images.map((image) => ({ src: image.src, alt: "", tone: image.tone })) }
            : null;
      if (block) addBlocks([block]);
      close();
    } catch (problem) {
      toast({ title: t(`imageErrors.${problem instanceof ImageError ? problem.reason : "decode"}`), tone: "danger" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : close())} title={t("title")} description={t("lead")} closeLabel={t("close")}>
      <div className="grid grid-cols-1 gap-8">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            addText(value);
          }}
          className="grid grid-cols-1 gap-3"
        >
          <label htmlFor={inputId} className="text-small font-semibold">
            {t("pasteLabel")}
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-line-input bg-surface ps-4 pe-2 has-[input:focus-visible]:border-focus has-[input:focus-visible]:focus-ring">
            <Icon icon={ClipboardPaste} size="md" className="shrink-0 text-fg-tertiary" />
            <input
              id={inputId}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(false);
              }}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text");
                if (!value && detectMany(text).length > 0) {
                  event.preventDefault();
                  addText(text);
                }
              }}
              dir="ltr"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("pastePlaceholder")}
              aria-invalid={error || undefined}
              aria-describedby={`${inputId}-hint`}
              className="h-control-xl min-w-0 flex-1 bg-transparent text-body-lg outline-none placeholder:text-fg-tertiary"
            />
            <Button type="submit" variant="primary" disabled={!value.trim()}>
              {t("addButton")}
            </Button>
          </div>
          <p id={`${inputId}-hint`} className={error ? "text-small text-danger-strong" : "min-h-control-sm text-small text-fg-secondary"}>
            {error ? t("invalid") : detection ? <Badge tone="primary">{t("detected", { type: tTypes(detection.type === "shorts" ? "link" : detection.type) })}</Badge> : t("pasteHint")}
          </p>
        </form>

        <section aria-labelledby={`${inputId}-types`} className="grid grid-cols-1 gap-3">
          <h3 id={`${inputId}-types`} className="text-small font-semibold">
            {t("orChoose")}
          </h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ADDABLE.map((type) => (
              <li key={type} className="grid">
                <button
                  type="button"
                  onClick={() => pick(type)}
                  className="grid content-start gap-1 rounded-lg border border-line bg-surface p-3 text-start transition-[border-color,background-color] duration-micro hover:border-line-input hover:bg-surface-elevated focus-visible:focus-ring active:scale-pressed"
                >
                  <span className="flex items-center gap-2 text-small font-semibold">
                    <span className="grid size-control-sm shrink-0 place-items-center rounded-sm bg-selected text-selected-fg">
                      <Icon icon={blockIcon[type]} size="sm" />
                    </span>
                    {tTypes(type)}
                  </span>
                  <span className="text-caption text-fg-secondary">{t(`desc.${type}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid justify-items-start gap-3 rounded-lg border border-dashed border-line-strong p-4">
          <p className="text-small text-fg-secondary">{t("photosHint")}</p>
          <Button icon={uploading ? Plus : ImagePlus} loading={uploading} onClick={() => void upload()}>
            {t("photos")}
          </Button>
        </section>
      </div>
    </Sheet>
  );
}
