"use client";

import { detectLink, detectMany, type Block, type BlockType } from "@linkyo/blocks";
import { toast } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";

import { blockFromDetection, editorReducer, initialEditorState, type EditorDoc } from "./state";

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function useEditor(initial: EditorDoc) {
  const t = useTranslations("dashboard");
  const tTypes = useTranslations("dashboard.types");
  const [state, dispatch] = useReducer(editorReducer, initial, initialEditorState);
  const doc = state.present;

  // ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo — everywhere except inside text fields.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
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

  const remove = useCallback(
    (block: Block) => {
      dispatch({ type: "remove", id: block.id });
      toast({
        title: t("deleted", { title: blockTitle(block, (type) => tTypes(type)) }),
        action: { label: t("undo"), onAction: () => dispatch({ type: "undo" }) },
      });
    },
    [t, tTypes],
  );

  const moveBy = useCallback(
    (id: string, delta: number) => {
      const index = doc.blocks.findIndex((block) => block.id === id);
      if (index < 0) return;
      dispatch({ type: "move", id, to: index + delta });
    },
    [doc.blocks],
  );

  return {
    state,
    doc,
    dispatch,
    remove,
    moveBy,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

export function blockTitle(block: Block, typeLabel: (type: BlockType) => string): string {
  switch (block.type) {
    case "socials":
    case "divider":
      return typeLabel(block.type);
    case "image":
      return block.image.alt || typeLabel("image");
    case "text":
      return block.text.slice(0, 48);
    case "live":
      return block.title ?? block.channel;
    case "gallery":
    case "events":
    case "shorts":
    case "brands":
      return block.title ?? typeLabel(block.type);
    default:
      return block.title;
  }
}

/** Universal Add: paste or type → smart detect → optimistic block (≤ 1 paste, < 5 s). */
export function useAddBar(onAdd: (blocks: Block[]) => void) {
  const t = useTranslations("dashboard");
  const tTypes = useTranslations("dashboard.types");
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const detection = useMemo(() => (value.trim() ? detectLink(value) : null), [value]);
  const labels = useMemo(() => ({ video: tTypes("video"), music: tTypes("music"), event: tTypes("events") }), [tTypes]);

  const addFromText = useCallback(
    (text: string) => {
      const detections = detectMany(text);
      if (detections.length === 0) {
        toast({ title: t("invalid"), tone: "danger" });
        return false;
      }
      const blocks = detections.map((d) => blockFromDetection(d, labels));
      onAdd(blocks);
      const first = blocks[0];
      if (first) {
        toast({
          title: detections.length > 1 ? t("addedShort", { type: `${detections.length}×` }) : t("added", { type: tTypes(first.type) }),
          tone: "success",
        });
      }
      setValue("");
      return true;
    },
    [labels, onAdd, t, tTypes],
  );

  // "N" focuses the add bar from anywhere (brand §5.1).
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const api = {
    value,
    detection,
    detectedLabel: detection ? tTypes(detection.type === "shorts" ? "link" : detection.type) : null,
    submit: () => addFromText(value),
    inputProps: {
      value,
      onChange: (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
      onPaste: (event: ClipboardEvent<HTMLInputElement>) => {
        const text = event.clipboardData.getData("text");
        // Pasting several links (or one link into an empty field) adds immediately.
        if (detectMany(text).length > 1 || (!value && detectLink(text))) {
          event.preventDefault();
          addFromText(text);
        }
      },
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addFromText(value);
        } else if (event.key === "Escape") {
          setValue("");
          event.currentTarget.blur();
        }
      },
    },
  };
  // The ref is returned separately so render code never reads it (React Compiler rule).
  return [inputRef, api] as const;
}

/** Files dropped anywhere on the editor become blocks (images → image blocks). */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      onFiles(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [onFiles]);
  return dragging;
}

const list = (items: string[], max = 3): string =>
  items.length > max ? `${items.slice(0, max).join(", ")} +${items.length - max}` : items.join(", ");

/** One-line summary for editor rows (language-neutral: URLs, names, places). */
export function blockSummary(block: Block, platformLabel: (platform: string) => string): string {
  switch (block.type) {
    case "socials":
      return list(block.items.map((item) => platformLabel(item.platform)));
    case "music":
      return `${block.artist} · ${list(block.links.map((link) => platformLabel(link.platform)), 2)}`;
    case "events":
      return list(block.items.map((item) => item.city));
    case "shorts":
      return list(block.items.map((item) => item.title), 1);
    case "gallery":
      return String(block.images.length);
    case "brands":
      return list(block.items.map((item) => item.name));
    case "newsletter":
      return block.description ?? "";
    case "text":
      return block.text;
    case "header":
    case "divider":
      return "";
    default:
      return "url" in block && block.url ? block.url.replace(/^(?:https?:\/\/|mailto:)/, "") : "";
  }
}
