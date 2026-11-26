"use client";

import type { Block, Page } from "@linkyo/blocks";
import { toast } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";

import { accountStore, registerPendingEdits, useAccount, useSignedIn } from "@/features/account/store";
import type { Account, AuthError, Result, Site } from "@/features/account/types";
import { editorReducer, initialEditorState, withDatedShows, type EditorAction, type EditorDoc, type EditorState } from "@/features/directions/editor/state";
import { blockTitle } from "@/features/directions/editor/use-editor";
import { isRtl } from "@/i18n/routing";

import { insertAt } from "./blocks";
import { fetchLinkMetadata, metadataPatch, metadataUrl } from "./metadata";

type Profile = Page["profile"];

/** Everything on the page that undo/redo covers: profile, blocks and look. */
export interface SiteDoc extends EditorDoc {
  profile: Profile;
}

export type SiteAction =
  | EditorAction
  | { type: "profile"; patch: Partial<Profile> }
  | { type: "replace"; doc: SiteDoc }
  /** Several blocks at once (a pasted list of links): one step in the history, so one undo takes them all back. */
  | { type: "addMany"; blocks: Block[]; index: number }
  /** Takes several blocks off the page in one step (the Undo of an `addMany`). */
  | { type: "removeIds"; ids: string[] }
  /** The store replaced the page with a newer version from elsewhere: start over from it, with nothing to undo. */
  | { type: "reset"; doc: SiteDoc };

const HISTORY_LIMIT = 50;

/** One more step in the history: what was there before goes into `past`, and redo starts over. */
const step = (state: EditorState<SiteDoc>, present: SiteDoc, selectedId = state.selectedId): EditorState<SiteDoc> => ({
  past: [...state.past, state.present].slice(-HISTORY_LIMIT),
  present,
  future: [],
  selectedId,
});

export function siteReducer(state: EditorState<SiteDoc>, action: SiteAction): EditorState<SiteDoc> {
  if (action.type === "reset") return initialEditorState(action.doc);
  if (action.type === "addMany") {
    const first = action.blocks[0];
    if (!first) return state;
    // The same insert as a single "add", block after block, but written to the history only once.
    const present = action.blocks.reduce((doc, block, i) => editorReducer({ ...state, present: doc }, { type: "add", block, index: action.index + i }).present, state.present);
    return step(state, present, first.id);
  }
  if (action.type === "removeIds") {
    const ids = new Set(action.ids);
    const blocks = state.present.blocks.filter((block) => !ids.has(block.id));
    if (blocks.length === state.present.blocks.length) return state;
    return step(state, { ...state.present, blocks }, state.selectedId !== null && ids.has(state.selectedId) ? null : state.selectedId);
  }
  if (action.type === "replace") {
    // Importing a page is one step in the history, so it can be undone like any edit.
    return { ...state, past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: action.doc, future: [], selectedId: null };
  }
  if (action.type === "profile") {
    // Which texts came from an AI draft stays as it is: an edit keeps it listed (the text started as
    // AI output); only applying a new draft or proposal (`replace`) changes the list.
    const { aiFields: _kept, ...patch } = action.patch;
    const present = { ...state.present, profile: { ...state.present.profile, ...patch } };
    return { ...state, past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [] };
  }
  if (action.type === "update" && state.present.blocks.find((block) => block.id === action.id)?.origin === "ai") {
    // A block the AI wrote becomes "ai-edited" once its owner changes it (its provenance stays known).
    return editorReducer(state, { ...action, patch: { ...action.patch, origin: "ai-edited" } });
  }
  return editorReducer(state, action);
}

/**
 * What the edit panel is working on: an existing block, or a new one that is added on save. A new
 * block picked in the Add sheet is filled in right there (its second step), not in the edit sheet.
 */
export type Editing = { mode: "edit"; id: string } | { mode: "create"; block: Block; index?: number | undefined; inAddSheet?: boolean } | null;

export type SaveState = "saved" | "saving" | AuthError;

