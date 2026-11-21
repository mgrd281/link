"use client";

import { hasImage, type Block } from "@linkyo/blocks";
import { Badge, Button, cn, Icon, IconButton, Menu, Switch, Tooltip } from "@linkyo/ui";
import { ArrowDown, ArrowUp, CalendarClock, ChevronRight, CopyPlus, GripVertical, Heading, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

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
import { Screen, UndoRedo, useShellChrome } from "./screen";
import { ProfileAvatar } from "./shell";
import { useSite } from "./site-context";
import { useFlip } from "./use-flip";

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
 * gets in the way of a tap or a scroll). Rows glide to their new place.
 *
 * In the dashboard (the shell) the rows read as iOS grouped lists at every width: one group per
 * section on the tinted ground, inset hairlines between rows, section titles as group headers. The
 * team area shows the same editor with its own title, as outlined cards.
 */
export function EditorScreen({ title, lead }: { title?: string; lead?: string } = {}) {
  const t = useTranslations("app.editor");
  const tNav = useTranslations("app.nav");
  const tDash = useTranslations("dashboard");
  const inShell = useShellChrome();
  const { doc, dispatch, edit, setAddOpen, label, announce, justAdded } = useSite();
  const [profileOpen, setProfileOpen] = useState(false);
  const [reorder, setReorder] = useState(false);
  // Reordering needs two rows; when fewer are left, the list goes back to normal (and stays there).
  if (reorder && doc.blocks.length < 2) setReorder(false);
  const arranging = reorder && doc.blocks.length > 1;
  const last = doc.blocks.length - 1;
  const empty = doc.blocks.length === 0;

  // A drop with the mouse is animated by the drag itself; every other move glides here.
  const dropped = useRef(false);
  useFlip(
    doc.blocks.map((block) => block.id),
    () => {
      const was = dropped.current;
      dropped.current = false;
      return was;
    },
  );

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

  // The chevron already says "open": the words "Edit profile" are only for screen readers.
  const profile = (
    <button
      type="button"
      onClick={() => setProfileOpen(true)}
      className={cn(
        "group flex w-full min-w-0 items-center gap-4 rounded-lg p-4 text-start focus-visible:focus-ring",
        inShell
          ? "transition-colors duration-micro hover:bg-hover active:bg-pressed"
          : "border border-line bg-surface transition-[border-color,scale] duration-micro hover:border-line-input active:scale-pressed motion-reduce:active:scale-none",
      )}
    >
      <ProfileAvatar size="lg" />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="sr-only">{t("editProfile")}: </span>
        {/* In their own direction (so a long Latin bio is cut at its end, also in Arabic), but aligned
            with the interface: a Latin name in an Arabic row still hugs the photo. */}
        <span dir="auto" className="truncate text-left text-body-lg font-semibold [[dir=rtl]_&]:text-right">
          {doc.profile.displayName}
        </span>
        <span dir="auto" className="truncate text-left text-small text-fg-secondary [[dir=rtl]_&]:text-right">
          {[doc.profile.tagline, doc.profile.bio].find((text) => text?.trim()) ?? t("profileEmpty")}
        </span>
      </span>
      <Icon icon={ChevronRight} size="md" className="shrink-0 text-fg-tertiary rtl:-scale-x-100" />
    </button>
  );

  return (
    <Screen
      title={title ?? t("title")}
      lead={lead}
      preview
      actions={
        <>
          <UndoRedo />
          {/* In the dashboard the page shows beside the list from the desk width, and phones have the
              top bar's eye; the team area shows its own column from xl. */}
          <PreviewButton className={inShell ? "hidden lg:inline-grid desk:hidden" : "xl:hidden"} />
        </>
      }
    >
      {inShell ? <div className="rounded-lg bg-group lg:border lg:border-line">{profile}</div> : profile}

      <section aria-labelledby="blocks-title" className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Focus lands here when the last row is deleted, so it is never lost to the top of the page. */}
          <h2 id="blocks-title" tabIndex={-1} className="flex-1 text-title outline-none rtl:tracking-normal">
            {t("blocks")}
          </h2>
          {empty ? null : <p className="text-small text-fg-secondary">{t("count", { count: doc.blocks.length })}</p>}
          {/* "Reorder" and "Done" name the state themselves, as in iOS lists, so no pressed state on top. */}
          {doc.blocks.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setReorder(!arranging)}>
              {arranging ? t("reorderDone") : t("reorder")}
            </Button>
          ) : null}
        </div>

        {empty ? (
          <div className="grid justify-items-center gap-4 rounded-lg border border-dashed border-line-strong p-8 text-center">
            <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
              <Icon icon={Sparkles} size="lg" />
            </span>
            <div className="grid grid-cols-1 gap-1">
              <p className="text-title rtl:tracking-normal">{t("emptyTitle")}</p>
              <p className="max-w-prose text-small font-regular text-fg-secondary">{t("emptyBody")}</p>
            </div>
            <Button variant="primary" size="cta" icon={Plus} onClick={() => setAddOpen(true)}>
              {t("addFirst")}
            </Button>
          </div>
        ) : (
          <SortableBlocks
            blocks={doc.blocks}
            onMove={(id, to) => {
              dropped.current = true;
              dispatch({ type: "move", id, to });
            }}
            label={label}
            className={cn("relative grid grid-cols-1", !inShell && "gap-2")}
          >
            {(block, index) => {
              const row = rows[index];
              return (
                <BlockRow
                  key={block.id}
                  block={block}
                  label={label(block)}
                  index={index}
                  inShell={inShell}
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

        {arranging ? (
          <p className="text-small font-regular text-fg-secondary">{t("reorderHint")}</p>
        ) : inShell ? (
          // Adding content has its own door (the sidebar, the tab bar); a section is added here.
          empty ? null : (
            <Button variant="ghost" icon={Heading} className="justify-self-start" onClick={addSection}>
              {t("addSection")}
            </Button>
          )
        ) : (
          // The team area has no Add elsewhere: both stay here, side by side where both labels fit.
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button size="lg" variant="tinted" icon={Plus} onClick={() => setAddOpen(true)}>
              {tNav("add")}
            </Button>
            <Button size="lg" variant="ghost" icon={Heading} onClick={addSection}>
              {t("addSection")}
            </Button>
          </div>
        )}
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

/** Row radius in a grouped list: round only at the ends of a group (a section). */
const groupRadius = (start: boolean, end: boolean) => (start && end ? "rounded-lg" : start ? "rounded-t-lg" : end ? "rounded-b-lg" : null);

function BlockRow({
  block,
  label,
  index,
  inShell,
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
  /** In the dashboard: grouped rows. Outside it (the team area): outlined cards. */
  inShell: boolean;
  nested: boolean;
  opensSection: boolean;
  /** First and last row of its group (a section): round corners there, an inset hairline between. */
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
  const typeName = tTypes(block.type);

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

  // Outside Reorder mode the grip is for the mouse only (keyboards have ⌥↑/⌥↓ on the row and the ⋯
  // menu), so it is no extra tab stop. In the dashboard it sits in the row's start padding, so the
  // thumbnails line up with the profile photo.
  const grip = (
    <Tooltip content={t("gripTip")} shortcut="⌥↑ ⌥↓">
      <button
        type="button"
        {...handleProps}
        tabIndex={arranging ? 0 : -1}
        onKeyDown={(event) => {
          onKey(event);
          if (!event.defaultPrevented) dndKeyDown(event);
        }}
        aria-label={t("drag", { title: label })}
        className={cn(
          "grid h-control-md shrink-0 cursor-grab touch-none place-items-center rounded-sm layer-raised focus-visible:focus-ring active:cursor-grabbing",
          arranging
            ? "relative w-10 text-fg-secondary"
            : cn(
                // Touch screens move rows in Reorder mode; with a mouse the grip shows on hover.
                "text-fg-tertiary pointer-coarse:hidden pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100",
                inShell ? "absolute inset-y-0 start-0 my-auto w-4" : "relative w-6",
              ),
        )}
      >
        <Icon icon={GripVertical} size={arranging ? "md" : "sm"} />
      </button>
    </Tooltip>
  );

  // The edit button holds only the title, so its name ("Edit Book me (Link)") contains everything it
  // shows (WCAG 2.5.3). It stretches over the whole row: tap anywhere but the switch and the ⋯ menu.
  const editButton = (
    <button
      type="button"
      data-row-edit
      onClick={() => edit({ mode: "edit", id: block.id })}
      onKeyDown={onKey}
      aria-label={t("editItem", { title: label, type: typeName })}
      aria-describedby={isHeader ? undefined : metaId}
      className={cn(
        "min-w-0 select-none rounded-[inherit] text-start focus-visible:outline-none",
        "after:absolute after:inset-0 after:rounded-[inherit] after:transition-colors after:duration-micro",
        "group-hover:after:bg-hover active:after:bg-pressed focus-visible:after:focus-field",
      )}
    >
      {/* Two lines before it is cut; isolated, so a Latin title in an Arabic row keeps its own order. */}
      <span
        className={cn(
          "line-clamp-2 break-words text-start",
          isHeader
            ? inShell
              ? // A section title reads as a group header. Hidden: a lighter grey, not a fainter one (contrast).
                cn("text-small font-semibold", block.visible ? "text-fg-secondary" : "text-fg-tertiary")
              : cn("text-body-lg font-semibold", dim)
            : cn("text-body leading-snug", opensSection ? "font-semibold" : "font-medium", dim),
        )}
      >
        <bdi>{label}</bdi>
      </span>
    </button>
  );

  const controls = arranging ? (
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
        className="layer-raised"
      />
      <Menu
        trigger={<IconButton icon={MoreHorizontal} label={t("more", { title: label })} className="layer-raised" />}
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
  );

  if (isHeader) {
    return (
      <li
        ref={rowRef}
        style={rowStyle}
        data-row={block.id}
        className={cn(
          "group relative flex min-w-0 items-center gap-3 transition-[opacity,scale,background-color] duration-standard ease-standard",
          isDragging && "layer-raised scale-lift",
          // A section title, not a box: a group header in the dashboard.
          inShell ? "mt-6 rounded-sm ps-4 pe-2" : "mt-4 rounded-md py-1 pe-1",
        )}
      >
        {arranging ? null : grip}
        {inShell ? null : (
          <span className={cn("grid size-control-md shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg", dim)}>
            <Icon icon={Heading} size="md" />
          </span>
        )}
        <div className="grid min-w-0 flex-1 rounded-[inherit]">{editButton}</div>
        {controls}
      </li>
    );
  }

  return (
    <li
      ref={rowRef}
      style={rowStyle}
      data-row={block.id}
      className={cn(
        "group relative flex min-w-0 items-center gap-3 transition-[opacity,scale,background-color] duration-standard ease-standard",
        inShell
          ? cn(
              "min-h-control-xl py-2 ps-4 pe-2",
              isDragging
                ? "layer-raised scale-lift rounded-lg border border-primary bg-group"
                : cn(
                    isNew ? "bg-selected motion-safe:animate-pop-in" : "bg-group",
                    groupRadius(groupStart, groupEnd),
                    // Phones set the group apart by its fill alone; wide screens add a hairline around it.
                    "lg:border-x lg:border-line",
                    groupStart && "lg:border-t",
                    groupEnd && "lg:border-b",
                    // Inset hairline between rows, starting at the text as in iOS lists.
                    !groupStart && "before:absolute before:start-16 before:end-0 before:top-0 before:border-t before:border-line",
                  ),
            )
          : cn(
              "rounded-lg border p-2 pe-1",
              isNew ? "bg-selected motion-safe:animate-pop-in" : "bg-surface",
              isDragging ? "layer-raised scale-lift border-primary" : "border-line",
              nested && "ms-4 md:ms-6",
            ),
        opensSection && "mt-3",
      )}
    >
      {arranging ? null : grip}
      <Thumb block={block} />
      <div className="grid min-w-0 flex-1 gap-0.5 rounded-[inherit]">
        {editButton}
        {/* Not part of the button's name (it describes it): taps go through to the row. */}
        <span id={metaId} className="pointer-events-none flex min-w-0 items-center gap-2 text-small text-fg-secondary">
          {!block.visible ? <Badge size="sm">{t("hidden")}</Badge> : null}
          {block.highlight ? (
            <Badge tone="primary" size="sm">
              {t("featured")}
            </Badge>
          ) : null}
          {scheduled ? <Icon icon={CalendarClock} size="sm" label={t("scheduled")} /> : null}
          {typeName !== label ? <span className="shrink-0">{typeName}</span> : null}
          {summary ? (
            <>
              {typeName !== label ? <span aria-hidden>·</span> : null}
              <span dir="auto" className="truncate">
                {summary}
              </span>
            </>
          ) : null}
        </span>
      </div>
      {controls}
    </li>
  );
}
