"use client";

import type { Block } from "@linkyo/blocks";
import { Button, ConfirmDialog } from "@linkyo/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BlockEditorFields, useBlockEditor } from "./block-editor";
import { PreviewButton } from "./preview";
import { releasedAddresses } from "./project-form";
import { useShellChrome } from "./screen";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";

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
  const editor = useBlockEditor({ source, creating, index });
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