interface SiteContextValue {
  account: Account;
  site: Site;
  doc: SiteDoc;
  dispatch: (action: SiteAction) => void;
  canUndo: boolean;
  canRedo: boolean;
  save: SaveState;
  /** The page as visitors see it, including unsaved edits from the open edit panel. */
  previewPage: Page;
  editing: Editing;
  edit: (editing: Editing) => void;
  /** Live draft of the block in the edit panel (drives the preview while typing). */
  setDraft: (block: Block | null) => void;
  /** Live draft of the profile form (name, bio, photos), shown in the preview before saving. */
  setProfileDraft: (profile: Profile | null) => void;
  addOpen: boolean;
  /** Opens the Add sheet; with `index`, what is added goes there (the row menu's "Add below"). */
  setAddOpen: (open: boolean, index?: number) => void;
  /** Where the open Add sheet puts new blocks; undefined means the usual place (see `insertAt`). */
  addIndex: number | undefined;
  addBlocks: (blocks: Block[], options?: { open?: boolean; index?: number | undefined }) => void;
  /** Fills in title and picture of freshly added songs and videos from their platform. */
  enrich: (blocks: Block[]) => void;
  removeBlock: (block: Block) => void;
  /** The block added last (pasted, picked or restored), until the next change: the editor marks and shows it. */
  justAdded: string | null;
  /** Reads a short message out to screen readers (a move, a duplicate, undo and redo). */
  announce: (text: string) => void;
  label: (block: Block) => string;
  /** Where "open the page" goes: the creator's own page, or a prepared page in the team area. */
  previewHref: string;
  /** Saves a change still waiting for autosave right away (before exporting, for example). */
  flush: () => void;
  /**
   * The document as it is now. `doc` is the one of the last render: a toast's Undo runs later, maybe
   * after more changes or on another screen, and checks with this that its change is still the last.
   */
  latest: () => SiteDoc;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) throw new Error("useSite() outside <SiteProvider>");
  return value;
}

const AUTOSAVE_DELAY = 400;

/** Letters of right-to-left scripts (Hebrew, Arabic and their extensions and presentation forms). */
const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * A creator's text inside one of our sentences, wrapped in first-strong isolates (FSI … PDI) wherever
 * its direction can differ from the sentence. Otherwise "Big Buck Bunny – Short Film" in an Arabic
 * toast drags the quotation marks to the wrong side and splits the title. Latin text in a German or
 * English sentence needs nothing, so it stays exactly as typed.
 */
const isolate = (text: string, rtl: boolean): string => (rtl || RTL_LETTER.test(text) ? `\u2068${text}\u2069` : text);

const toDoc = (site: Site): SiteDoc => ({ profile: site.page.profile, blocks: site.page.blocks, sizes: {}, theme: site.theme });

/** Stores the document; the address always comes from the account, never from an older draft. */
const writeDoc = (doc: SiteDoc) =>
  accountStore.updateSite((current) => ({
    ...current,
    page: { profile: { ...doc.profile, username: current.page.profile.username }, blocks: doc.blocks },
    theme: doc.theme,
  }));

/** How often the store has replaced the page from the server so far (`AccountSnapshot.revision`). */
const storeRevision = () => {
  const now = accountStore.getSnapshot();
  return now.status === "signedIn" ? (now.revision ?? 0) : 0;
};

/** The signed-in creator's own page, saved to their account. */
export function SiteProvider({ children }: { children: ReactNode }) {
  const { account, site } = useSignedIn();
  const snapshot = useAccount();
  const revision = snapshot.status === "signedIn" ? (snapshot.revision ?? 0) : 0;
  const conflicts = snapshot.status === "signedIn" ? (snapshot.conflicts ?? 0) : 0;
  // A change made on a page the store has since replaced (a newer version from elsewhere, ADR
  // draft-app-sync) is never written over it: the editor starts over from the newer one instead.
  const write = useCallback((doc: SiteDoc): Result => (storeRevision() === revision ? writeDoc(doc) : { ok: true }), [revision]);
  return (
    <EditorProvider account={account} site={site} write={write} revision={revision} conflicts={conflicts}>
      <PendingEdits />
      {children}
    </EditorProvider>
  );
}

/** Hands the editor's waiting change to the store whenever everything must be saved now (the iPhone app's `flush`). */
function PendingEdits() {
  const { flush } = useSite();
  useEffect(() => registerPendingEdits(flush), [flush]);
  return null;
}

/**
 * One editor for the whole dashboard. Every screen (home checklist, page, design, profile) edits the
 * same document, so one undo history covers everything, and changes autosave a moment later.
 * `write` decides where it is saved: the creator's account, or (in the team area) a prepared page.
 */
