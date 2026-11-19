"use client";

import type { Block, Page } from "@linkyo/blocks";
import { toast } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";

import { accountStore, useAccount, useSignedIn } from "@/features/account/store";
import type { Account, AuthError, Result, Site } from "@/features/account/types";
import { editorReducer, initialEditorState, type EditorAction, type EditorDoc, type EditorState } from "@/features/directions/editor/state";
import { blockTitle } from "@/features/directions/editor/use-editor";

import { fetchLinkMetadata, metadataPatch, metadataUrl } from "./metadata";

type Profile = Page["profile"];

/** Everything on the page that undo/redo covers: profile, blocks and look. */
export interface SiteDoc extends EditorDoc {
  profile: Profile;
}

export type SiteAction = EditorAction | { type: "profile"; patch: Partial<Profile> } | { type: "replace"; doc: SiteDoc };

const HISTORY_LIMIT = 50;

export function siteReducer(state: EditorState<SiteDoc>, action: SiteAction): EditorState<SiteDoc> {
  if (action.type === "replace") {
    // Importing a page is one step in the history, so it can be undone like any edit.
    return { ...state, past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: action.doc, future: [], selectedId: null };
  }
  if (action.type === "profile") {
    const present = { ...state.present, profile: { ...state.present.profile, ...action.patch } };
    return { ...state, past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [] };
  }
  return editorReducer(state, action);
}

/** What the edit panel is working on: an existing block, or a new one that is added on save. */
export type Editing = { mode: "edit"; id: string } | { mode: "create"; block: Block; index?: number | undefined } | null;

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
  setAddOpen: (open: boolean) => void;
  addBlocks: (blocks: Block[], options?: { open?: boolean }) => void;
  /** Fills in title and picture of freshly added songs and videos from their platform. */
  enrich: (blocks: Block[]) => void;
  removeBlock: (block: Block) => void;
  label: (block: Block) => string;
  /** Where "open the page" goes: the creator's own page, or a prepared page in the team area. */
  previewHref: string;
  /** Saves a change still waiting for autosave right away (before exporting, for example). */
  flush: () => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) throw new Error("useSite() outside <SiteProvider>");
  return value;
}

const AUTOSAVE_DELAY = 400;

const toDoc = (site: Site): SiteDoc => ({ profile: site.page.profile, blocks: site.page.blocks, sizes: {}, theme: site.theme });

/** Stores the document; the address always comes from the account, never from an older draft. */
const writeDoc = (doc: SiteDoc) =>
  accountStore.updateSite((current) => ({
    ...current,
    page: { profile: { ...doc.profile, username: current.page.profile.username }, blocks: doc.blocks },
    theme: doc.theme,
  }));

/** The signed-in creator's own page, saved to their account. */
export function SiteProvider({ children }: { children: ReactNode }) {
  const { account, site } = useSignedIn();
  return (
    <EditorProvider account={account} site={site} write={writeDoc}>
      {children}
    </EditorProvider>
  );
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
  children,
}: {
  account: Account;
  site: Site;
  write: (doc: SiteDoc) => Result;
  previewHref?: string;
  children: ReactNode;
}) {
  const t = useTranslations("app");
  const tTypes = useTranslations("dashboard.types");
  const writeRef = useRef(write);
  useEffect(() => {
    writeRef.current = write;
  }, [write]);
  const [state, dispatch] = useReducer(siteReducer, site, (initial) => initialEditorState(toDoc(initial)));
  const doc = state.present;
  const [saved, setSaved] = useState<{ doc: SiteDoc; error: AuthError | null }>({ doc, error: null });
  // Real accounts: the store saves to the server in the background and reports how that went.
  const snapshot = useAccount();
  const sync = snapshot.status === "signedIn" ? snapshot.sync : undefined;
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<Block | null>(null);
  const [profileDraft, setProfileDraft] = useState<Profile | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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

  // ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo — everywhere except inside text fields and open panels.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (document.querySelector("[role=dialog]")) return;
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
  }, []);

  const label = useCallback((block: Block) => blockTitle(block, (type) => tTypes(type)), [tTypes]);

  // The latest document, for details that arrive after the block was added.
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const enrich = useCallback((blocks: Block[]) => {
    for (const added of blocks) {
      const url = metadataUrl(added);
      if (!url) continue;
      void fetchLinkMetadata(url).then((meta) => {
        const current = docRef.current.blocks.find((block) => block.id === added.id);
        const patch = meta && current ? metadataPatch(current, added, meta) : null;
        if (patch) dispatch({ type: "enrich", id: added.id, patch });
      });
    }
  }, []);

  const addBlocks = useCallback(
    (blocks: Block[], options: { open?: boolean } = {}) => {
      const insertAt = doc.blocks[0]?.type === "socials" ? 1 : 0;
      blocks.forEach((block, i) => dispatch({ type: "add", block, index: insertAt + i }));
      enrich(blocks);
      const first = blocks[0];
      if (!first) return;
      toast({
        title: blocks.length > 1 ? t("added.many", { count: blocks.length }) : t("added.one", { type: tTypes(first.type) }),
        tone: "success",
        ...(options.open === false ? {} : { action: { label: t("added.edit"), onAction: () => setEditing({ mode: "edit", id: first.id }) } }),
      });
    },
    [doc.blocks, enrich, t, tTypes],
  );

  const removeBlock = useCallback(
    (block: Block) => {
      dispatch({ type: "remove", id: block.id });
      toast({ title: t("removed", { title: label(block) }), action: { label: t("undo"), onAction: () => dispatch({ type: "undo" }) } });
    },
    [label, t],
  );

  const edit = useCallback((next: Editing) => {
    setEditing(next);
    setDraft(null);
  }, []);

  const previewPage = useMemo<Page>(() => {
    const profile = { ...(profileDraft ?? doc.profile), username: account.username };
    if (!draft) return { profile, blocks: doc.blocks };
    const exists = doc.blocks.some((block) => block.id === draft.id);
    if (exists) return { profile, blocks: doc.blocks.map((block) => (block.id === draft.id ? draft : block)) };
    const blocks = [...doc.blocks];
    const index = editing?.mode === "create" ? (editing.index ?? blocks.length) : blocks.length;
    blocks.splice(index, 0, draft);
    return { profile, blocks };
  }, [account.username, doc.blocks, doc.profile, draft, editing, profileDraft]);

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
    addOpen,
    setAddOpen,
    addBlocks,
    enrich,
    removeBlock,
    label,
    previewHref,
    flush,
  };
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
