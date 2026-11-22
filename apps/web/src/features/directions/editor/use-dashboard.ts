"use client";

import type { Block, Page } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { pageAddress } from "@/lib/page-url";

import type { EditorDoc } from "./state";
import { blockTitle, useAddBar, useEditor, useFileDrop } from "./use-editor";

/** `sizes` hint for 48 px thumbnails in editor rows. */
export const thumbSizes = `${tokens.size.controlLg}px`;

/** Everything a direction's dashboard needs: editor state, Universal Add, file drop, preview toggle. */
export function useDashboard(initial: EditorDoc, profile: Page["profile"]) {
  const tTypes = useTranslations("dashboard.types");
  const editor = useEditor(initial);
  const { doc, dispatch } = editor;
  const [previewOpen, setPreviewOpen] = useState(false);

  const insertAt = doc.blocks[0]?.type === "socials" ? 1 : 0;
  const addBlocks = useCallback(
    (blocks: Block[]) => {
      blocks.forEach((block, i) => dispatch({ type: "add", block, index: insertAt + i }));
    },
    [dispatch, insertAt],
  );
  const [addRef, add] = useAddBar(addBlocks);
  const dragging = useFileDrop(
    useCallback(
      (files: File[]) => {
        const images = files.filter((file) => file.type.startsWith("image/"));
        addBlocks(
          images.map((file, i) => ({
            id: `image-${Date.now().toString(36)}-${i}`,
            type: "image" as const,
            visible: true,
            highlight: false,
            image: { src: URL.createObjectURL(file), alt: file.name },
          })),
        );
      },
      [addBlocks],
    ),
  );

  const label = useCallback((block: Block) => blockTitle(block, (type) => tTypes(type)), [tTypes]);
  const page: Page = { profile, blocks: doc.blocks };
  const url = pageAddress(profile.username);

  const focusAdd = useCallback(() => addRef.current?.focus(), [addRef]);
  return { editor, doc, dispatch, add, addRef, focusAdd, addBlocks, dragging, previewOpen, setPreviewOpen, label, page, url };
}
