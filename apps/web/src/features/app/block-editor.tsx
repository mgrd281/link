"use client";

import type { Block } from "@linkyo/blocks";
import { Button, Icon, icons } from "@linkyo/ui";
import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BlockForm } from "./block-form";
import { clickableBlocks, sampleStats } from "./sample-stats";
import { useShellChrome } from "./screen";
import { useSite } from "./site-context";
import { statsSource, useLiveStats } from "./stats";
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
      {creating ? null : <BlockTaps block={editor.draft} />}
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

/** The range the editor's count chip looks back over. */
const CHIP_DAYS = 30;
const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

/**
 * How often visitors tapped this block lately, on top of its form: the demo's sample number (labelled),
 * or a real page's cookie-free count once counting is on. Nothing while nothing is counted, for blocks
 * nobody can tap (a title, a text, a divider), and outside the creator's own dashboard (the team edits
 * prepared pages with this form, and those have no visitors of their own).
 */
function BlockTaps({ block }: { block: Block }) {
  const inShell = useShellChrome();
  const tappable = clickableBlocks([block]).length > 0;
  if (!inShell || !tappable) return null;
  return statsSource() === "sample" ? <SampleTaps block={block} /> : <LiveTaps block={block} />;
}

function TapChip({ children }: { children: ReactNode }) {
  return (
    <p data-block-taps className="flex w-fit items-center gap-2 rounded-full border border-line px-3 py-1 text-caption text-fg-secondary">
      <Icon icon={icons.analytics} size="xs" className="shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function SampleTaps({ block }: { block: Block }) {
  const t = useTranslations("app.analytics");
  const { account, doc } = useSite();
  const count = useMemo(() => sampleStats(account.username, doc.blocks, CHIP_DAYS).links.find((link) => link.block.id === block.id)?.clicks ?? 0, [account.username, doc.blocks, block.id]);
  return <TapChip>{t.rich("blockClicksSample", { count, days: String(CHIP_DAYS), bdi })}</TapChip>;
}

function LiveTaps({ block }: { block: Block }) {
  const t = useTranslations("app.analytics");
  const locale = useLocale();
  const { account } = useSite();
  const state = useLiveStats(account.id, CHIP_DAYS);
  if (state.status !== "ready") return null;
  const { since, from, blocks } = state.stats;
  if (since === null) return null;
  const count = blocks.find((item) => item.key === block.id)?.count ?? 0;
  // Counting began inside the range: say since when, so a young count does not read as 30 days.
  if (since > from) {
    const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(since));
    return <TapChip>{t.rich("blockClicksSince", { count, date, bdi })}</TapChip>;
  }
  return <TapChip>{t.rich("blockClicks", { count, days: String(CHIP_DAYS), bdi })}</TapChip>;
}
