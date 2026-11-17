"use client";

import type { Block } from "@linkyo/blocks";
import { Button, ConfirmDialog, Icon } from "@linkyo/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { blockIcon } from "@/features/directions/editor/ui";

import { BlockForm } from "./block-form";
import { PreviewButton } from "./preview";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";
import { validateBlock, type FieldErrors } from "./validate";

/** The one place blocks are edited (and created): a sheet with the form, the page live beside it. */
export function EditSheet() {
  const { editing, edit, doc } = useSite();
  const source = editing?.mode === "edit" ? doc.blocks.find((block) => block.id === editing.id) : editing?.mode === "create" ? editing.block : undefined;
  if (!source || !editing) return null;
  // Keyed by block: opening another block starts a fresh draft.
  return <EditForm key={source.id} source={source} creating={editing.mode === "create"} onDone={() => edit(null)} />;
}

function EditForm({ source, creating, onDone }: { source: Block; creating: boolean; onDone: () => void }) {
  const t = useTranslations("app.edit");
  const tTypes = useTranslations("dashboard.types");
  const { dispatch, setDraft, removeBlock, editing } = useSite();
  const [draft, setLocalDraft] = useState(source);
  const [errors, setErrors] = useState<FieldErrors | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = creating || draft !== source;
  const type = tTypes(source.type);

  const change = (next: Block) => {
    setLocalDraft(next);
    setDraft(next);
    // After a first save attempt, errors update as people fix them.
    if (errors) setErrors(validateBlock(next) ?? {});
  };

  const save = () => {
    const problems = validateBlock(draft);
    if (problems) {
      setErrors(problems);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[role=dialog] [aria-invalid=true]")?.focus());
      return;
    }
    if (creating) dispatch({ type: "add", block: draft, ...(editing?.mode === "create" && editing.index !== undefined ? { index: editing.index } : {}) });
    else if (draft !== source) dispatch({ type: "update", id: source.id, patch: draft });
    onDone();
  };

  const close = () => {
    if (dirty && draft !== source) setConfirmDiscard(true);
    else onDone();
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
        headerAction={<PreviewButton className="xl:hidden" />}
        footer={
          <>
            {!creating ? (
              <Button
                variant="destructive"
                icon={Trash2}
                className="me-auto"
                onClick={() => {
                  onDone();
                  removeBlock(source);
                }}
              >
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
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="grid grid-cols-1 gap-6"
        >
          <p className="flex items-center gap-2 text-caption font-medium text-fg-secondary">
            <Icon icon={blockIcon[source.type]} size="sm" />
            {type}
          </p>
          {errors && Object.keys(errors).length > 0 ? (
            <p role="alert" className="rounded-md border border-danger-strong bg-danger-subtle p-3 text-small">
              {t("fixErrors", { count: Object.keys(errors).length })}
            </p>
          ) : null}
          <BlockForm block={draft} onChange={change} errors={errors ?? {}} />
          {/* Enter in a single-line field saves. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
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
