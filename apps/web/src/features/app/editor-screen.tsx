"use client";

import { hasImage, type Block } from "@linkyo/blocks";
import { Badge, Button, cn, Icon, IconButton, Menu, Switch } from "@linkyo/ui";
import { ArrowDown, ArrowUp, CalendarClock, ChevronRight, CopyPlus, GripVertical, Heading, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type KeyboardEvent } from "react";

import { SortableBlocks, blockIcon, useSortableRow } from "@/features/directions/editor/ui";
import { thumbSizes } from "@/features/directions/editor/use-dashboard";
import { blockSummary } from "@/features/directions/editor/use-editor";
import { selfTitle } from "@/features/directions/poster/sections";
import { PlatformGlyph, platformName } from "@/features/directions/shared/creator-kit";
import { LinkIconGlyph, linkGlyph } from "@/features/directions/shared/link-icons";
import { remoteImageProps, resolveMedia } from "@/features/directions/shared/media";
import { haptic } from "@/lib/haptics";

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
 * Tap a row to edit it, switch it off to hide it. Moving rows: drag the grip (with a mouse), ⌥↑/⌥↓,
 * the ⋯ menu, or "Reorder", which shows a grip on every row (the way iOS lists do it, so a drag never
 * gets in the way of a tap or a scroll).
 *
 * On phones the rows read as iOS grouped lists (the `max-lg:group-data-[grouped]/app:` classes, set by
 * the app shell): one white group per section on the grey background, with inset separators.
 */
