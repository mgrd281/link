"use client";

import type { Block } from "@linkyo/blocks";
import { Button, ConfirmDialog } from "@linkyo/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { isShowDate } from "@/features/directions/editor/state";

import { BlockEditorFields, useBlockEditor, type BlockEditor } from "./block-editor";
import { PreviewButton } from "./preview";
import { releasedAddresses } from "./project-form";
import { useShellChrome } from "./screen";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";
import { validateBlock, type FieldErrors } from "./validate";

/**
 * What a show needs before it goes on the page: a date and a city. Nothing fills them in for the
 * owner (a pasted ticket link knows neither), so an Events form starts with both empty and asks.
 */
export function showProblems(block: Block | null): FieldErrors | null {
  if (block?.type !== "events") return null;
  const errors: FieldErrors = {};
  block.items.forEach((item, index) => {
    if (!isShowDate(item.date)) errors[`items.${String(index)}.date`] = item.date ? "invalid" : "required";
    if (!item.city.trim()) errors[`items.${String(index)}.city`] = "required";
  });
  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * A block's editor with the rules for shows on top. The schema asks for a date but leaves the city
 * open (older pages have shows without one), so the form asks for both here, in the same words as
 * any other field, and saves only once each show has them. Other blocks pass through unchanged.
 */
export function useShowRules<S extends Block | null>(editor: BlockEditor<S>): BlockEditor<S> {
  // Save attempts per block: another block in the same sheet (the Add sheet's next form) starts afresh.
  const key = editor.draft?.id ?? null;
  const [tries, setTries] = useState({ key, count: 0 });
  if (tries.key !== key) setTries({ key, count: 0 });
  const tried = tries.key === key ? tries.count : 0;
  // After a save that needs fixes, the first field to fix takes focus once it shows its error.
  useEffect(() => {
    if (tried > 0) document.querySelector<HTMLElement>("[role=dialog] [aria-invalid=true]")?.focus();
  }, [tried]);
  if (editor.draft?.type !== "events") return editor;
  const draft: Block = editor.draft;
  // Once a save was tried, every problem shows and updates as it is fixed.
  const errors = tried > 0 || editor.errors ? { ...(validateBlock(draft) ?? {}), ...(showProblems(draft) ?? {}) } : null;
  return {
    ...editor,
    errors,
    failedSaves: editor.failedSaves + tried,
    save: () => {
      if (showProblems(draft)) {
        setTries((current) => ({ key: draft.id, count: (current.key === draft.id ? current.count : 0) + 1 }));
        return false;
      }
      return editor.save();
    },
  };
}

/** The one place blocks are edited (and created, except from the Add sheet): a sheet with the form, the page live beside it. */
export function EditSheet() {
  const { editing, edit, doc, dispatch } = useSite();
  // A project that took over another one's earlier address (the sheet said so before saving): that
  // address now leads to it alone, so it leaves the other project's list. Part of the same save, no
  // undo step of its own; the page's rules (every address once) hold again.
  useEffect(() => {
    for (const fix of releasedAddresses(doc.blocks)) dispatch({ type: "enrich", id: fix.id, patch: { was: fix.was } });
  }, [doc.blocks, dispatch]);
  // A block picked in the Add sheet is filled in there.
  if (editing?.mode === "create" && editing.inAddSheet) return null;
  const source = editing?.mode === "edit" ? doc.blocks.find((block) => block.id === editing.id) : editing?.mode === "create" ? editing.block : undefined;
  if (!source || !editing) return null;
  // Keyed by block: opening another block starts a fresh draft.
  return (
    <EditForm
      key={source.id}
      source={source}
      creating={editing.mode === "create"}
      index={editing.mode === "create" ? editing.index : undefined}
      onDone={() => edit(null)}
    />
  );
}

function EditForm({ source, creating, index, onDone }: { source: Block; creating: boolean; index: number | undefined; onDone: () => void }) {
  const t = useTranslations("app.edit");
  const tTypes = useTranslations("dashboard.types");
  const { removeBlock } = useSite();
  const inShell = useShellChrome();
  const editor = useShowRules(useBlockEditor({ source, creating, index }));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const type = tTypes(source.type);

  const save = () => {
    if (editor.save()) onDone();
  };

  const close = () => {
    if (editor.dirty) setConfirmDiscard(true);
    else onDone();
  };

  const remove = () => {
    onDone();
    removeBlock(source);
  };

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={creating ? t("addTitle", { type }) : t("editTitle", { type })}
        description={t(`hints.${source.type}`)}
        closeLabel={t("close")}
        besidePreview
        // Hidden where the page shows beside the sheet: from desk in the dashboard, from xl in the team area.
        headerAction={<PreviewButton className={inShell ? "desk:hidden" : "xl:hidden"} />}
        // The navigation row has room for one short word; the button's name stays "Add to page".
        confirm={creating ? { label: t("addShort"), ariaLabel: t("add"), onConfirm: save } : { label: t("save"), onConfirm: save }}
        cancel={{ label: t("cancel"), onCancel: close }}
        footer={
          <>
            {!creating ? (
              <Button variant="destructive" icon={Trash2} className="me-auto" onClick={remove}>
                {t("delete")}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={close}>
              {t("cancel")}
            </Button>
            <Button variant="primary" onClick={save}>
              {creating ? t("add") : t("save")}
            </Button>
          </>
        }
      >
        <BlockEditorFields editor={editor} creating={creating} onSave={save} onRemove={remove} />
      </Sheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t("discardTitle")}
        description={t("discardBody")}
        confirmLabel={t("discard")}
        cancelLabel={t("keepEditing")}
        onConfirm={() => {
          setConfirmDiscard(false);
          onDone();
        }}
      />
    </>
  );
}
