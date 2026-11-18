"use client";

import { hasImage, type Block } from "@linkyo/blocks";
import { Badge, Button, cn, Icon, IconButton, Menu, Switch } from "@linkyo/ui";
import { ArrowDown, ArrowUp, CalendarClock, ChevronRight, Copy, GripVertical, Heading, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, UserRound } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";

import { SortableBlocks, blockIcon, useSortableRow } from "@/features/directions/editor/ui";
import { thumbSizes } from "@/features/directions/editor/use-dashboard";
import { blockSummary } from "@/features/directions/editor/use-editor";
import { selfTitle } from "@/features/directions/poster/sections";
import { platformName } from "@/features/directions/shared/creator-kit";
import { remoteImageProps, resolveMedia } from "@/features/directions/shared/media";

import { blankBlock } from "./blocks";
import { PreviewButton } from "./preview";
import { ProfileSheet } from "./profile-form";
import { Screen, UndoRedo } from "./screen";
import { ProfileAvatar } from "./shell";
import { useSite } from "./site-context";

/** ⌥↑ / ⌥↓ moves a row (brand §7: keyboard reordering). */
const reorderKey = (onMove: (delta: number) => void) => (event: KeyboardEvent<HTMLElement>) => {
  if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    onMove(event.key === "ArrowUp" ? -1 : 1);
  }
};

/**
 * The page, top to bottom, exactly as visitors see it: the profile, then sections and their blocks.
 * Tap a row to edit it, drag (or ⌥↑/⌥↓) to move it, switch it off to hide it.
 */
