"use client";

import type { Block } from "@linkyo/blocks";
import { Button } from "@linkyo/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BlockForm } from "./block-form";
import { useSite } from "./site-context";
import { validateBlock, type FieldErrors } from "./validate";

export interface BlockEditor<S extends Block | null> {
  /** The block as it is being edited (the source until something changes). */
  draft: S;
  /** Problems found by the last save, kept up to date while they are fixed; null before a first save. */
  errors: FieldErrors | null;
  change: (next: Block) => void;
  /** Adds or updates the block; false (and the errors show) when it cannot be saved yet. */
  save: () => boolean;
  /** Something was changed: leaving would lose it. */
  dirty: boolean;
  failedSaves: number;
}

interface EditorState<S> {
  key: string | null;
  draft: S;
  errors: FieldErrors | null;
  failedSaves: number;
}

/**
 * The editing of one block, wherever its form is shown (the edit sheet, the Add sheet's second step).
 * The draft drives the live preview while typing; a new `source` (another block) starts a fresh draft.
 * `index` is where a new block goes (undefined: at the end).
 */
export function useBlockEditor<S extends Block | null>({ source, creating, index }: { source: S; creating: boolean; index?: number | undefined }): BlockEditor<S> {
  const { dispatch, setDraft } = useSite();
  const key = source?.id ?? null;
  const [state, setState] = useState<EditorState<S>>({ key, draft: source, errors: null, failedSaves: 0 });
  if (state.key !== key) setState({ key, draft: source, errors: null, failedSaves: 0 });
  const draft = state.key === key ? state.draft : source;

  // After a save that needs fixes, focus the first field to fix once it shows its error.
  useEffect(() => {
    if (state.failedSaves > 0) document.querySelector<HTMLElement>("[role=dialog] [aria-invalid=true]")?.focus();
  }, [state.failedSaves]);

  return {
    draft,
    errors: state.errors,
    dirty: draft !== source,
    failedSaves: state.failedSaves,
    change: (next) => {
      setState((current) => ({
        ...current,
        draft: next as S,
        // After a first save attempt, errors update as people fix them.
        errors: current.errors ? (validateBlock(next) ?? {}) : null,
      }));
      setDraft(next);
    },
    save: () => {
      if (!draft) return false;
      const problems = validateBlock(draft);
      if (problems) {
        setState((current) => ({ ...current, errors: problems, failedSaves: current.failedSaves + 1 }));
        return false;
      }
      if (creating) dispatch({ type: "add", block: draft, ...(index !== undefined ? { index } : {}) });
      else if (draft !== source) dispatch({ type: "update", id: draft.id, patch: draft });
      return true;
    },
  };
}

/**
 * The block's form: what needs fixing first (read out), the fields, Delete at the end on phones (a
 * thumb's reach away from Save, as in iOS Contacts), and Enter in a single-line field saves.
 */
export function BlockEditorFields({
  editor,
  creating,
  onSave,
  onRemove,
}: {
  editor: BlockEditor<Block>;
  creating: boolean;
  onSave: () => void;
  onRemove?: (() => void) | undefined;
}) {
  const t = useTranslations("app.edit");
  const count = editor.errors ? Object.keys(editor.errors).length : 0;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      className="grid grid-cols-1 gap-6"
    >
      {count > 0 ? (
        <p role="alert" className="rounded-md border border-danger-strong bg-danger-subtle p-3 text-small">
          {t("fixErrors", { count })}
        </p>
      ) : null}
      <BlockForm block={editor.draft} onChange={editor.change} errors={editor.errors ?? {}} creating={creating} />
      {!creating && onRemove ? (
        <Button variant="destructive" size="lg" block icon={Trash2} className="lg:hidden" onClick={onRemove}>
          {t("delete")}
        </Button>
      ) : null}
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  );
}