export function EditorScreen({ title, lead }: { title?: string; lead?: string } = {}) {
  const t = useTranslations("app.editor");
  const tDash = useTranslations("dashboard");
  const { doc, dispatch, edit, setAddOpen, label, announce, justAdded } = useSite();
  const [profileOpen, setProfileOpen] = useState(false);
  const [reorder, setReorder] = useState(false);
  // Reordering needs two rows; when undo leaves fewer, the list goes back to normal by itself.
  const arranging = reorder && doc.blocks.length > 1;
  const last = doc.blocks.length - 1;

  const sections = doc.blocks.map((block, index) => {
    const opensSection = block.type === "header" || selfTitle(block) !== null;
    const nested = !opensSection && doc.blocks.slice(0, index).some((before) => before.type === "header" || selfTitle(before) !== null);
    return { block, opensSection, nested };
  });
  // A group runs from a section's start to the next one: its first and last rows get the round corners.
  const rows = sections.map((row, index) => {
    const before = sections[index - 1];
    const after = sections[index + 1];
    return {
      ...row,
      groupStart: !before || before.block.type === "header" || row.opensSection,
      groupEnd: !after || after.block.type === "header" || after.opensSection,
    };
  });

  const moveBy = (id: string, delta: number) => {
    const index = doc.blocks.findIndex((block) => block.id === id);
    const block = doc.blocks[index];
    const to = index + delta;
    // Already at the top or the bottom: nothing moves, and the history gets no empty step.
    if (!block || to < 0 || to > last) return;
    dispatch({ type: "move", id, to });
    announce(tDash("reorderAnnounce", { title: label(block), position: to + 1 }));
  };
  const addSection = () => edit({ mode: "create", block: blankBlock("header", { artist: "", newsletter: "" }) });

  return (
    <Screen
      title={title ?? t("title")}
      lead={lead ?? t("lead")}
      preview
      actions={
        <>
          <UndoRedo />
          <PreviewButton className="xl:hidden" />
        </>
      }
    >
      {/* The chevron already says "open": the words "Edit profile" are only for screen readers. */}
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="group flex min-w-0 items-center gap-4 rounded-lg border border-line bg-surface p-4 text-start transition-[border-color,scale] duration-micro hover:border-line-input focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none max-lg:group-data-[grouped]/app:border-transparent dark:max-lg:group-data-[grouped]/app:bg-surface-elevated"
      >
        <ProfileAvatar size="lg" />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="sr-only">{t("editProfile")}: </span>
          <span dir="auto" className="truncate text-body-lg font-semibold">
            {doc.profile.displayName}
          </span>
          <span dir="auto" className="truncate text-small text-fg-secondary">
            {[doc.profile.tagline, doc.profile.bio].find((text) => text?.trim()) ?? t("profileEmpty")}
          </span>
        </span>
        <Icon icon={ChevronRight} size="md" className="shrink-0 text-fg-tertiary rtl:-scale-x-100" />
      </button>

      <section aria-labelledby="blocks-title" className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Focus lands here when the last row is deleted, so it is never lost to the top of the page. */}
          <h2 id="blocks-title" tabIndex={-1} className="flex-1 text-body-lg font-semibold outline-none">
            {t("blocks")}
          </h2>
          <p className="text-small text-fg-secondary">{t("count", { count: doc.blocks.length })}</p>
          {/* "Reorder" and "Done" name the state themselves, as in iOS lists, so no pressed state on top. */}
          {doc.blocks.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setReorder(!arranging)}>
              {arranging ? t("reorderDone") : t("reorder")}
            </Button>
          ) : null}
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
            <Button variant="primary" size="cta" icon={Plus} onClick={() => setAddOpen(true)}>
              {t("addFirst")}
            </Button>
          </div>
        ) : (
          <SortableBlocks
            blocks={doc.blocks}
            onMove={(id, to) => dispatch({ type: "move", id, to })}
            label={label}
            className="grid grid-cols-1 gap-2 max-lg:group-data-[grouped]/app:gap-0"
          >
            {(block, index) => {
              const row = rows[index];
              return (
                <BlockRow
                  key={block.id}
                  block={block}
                  label={label(block)}
                  index={index}
                  nested={row?.nested ?? false}
                  opensSection={row?.opensSection ?? false}
                  groupStart={row?.groupStart ?? true}
                  groupEnd={row?.groupEnd ?? true}
                  first={index === 0}
                  last={index === last}
                  arranging={arranging}
                  isNew={justAdded === block.id}
                  onMove={(delta) => moveBy(block.id, delta)}
                />
              );
            }}
          </SortableBlocks>
        )}

        {/* Side by side where both labels fit; stacked on narrow phones. Out of the way while reordering. */}
        {arranging ? null : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button size="lg" variant="tinted" icon={Plus} onClick={() => setAddOpen(true)}>
              {t("add")}
            </Button>
            <Button size="lg" variant="ghost" icon={Heading} onClick={addSection}>
              {t("addSection")}
            </Button>
          </div>
        )}
        {/* Keyboard shortcuts only where there is a keyboard and a mouse; touch gets the touch tip. */}
        <p className="hidden text-caption text-fg-tertiary pointer-fine:block">{t("tips")}</p>
        <p className="text-caption text-fg-tertiary pointer-fine:hidden">{t("tipsTouch")}</p>
      </section>
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </Screen>
  );
}

/** What a block without its own picture shows: the platform when we know it, else the type's icon. */
function Glyph({ block }: { block: Block }) {
  if (block.type === "socials") {
    const platform = block.items[0]?.platform;
    if (platform) return <PlatformGlyph platform={platform} size="md" />;
  }
  if (block.type === "repo") return <PlatformGlyph platform="github" size="md" />;
  if (block.type === "link" || block.type === "card") {
    const glyph = linkGlyph(block.url, block.type === "link" ? block.icon : undefined);
    return glyph.kind === "platform" ? <PlatformGlyph platform={glyph.platform} size="md" /> : <LinkIconGlyph icon={glyph.icon} size="md" />;
  }
  return <Icon icon={blockIcon[block.type]} size="md" />;
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
  const dim = !block.visible && "opacity-secondary";
  if (hasImage(image)) {
    const resolved = resolveMedia(image.src);
    return (
      <span className={cn("relative size-control-md shrink-0 overflow-hidden rounded-sm bg-canvas-muted", dim)}>
        <Image src={resolved} alt="" fill sizes={thumbSizes} className="object-cover" {...remoteImageProps(resolved)} />
      </span>
    );
  }
  return (
    <span className={cn("grid size-control-md shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg", dim)}>
      <Glyph block={block} />
    </span>
  );
}