export function EditorScreen() {
  const t = useTranslations("app.editor");
  const { doc, dispatch, edit, setAddOpen, label } = useSite();
  const [profileOpen, setProfileOpen] = useState(false);

  const rows = doc.blocks.map((block, index) => {
    const opensSection = block.type === "header" || selfTitle(block) !== null;
    const nested = !opensSection && doc.blocks.slice(0, index).some((before) => before.type === "header" || selfTitle(before) !== null);
    return { block, opensSection, nested };
  });
  const moveBy = (id: string, delta: number) => {
    const index = doc.blocks.findIndex((block) => block.id === id);
    if (index >= 0) dispatch({ type: "move", id, to: index + delta });
  };
  const addSection = () => edit({ mode: "create", block: blankBlock("header", { artist: "", newsletter: "" }) });

  return (
    <Screen
      title={t("title")}
      lead={t("lead")}
      preview
      actions={
        <>
          <UndoRedo />
          <PreviewButton className="xl:hidden" />
        </>
      }
    >
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="group flex min-w-0 items-center gap-4 rounded-xl border border-line bg-surface p-4 text-start shadow-e1 transition-colors duration-micro hover:border-line-input focus-visible:focus-ring"
      >
        <ProfileAvatar size="lg" />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-body-lg font-semibold">{doc.profile.displayName}</span>
          <span className="truncate text-small text-fg-secondary">{[doc.profile.tagline, doc.profile.bio].find((text) => text?.trim()) ?? t("profileEmpty")}</span>
          <span className="flex items-center gap-1 text-caption font-medium text-link">
            <Icon icon={UserRound} size="sm" />
            {t("editProfile")}
          </span>
        </span>
        <Icon icon={ChevronRight} size="md" className="shrink-0 text-fg-tertiary rtl:-scale-x-100" />
      </button>

      <section aria-labelledby="blocks-title" className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="blocks-title" className="text-h3">
            {t("blocks")}
          </h2>
          <p className="text-small text-fg-secondary">{t("count", { count: doc.blocks.length })}</p>
        </div>

        {doc.blocks.length === 0 ? (
          <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-line-strong p-8 text-center">
            <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
              <Icon icon={Sparkles} size="lg" />
            </span>
            <div className="grid grid-cols-1 gap-1">
              <p className="text-body-lg font-semibold">{t("emptyTitle")}</p>
              <p className="max-w-prose text-small text-fg-secondary">{t("emptyBody")}</p>
            </div>
            <Button variant="primary" size="lg" icon={Plus} onClick={() => setAddOpen(true)}>
              {t("addFirst")}
            </Button>
          </div>
        ) : (
          <SortableBlocks blocks={doc.blocks} onMove={(id, to) => dispatch({ type: "move", id, to })} label={label} className="grid grid-cols-1 gap-2">
            {(block, index) => {
              const row = rows[index];
              return (
                <BlockRow
                  key={block.id}
                  block={block}
                  label={label(block)}
                  nested={row?.nested ?? false}
                  opensSection={row?.opensSection ?? false}
                  first={index === 0}
                  last={index === doc.blocks.length - 1}
                  onMove={(delta) => moveBy(block.id, delta)}
                />
              );
            }}
          </SortableBlocks>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
            {t("add")}
          </Button>
          <Button size="lg" icon={Heading} onClick={addSection}>
            {t("addSection")}
          </Button>
        </div>
        <p className="text-caption text-fg-tertiary">{t("tips")}</p>
      </section>
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </Screen>
  );
}

function Thumb({ block }: { block: Block }) {
  const image =
    block.type === "music"
      ? block.cover
      : block.type === "video"
        ? block.poster
        : block.type === "product" || block.type === "card" || block.type === "image"
          ? block.image
          : block.type === "link"
            ? block.thumbnail
            : block.type === "gallery"
              ? block.images[0]
              : undefined;
  if (hasImage(image)) {
    const resolved = resolveMedia(image.src);
    return (
      <span className="relative size-control-lg shrink-0 overflow-hidden rounded-md bg-canvas-muted">
        <Image src={resolved} alt="" fill sizes={thumbSizes} className="object-cover" {...remoteImageProps(resolved)} />
      </span>
    );
  }
  return (
    <span className="grid size-control-lg shrink-0 place-items-center rounded-md bg-canvas-muted text-fg-secondary">
      <Icon icon={blockIcon[block.type]} size="md" />
    </span>
  );
}

function BlockRow({
  block,
  label,
  nested,
  opensSection,
  first,
  last,
  onMove,
}: {
  block: Block;
  label: string;
  nested: boolean;
  opensSection: boolean;
  first: boolean;
  last: boolean;
  onMove: (delta: number) => void;
}) {
  const t = useTranslations("app.editor");
  const tTypes = useTranslations("dashboard.types");
  const { dispatch, edit, removeBlock } = useSite();
  const sortable = useSortableRow(block.id);
  const { rowRef, rowStyle, isDragging, handleProps, dndKeyDown } = sortable;
  const isHeader = block.type === "header";
  const summary = blockSummary(block, (platform) => platformName(platform as Parameters<typeof platformName>[0]));
  const scheduled = block.schedule?.from !== undefined || block.schedule?.until !== undefined;
  const onKey = reorderKey(onMove);

  return (
    <li
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group flex min-w-0 items-center gap-2 transition-[box-shadow,opacity,scale] duration-standard ease-standard",
        isHeader ? "rounded-lg pt-4 pe-1 pb-1" : "rounded-lg border border-line bg-surface p-2 pe-1 shadow-e1",
        nested && !isHeader && "ms-4 md:ms-6",
        opensSection && !isHeader && "mt-3",
        isDragging && "layer-raised relative scale-lift bg-surface shadow-e3",
        !block.visible && !isHeader && "border-dashed bg-canvas-muted shadow-none",
        !block.visible && isHeader && "opacity-secondary",
      )}
    >
      <button
        type="button"
        {...handleProps}
        onKeyDown={(event) => {
          onKey(event);
          if (!event.defaultPrevented) dndKeyDown(event);
        }}
        aria-label={t("drag", { title: label })}
        className="grid h-control-md w-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-fg-tertiary focus-visible:focus-ring active:cursor-grabbing pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
      >
        <Icon icon={GripVertical} size="sm" />
      </button>
      <button
        type="button"
        onClick={() => edit({ mode: "edit", id: block.id })}
        onKeyDown={onKey}
        aria-label={t("editItem", { title: label, type: tTypes(block.type) })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-start hover:bg-hover focus-visible:focus-ring"
      >
        {isHeader ? (
          <span className="grid size-control-md shrink-0 place-items-center rounded-md bg-selected text-selected-fg">
            <Icon icon={Heading} size="sm" />
          </span>
        ) : (
          <Thumb block={block} />
        )}
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className={cn("truncate", isHeader ? "text-h3" : opensSection ? "text-body font-semibold" : "text-body font-medium")}>{label}</span>
          {isHeader ? null : (
            <span className="flex min-w-0 items-center gap-2 text-small text-fg-secondary">
              {!block.visible ? <Badge size="sm">{t("hidden")}</Badge> : null}
              {block.highlight ? (
                <Badge tone="primary" size="sm">
                  {t("featured")}
                </Badge>
              ) : null}
              {scheduled ? <Icon icon={CalendarClock} size="sm" label={t("scheduled")} /> : null}
              {tTypes(block.type) !== label ? <span className="shrink-0">{tTypes(block.type)}</span> : null}
              {summary ? (
                <>
                  {tTypes(block.type) !== label ? <span aria-hidden>·</span> : null}
                  <span dir="auto" className="truncate">
                    {summary}
                  </span>
                </>
              ) : null}
            </span>
          )}
        </span>
      </button>
      <Switch checked={block.visible} onCheckedChange={() => dispatch({ type: "toggle", id: block.id })} label={t("visible", { title: label })} />
      <Menu
        trigger={<IconButton icon={MoreHorizontal} label={t("more", { title: label })} />}
        items={[
          { label: t("edit"), icon: Pencil, onSelect: () => edit({ mode: "edit", id: block.id }) },
          ...(first ? [] : [{ label: t("moveUp"), icon: ArrowUp, shortcut: "⌥↑", onSelect: () => onMove(-1) }]),
          ...(last ? [] : [{ label: t("moveDown"), icon: ArrowDown, shortcut: "⌥↓", onSelect: () => onMove(1) }]),
          { label: t("duplicate"), icon: Copy, onSelect: () => dispatch({ type: "duplicate", id: block.id }) },
          { label: t("delete"), icon: Trash2, destructive: true, onSelect: () => removeBlock(block) },
        ]}
      />
    </li>
  );
}
