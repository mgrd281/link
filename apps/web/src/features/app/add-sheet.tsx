"use client";

import { detectLink, detectMany, type Block, type BlockType } from "@linkyo/blocks";
import { Badge, Button, Icon, toast } from "@linkyo/ui";
import { ClipboardPaste, ImagePlus, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, useSyncExternalStore } from "react";

import { blockIcon } from "@/features/directions/editor/ui";
import { canReadClipboard, readText } from "@/lib/clipboard";

import { addGroups, blankBlock, blockFromLink, insertAt, newBlockId } from "./blocks";
import { ImageError, pickFiles, prepareImage } from "./images";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";

// Whether the clipboard can be read never changes while the page is open; the server can't know it.
const never = () => () => undefined;

/**
 * Add anything in one step: paste a link (we recognise the platform and make the right block), upload
 * photos, or pick a type from a few short groups, the first one fitted to the kind of page. Pasted
 * links and picked types land in the same place. Reachable from every screen (sidebar, tab bar, the
 * editor's buttons and its "Add below").
 */
export function AddSheet() {
  const t = useTranslations("app.add");
  const tTypes = useTranslations("dashboard.types");
  const tFields = useTranslations("app.fields");
  const { addOpen, setAddOpen, addIndex, addBlocks, edit, doc, site } = useSite();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canPaste = useSyncExternalStore(never, canReadClipboard, () => false);
  const detection = useMemo(() => (value.trim() ? detectLink(value.trim()) : null), [value]);
  const labels = useMemo(() => ({ video: tTypes("video"), music: tTypes("music"), event: tTypes("events") }), [tTypes]);
  const groups = useMemo(() => addGroups(site.kind), [site.kind]);

  const close = () => {
    // Also forgets the place chosen with "Add below".
    setAddOpen(false);
    setValue("");
    setError(false);
  };

  const addText = (text: string) => {
    const found = detectMany(text);
    if (found.length === 0) {
      setValue(text);
      setError(true);
      document.getElementById(inputId)?.focus();
      return;
    }
    addBlocks(
      found.map((d) => blockFromLink(d, labels, doc.profile.displayName)),
      { index: addIndex },
    );
    close();
  };

  // One tap instead of long-press and Paste. iOS asks once with its own Paste button; when reading is
  // refused or the clipboard is empty, the field takes focus so the usual paste still works.
  const paste = async () => {
    const text = await readText();
    if (text) addText(text);
    else document.getElementById(inputId)?.focus();
  };

  const pick = (type: BlockType) => {
    // The same place as a pasted link. A new section goes to the end: it starts a part of the page.
    const index = addIndex ?? (type === "header" ? undefined : insertAt(doc.blocks));
    close();
    // Let the add sheet hand focus back before the edit sheet opens.
    requestAnimationFrame(() => edit({ mode: "create", block: blankBlock(type, { artist: doc.profile.displayName, newsletter: tFields("newsletterDefault") }), index }));
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
      if (block) addBlocks([block], { index: addIndex });
      close();
    } catch (problem) {
      toast({ title: t(`imageErrors.${problem instanceof ImageError ? problem.reason : "decode"}`), tone: "danger" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet
      open={addOpen}
      onOpenChange={(open) => (open ? setAddOpen(true, addIndex) : close())}
      title={t("title")}
      description={t("lead")}
      closeLabel={t("close")}
      besidePreview
    >
      <div className="grid grid-cols-1 gap-6">
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
          <div className="flex items-center gap-2 rounded-lg border border-line-input bg-surface ps-4 pe-2 has-[input:focus-visible]:border-focus has-[input:focus-visible]:focus-field">
            <Icon icon={Link2} size="md" className="shrink-0 text-fg-tertiary" />
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
            {/* Empty field: paste in one tap. With text: add it. Without clipboard access: Add waits for text. */}
            {!value.trim() && canPaste ? (
              <Button type="button" variant="tinted" size="sm" icon={ClipboardPaste} onClick={() => void paste()}>
                {t("paste")}
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="sm" disabled={!value.trim()}>
                {t("addButton")}
              </Button>
            )}
          </div>
          {/* Read out when a platform is recognised; the error interrupts. */}
          <p id={`${inputId}-hint`} aria-live="polite" className={error ? "text-small text-danger-strong" : "min-h-control-sm text-small text-fg-secondary"}>
            {error ? (
              <span role="alert">{t("invalid")}</span>
            ) : detection ? (
              <Badge tone="primary">{t("detected", { type: tTypes(detection.type === "shorts" ? "link" : detection.type) })}</Badge>
            ) : (
              t("pasteHint")
            )}
          </p>
        </form>

        <div className="grid grid-cols-1 gap-2">
          <Button variant="tinted" size="lg" block icon={ImagePlus} loading={uploading} onClick={() => void upload()}>
            {t("photos")}
          </Button>
          <p className="text-caption text-fg-secondary">{t("photosHint")}</p>
        </div>

        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`${inputId}-${group.key}`} className="grid grid-cols-1 gap-2">
            <h3 id={`${inputId}-${group.key}`} className="text-small font-semibold text-fg-secondary">
              {t(`groups.${group.key}`)}
            </h3>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.types.map((type) => (
                <li key={type} className="grid">
                  {/* The name starts with the type ("Link Any website …"), then what it is for. */}
                  <button
                    type="button"
                    data-type={type}
                    onClick={() => pick(type)}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 text-start transition-[background-color,border-color,scale] duration-micro hover:border-line-input focus-visible:focus-ring active:scale-pressed active:bg-pressed motion-reduce:active:scale-none"
                  >
                    <span className="grid size-control-md shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg">
                      <Icon icon={blockIcon[type]} size="md" />
                    </span>
                    <span className="grid min-w-0">
                      <span className="text-small font-semibold">{tTypes(type)}</span>
                      <span className="text-caption text-fg-secondary">{t(`desc.${type}`)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