function BlockRow({
  block,
  label,
  index,
  nested,
  opensSection,
  groupStart,
  groupEnd,
  first,
  last,
  arranging,
  isNew,
  onMove,
}: {
  block: Block;
  label: string;
  index: number;
  nested: boolean;
  opensSection: boolean;
  /** First and last row of its group (a section): round corners there on phones, a separator between. */
  groupStart: boolean;
  groupEnd: boolean;
  first: boolean;
  last: boolean;
  /** Reorder mode: a grip on every row, and nothing else to tap by mistake. */
  arranging: boolean;
  /** Just added: marked until the next change, and scrolled into view. */
  isNew: boolean;
  onMove: (delta: number) => void;
}) {
  const t = useTranslations("app.editor");
  const tTypes = useTranslations("dashboard.types");
  const { dispatch, edit, removeBlock, setAddOpen, announce } = useSite();
  const sortable = useSortableRow(block.id);
  const { rowRef, rowStyle, isDragging, handleProps, dndKeyDown } = sortable;
  const metaId = useId();
  const isHeader = block.type === "header";
  const summary = blockSummary(block, (platform) => platformName(platform as Parameters<typeof platformName>[0]));
  const scheduled = block.schedule?.from !== undefined || block.schedule?.until !== undefined;
  const onKey = reorderKey(onMove);
  const dim = !block.visible && "opacity-secondary";

  // Show where a new block went, wherever it came from (the Add sheet, the edit sheet, an undone delete).
  // The sticky bars stay clear of it through the page's scroll padding.
  useEffect(() => {
    if (!isNew) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector(`[data-row="${CSS.escape(block.id)}"]`)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [isNew, block.id]);

  const remove = () => {
    // The menu's button goes away with the row, so focus moves on: to the next row, else the previous
    // one, else the list's heading. Found before the row is gone; focused once it is.
    const row = document.querySelector(`[data-row="${CSS.escape(block.id)}"]`);
    const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
    const target = neighbour?.querySelector<HTMLElement>("[data-row-edit]") ?? document.getElementById("blocks-title");
    removeBlock(block);
    requestAnimationFrame(() => target?.focus());
  };

  const grip = (
    <button
      type="button"
      {...handleProps}
      onKeyDown={(event) => {
        onKey(event);
        if (!event.defaultPrevented) dndKeyDown(event);
      }}
      aria-label={t("drag", { title: label })}
      className={cn(
        "grid h-control-md shrink-0 cursor-grab touch-none place-items-center rounded-sm focus-visible:focus-ring active:cursor-grabbing",
        arranging
          ? "w-10 text-fg-secondary"
          : // Touch screens move rows in Reorder mode; with a mouse the grip shows on hover.
            "w-6 text-fg-tertiary pointer-coarse:hidden pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100",
      )}
    >
      <Icon icon={GripVertical} size={arranging ? "md" : "sm"} />
    </button>
  );

  return (
    <li
      ref={rowRef}
      style={rowStyle}
      data-row={block.id}
      className={cn(
        "group relative flex min-w-0 items-center gap-2 transition-[opacity,scale,background-color] duration-standard ease-standard",
        isHeader
          ? // A section title, not a box. On phones it reads like an iOS group header.
            "pt-4 pe-1 pb-1 max-lg:group-data-[grouped]/app:pt-6 max-lg:group-data-[grouped]/app:ps-1"
          : cn(
              "rounded-lg border p-2 pe-1 max-lg:group-data-[grouped]/app:ps-3",
              isNew ? "bg-selected motion-safe:animate-pop-in" : "bg-surface dark:max-lg:group-data-[grouped]/app:bg-surface-elevated",
              isDragging
                ? "layer-raised scale-lift border-primary"
                : cn(
                    "border-line max-lg:group-data-[grouped]/app:border-transparent",
                    // Round corners only at the ends of a group.
                    groupStart && groupEnd
                      ? null
                      : groupStart
                        ? "max-lg:group-data-[grouped]/app:rounded-b-none"
                        : groupEnd
                          ? "max-lg:group-data-[grouped]/app:rounded-t-none"
                          : "max-lg:group-data-[grouped]/app:rounded-none",
                    // Inset separator, starting at the text as in iOS lists.
                    !groupStart &&
                      "max-lg:group-data-[grouped]/app:before:absolute max-lg:group-data-[grouped]/app:before:start-16 max-lg:group-data-[grouped]/app:before:end-0 max-lg:group-data-[grouped]/app:before:top-0 max-lg:group-data-[grouped]/app:before:border-t max-lg:group-data-[grouped]/app:before:border-line",
                  ),
              nested && "ms-4 md:ms-6 max-lg:group-data-[grouped]/app:ms-0",
              opensSection && "mt-3",
            ),
      )}
    >
      {arranging ? null : grip}
      <button
        type="button"
        data-row-edit
        onClick={() => edit({ mode: "edit", id: block.id })}
        onKeyDown={onKey}
        aria-label={t("editItem", { title: label, type: tTypes(block.type) })}
        aria-describedby={isHeader ? undefined : metaId}
        className="flex min-w-0 flex-1 select-none items-center gap-3 rounded-md p-1 text-start transition-colors duration-micro hover:bg-hover focus-visible:focus-ring active:bg-pressed"
      >
        {isHeader ? (
          <span className={cn("grid size-control-md shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg max-lg:group-data-[grouped]/app:hidden", dim)}>
            <Icon icon={Heading} size="md" />
          </span>
        ) : (
          <Thumb block={block} />
        )}
        <span className="grid min-w-0 flex-1 gap-0.5">
          {/* Two lines before it is cut, and in its own direction, so a Latin title in Arabic keeps its start. */}
          <span
            dir="auto"
            className={cn(
              "line-clamp-2 break-words",
              isHeader
                ? "text-body-lg font-semibold max-lg:group-data-[grouped]/app:text-small max-lg:group-data-[grouped]/app:text-fg-secondary"
                : opensSection
                  ? "text-body font-semibold"
                  : "text-body font-medium",
              dim,
            )}
          >
            {label}
          </span>
          {isHeader ? null : (
            <span id={metaId} className="flex min-w-0 items-center gap-2 text-small text-fg-secondary">
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
      {arranging ? (
        grip
      ) : (
        <>
          <Switch
            checked={block.visible}
            onCheckedChange={() => {
              haptic();
              dispatch({ type: "toggle", id: block.id });
            }}
            label={t("visible", { title: label })}
          />
          <Menu
            trigger={<IconButton icon={MoreHorizontal} label={t("more", { title: label })} />}
            items={[
              { label: t("edit"), icon: Pencil, onSelect: () => edit({ mode: "edit", id: block.id }) },
              { label: t("addBelow"), icon: Plus, onSelect: () => setAddOpen(true, index + 1) },
              ...(first ? [] : [{ label: t("moveUp"), icon: ArrowUp, shortcut: "⌥↑", onSelect: () => onMove(-1) }]),
              ...(last ? [] : [{ label: t("moveDown"), icon: ArrowDown, shortcut: "⌥↓", onSelect: () => onMove(1) }]),
              {
                label: t("duplicate"),
                icon: CopyPlus,
                onSelect: () => {
                  dispatch({ type: "duplicate", id: block.id });
                  announce(t("duplicated", { title: label }));
                },
              },
              { label: t("delete"), icon: Trash2, destructive: true, onSelect: remove },
            ]}
          />
        </>
      )}
    </li>
  );
}