export function EditorProvider({
  account,
  site,
  write,
  previewHref = "/app/preview",
  revision,
  conflicts = 0,
  children,
}: {
  account: Account;
  site: Site;
  write: (doc: SiteDoc) => Result;
  previewHref?: string;
  /** The creator's own page: changes when the store replaced `site` with a newer version from the server. */
  revision?: number | undefined;
  /** The creator's own page: how many saves were refused because the page changed elsewhere. */
  conflicts?: number | undefined;
  children: ReactNode;
}) {
  const t = useTranslations("app");
  const tTypes = useTranslations("dashboard.types");
  const rtl = isRtl(useLocale());
  const writeRef = useRef(write);
  useEffect(() => {
    writeRef.current = write;
  }, [write]);
  const [state, reduce] = useReducer(siteReducer, site, (initial) => initialEditorState(toDoc(initial)));
  const doc = state.present;
  const [saved, setSaved] = useState<{ doc: SiteDoc; error: AuthError | null }>({ doc, error: null });
  // The store replaced the page with a newer version (another tab, the iPhone app): start over from
  // it while rendering, so no autosave of the replaced version can follow, and nothing to undo into it.
  const [seenRevision, setSeenRevision] = useState(revision);
  if (revision !== seenRevision) {
    setSeenRevision(revision);
    const fresh = toDoc(site);
    reduce({ type: "reset", doc: fresh });
    setSaved({ doc: fresh, error: null });
  }
  // A save was refused because the page had changed elsewhere: say that the newer version shows now.
  const seenConflicts = useRef(conflicts);
  useEffect(() => {
    if (conflicts <= seenConflicts.current) return;
    seenConflicts.current = conflicts;
    toast({ title: t("sync.conflict.title"), description: t("sync.conflict.body") });
  }, [conflicts, t]);
  // Real accounts: the store saves to the server in the background and reports how that went.
  const snapshot = useAccount();
  const sync = snapshot.status === "signedIn" ? snapshot.sync : undefined;
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<Block | null>(null);
  const [profileDraft, setProfileDraft] = useState<Profile | null>(null);
  const [add, setAdd] = useState<{ open: boolean; index?: number | undefined }>({ open: false });
  // Closing forgets the chosen place, so the next Add from the tab bar goes to the usual one.
  const setAddOpen = useCallback((open: boolean, index?: number) => setAdd(open ? { open, index } : { open: false }), []);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The same words twice in a row are still read out: a trailing no-break space makes them new.
  const announce = useCallback((text: string) => setAnnouncement((current) => (current === text ? `${text}\u00a0` : text)), []);

  // How much there is to undo and redo, so "Undone" is never announced when nothing changed, and
  // the document an undo brings back (its change's toasts go with it).
  const history = useRef<{ past: number; future: number; previous: SiteDoc | undefined }>({ past: 0, future: 0, previous: undefined });
  useEffect(() => {
    history.current = { past: state.past.length, future: state.future.length, previous: state.past.at(-1) };
  }, [state.past, state.future.length]);

  /**
   * Every change goes through here, wherever it comes from (a button, ⌘Z, the edit sheet, a toast).
   * It remembers the block that was just added, so the editor can mark it and scroll to it, and it
   * tells screen readers when something was undone or redone (otherwise the page changes silently).
   */
  const dispatch = useCallback(
    (action: SiteAction) => {
      // An undone change takes its own toast away: its Undo or Edit would now act on a page that has
      // moved on (⌘Z after "Link added · Edit" leaves nothing to edit). Other toasts stay: a removed
      // block's Undo still puts that block back. Any other change closes the toasts whose action is a
      // plain "undo the last change" (it would now undo that change instead).
      const { previous } = history.current;
      if (action.type === "undo" && history.current.past > 0 && previous) toast.settle({ undone: previous });
      else if (action.type !== "undo" && action.type !== "select" && action.type !== "enrich") toast.settle({ moved: true });
      if (action.type === "undo" && history.current.past > 0) announce(t("editor.undone"));
      if (action.type === "redo" && history.current.future > 0) announce(t("editor.redone"));
      reduce(action);
      // Details filled in later (enrich) belong to the same addition; any other change ends it.
      if (action.type === "add") setJustAdded(action.block.id);
      else if (action.type === "addMany") setJustAdded(action.blocks[0]?.id ?? null);
      else if (action.type !== "enrich") setJustAdded(null);
    },
    [announce, t],
  );

  // Autosave: write the document shortly after the last change (the address always comes from the account).
  const pending = useRef<SiteDoc | null>(null);
  useEffect(() => {
    if (doc === saved.doc) {
      pending.current = null;
      return;
    }
    pending.current = doc;
    const timer = window.setTimeout(() => {
      pending.current = null;
      const result = writeRef.current(doc);
      setSaved({ doc, error: result.ok ? null : result.error });
      if (!result.ok) toast({ title: t(`errors.${result.error}`), tone: "danger" });
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [doc, saved.doc, t]);

  const flush = useCallback(() => {
    const waiting = pending.current;
    if (!waiting) return;
    pending.current = null;
    const result = writeRef.current(waiting);
    setSaved({ doc: waiting, error: result.ok ? null : result.error });
  }, []);

  // Leaving, switching apps or closing the tab never loses the last change: write it right away.
  useEffect(() => {
    const flush = () => {
      if (pending.current) writeRef.current(pending.current);
      pending.current = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo — everywhere except inside text fields (they undo their own
  // typing), open panels (a panel that is sliding away no longer counts) and confirmation dialogs
  // (undoing behind "Delete?" would change what the question is about). A select has no undo of its
  // own and keeps focus after a choice, so a page language just picked in Settings is undone at once.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName))) return;
      if (document.querySelector("[role=dialog]:not([data-state=closed]), [role=alertdialog]")) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const label = useCallback((block: Block) => blockTitle(block, (type) => tTypes(type)), [tTypes]);

  // The latest document, for details that arrive after the block was added.
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const latest = useCallback(() => docRef.current, []);
  const enrich = useCallback(
    (blocks: Block[]) => {
      for (const added of blocks) {
        const url = metadataUrl(added);
        if (!url) continue;
        void fetchLinkMetadata(url).then((meta) => {
          const current = docRef.current.blocks.find((block) => block.id === added.id);
          const patch = meta && current ? metadataPatch(current, added, meta) : null;
          if (patch) dispatch({ type: "enrich", id: added.id, patch });
        });
      }
    },
    [dispatch],
  );

  const addBlocks = useCallback(
    (blocks: Block[], options: { open?: boolean; index?: number | undefined } = {}) => {
      const first = blocks[0];
      if (!first) return;
      // The document this change is made from: an undo that brings it back closes the toast.
      const before = docRef.current;
      dispatch({ type: "addMany", blocks, index: options.index ?? insertAt(doc.blocks) });
      enrich(blocks);
      const ids = blocks.map((block) => block.id);
      // Several blocks: "Edit" would open only the first one, so the toast offers to take them all back.
      const action =
        blocks.length > 1
          ? { label: t("undo"), onAction: () => dispatch({ type: "removeIds", ids }) }
          : options.open === false
            ? undefined
            : { label: t("added.edit"), onAction: () => setEditing({ mode: "edit", id: first.id }) };
      toast({
        title: blocks.length > 1 ? t("added.many", { count: blocks.length }) : t("added.one", { type: tTypes(first.type) }),
        tone: "success",
        undoable: { before },
        ...(action ? { action } : {}),
      });
    },
    [dispatch, doc.blocks, enrich, t, tTypes],
  );

  const removeBlock = useCallback(
    (block: Block) => {
      const index = doc.blocks.findIndex((candidate) => candidate.id === block.id);
      const next = doc.blocks[index + 1]?.id;
      const before = docRef.current;
      dispatch({ type: "remove", id: block.id });
      // Undo puts this block back where it was (before the block that followed it, if that is still
      // there), and only once. A plain "undo" could take back a later change instead (a switch
      // flipped while the toast was still showing).
      toast({
        title: t("removed", { title: isolate(label(block), rtl) }),
        undoable: { before },
        action: {
          label: t("undo"),
          onAction: () => {
            const blocks = docRef.current.blocks;
            if (blocks.some((candidate) => candidate.id === block.id)) return;
            const before = next ? blocks.findIndex((candidate) => candidate.id === next) : -1;
            dispatch({ type: "add", block, index: before >= 0 ? before : Math.min(Math.max(index, 0), blocks.length) });
          },
        },
      });
    },
    [dispatch, doc.blocks, label, rtl, t],
  );

  const edit = useCallback((next: Editing) => {
    setEditing(next);
    setDraft(null);
  }, []);

  // Where a new block will go: the only thing the preview needs from the edit panel (opening or closing
  // a panel does not redraw the page on its own).
  const createIndex = editing?.mode === "create" ? editing.index : undefined;
  // A show without a date stays off the page until it has one (a pasted ticket link opens the form
  // with the date empty): the preview never shows a show that is not there yet, or a made-up day.
  const previewPage = useMemo<Page>(() => {
    const profile = { ...(profileDraft ?? doc.profile), username: account.username };
    const shown = draft ? withDatedShows(draft) : null;
    if (!draft) return { profile, blocks: doc.blocks };
    const exists = doc.blocks.some((block) => block.id === draft.id);
    if (exists) return { profile, blocks: doc.blocks.flatMap((block) => (block.id !== draft.id ? [block] : shown ? [shown] : [])) };
    if (!shown) return { profile, blocks: doc.blocks };
    const blocks = [...doc.blocks];
    blocks.splice(createIndex ?? blocks.length, 0, shown);
    return { profile, blocks };
  }, [account.username, createIndex, doc.blocks, doc.profile, draft, profileDraft]);

  const value: SiteContextValue = {
    account,
    site,
    doc,
    dispatch,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    save: saved.error ?? (doc !== saved.doc || sync === "saving" ? "saving" : sync === "error" ? "serverError" : "saved"),
    previewPage,
    editing,
    edit,
    setDraft,
    setProfileDraft,
    addOpen: add.open,
    setAddOpen,
    addIndex: add.index,
    addBlocks,
    enrich,
    removeBlock,
    justAdded,
    announce,
    label,
    previewHref,
    flush,
    latest,
  };
  return (
    <SiteContext.Provider value={value}>
      {children}
      {/* One polite live region for the whole dashboard: moves, duplicates, undo and redo. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </SiteContext.Provider>
  );
}
