"use client";

import type { Block, BlockType, Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { Badge, Button, cn, Icon, IconButton, Kbd, Logo, Menu, Switch, toast } from "@linkyo/ui";
import { ArrowDown, ArrowUp, Copy, Eye, GripVertical, MoreHorizontal, Plus, Share2, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";

import { copyText } from "@/lib/clipboard";

import { resolveMedia } from "../shared/media";
import { blockIcon, AddTypeChips, CommandPalette, DropOverlay, SidebarNav, SortableBlocks, sampleClicks, useSortableRow, WorkspaceBadge } from "../editor/ui";
import { PreviewPane } from "../editor/preview-pane";
import type { EditorDoc } from "../editor/state";
import { thumbSizes, useDashboard } from "../editor/use-dashboard";
import { blockSummary } from "../editor/use-editor";
import { platformName } from "../shared/creator-kit";

/** Direction A — "Gallery" dashboard: airy three-pane editor, large cards, inline editing. */
export function GalleryDashboard({ initial, profile, pageHref }: { initial: EditorDoc; profile: Page["profile"]; pageHref: string }) {
  const t = useTranslations("dashboard");
  const tTypes = useTranslations("dashboard.types");
  const { editor, doc, dispatch, add, addRef, focusAdd, dragging, previewOpen, setPreviewOpen, label, page, url } = useDashboard(initial, profile);

  return (
    <div className="flex min-h-dvh bg-canvas text-fg">
      <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col gap-6 border-e border-line bg-canvas-muted p-4 lg:flex">
        <div className="px-1 pt-1">
          <Logo className="h-6" />
        </div>
        <WorkspaceBadge name={profile.displayName} url={url} />
        <SidebarNav />
        <div className="mt-auto grid gap-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-small font-semibold">{t("plan")}</p>
          <Button size="sm" icon={Sparkles} block>
            {t("upgrade")}
          </Button>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto grid max-w-content gap-8 px-5 py-8 lg:px-10">
          <header className="flex flex-wrap items-center gap-3">
            <div className="grid w-full min-w-0 gap-1 sm:w-auto sm:flex-1">
              <h1 className="text-h2">{t("pageTitle")}</h1>
              <p className="flex items-center gap-2 text-small text-fg-secondary">
                <Badge tone="success" dot size="sm">
                  {t("live")}
                </Badge>
                <span className="truncate font-mono">{url}</span>
              </p>
            </div>
            <Button variant="ghost" icon={Eye} onClick={() => setPreviewOpen(true)} className="xl:hidden">
              {t("openPreview")}
            </Button>
            <Button
              icon={Share2}
              onClick={() => {
                void copyText(`https://${url}`);
                toast({ title: t("copied"), tone: "success" });
              }}
            >
              {t("share")}
            </Button>
            <Button variant="primary" icon={Plus} trailing={<Kbd className="border-primary-fg bg-transparent text-primary-fg">N</Kbd>} onClick={focusAdd}>
              {t("add")}
            </Button>
          </header>

          <section aria-label={t("addLabel")} className="grid gap-4 rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center gap-3 rounded-lg border border-line-input bg-surface-elevated px-4 focus-within:border-focus focus-within:focus-ring">
              <Icon icon={Plus} size="md" className="text-fg-tertiary" />
              <label className="sr-only" htmlFor="gallery-add">
                {t("addLabel")}
              </label>
              <input
                id="gallery-add"
                ref={addRef}
                {...add.inputProps}
                placeholder={t("addPlaceholder")}
                autoComplete="off"
                className="h-control-xl min-w-0 flex-1 bg-transparent text-body-lg outline-none placeholder:text-fg-tertiary"
              />
              {add.detection ? (
                <Badge tone="primary">{t("detected", { type: add.detectedLabel ?? "" })}</Badge>
              ) : (
                <span className="hidden text-caption text-fg-tertiary sm:inline">{t("addHint")}</span>
              )}
            </div>
            <AddTypeChips onPick={focusAdd} />
          </section>

          <section aria-labelledby="blocks-title" className="grid gap-3">
            <div className="flex items-baseline justify-between">
              <h2 id="blocks-title" className="text-h3">
                {t("blocks")}
              </h2>
              <p className="text-small text-fg-secondary">{t("blockCount", { count: doc.blocks.length })}</p>
            </div>
            <SortableBlocks blocks={doc.blocks} onMove={(id, to) => dispatch({ type: "move", id, to })} label={label} className="grid gap-3">
              {(block, index) => (
                <GalleryRow
                  key={block.id}
                  block={block}
                  label={label(block)}
                  typeLabel={tTypes(block.type)}
                  first={index === 0}
                  last={index === doc.blocks.length - 1}
                  onToggle={() => dispatch({ type: "toggle", id: block.id })}
                  onRename={(title) => dispatch({ type: "update", id: block.id, patch: { title } as Partial<Block> })}
                  onDuplicate={() => dispatch({ type: "duplicate", id: block.id })}
                  onRemove={() => editor.remove(block)}
                  onMove={(delta) => editor.moveBy(block.id, delta)}
                />
              )}
            </SortableBlocks>
          </section>
        </div>
      </main>

      <PreviewPane
        direction="gallery"
        page={page}
        theme={doc.theme}
        pageHref={pageHref}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
      <DropOverlay visible={dragging} />
      <CommandPalette
        onAddType={focusAdd}
        onTheme={(preset) => {
          dispatch({ type: "theme", theme: { preset } });
          toast({ title: creatorTokens.presets[preset].label, tone: "success" });
        }}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onOpenPage={() => window.open(pageHref, "_blank", "noopener")}
      />
    </div>
  );
}

function Thumb({ block }: { block: Block }) {
  const src =
    block.type === "music" ? block.cover.src : block.type === "video" ? block.poster.src : block.type === "product" || block.type === "card" ? block.image.src : block.type === "image" ? block.image.src : null;
  if (src) {
    const resolved = resolveMedia(src);
    return (
      <span className="relative size-control-lg shrink-0 overflow-hidden rounded-md bg-canvas-muted">
        <Image src={resolved} alt="" fill sizes={thumbSizes} className="object-cover" unoptimized={typeof resolved === "string"} />
      </span>
    );
  }
  return (
    <span className="grid size-control-lg shrink-0 place-items-center rounded-md bg-canvas-muted text-fg-secondary">
      <Icon icon={blockIcon[block.type]} size="md" />
    </span>
  );
}

function GalleryRow({
  block,
  label,
  typeLabel,
  first,
  last,
  onToggle,
  onRename,
  onDuplicate,
  onRemove,
  onMove,
}: {
  block: Block;
  label: string;
  typeLabel: string;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const t = useTranslations("dashboard");
  const { rowRef, rowStyle, isDragging, handleProps, dndKeyDown } = useSortableRow(block.id);
  // ⌥↑ / ⌥↓ moves the block from its handle or title (brand §7: keyboard reordering).
  const onReorderKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      onMove(event.key === "ArrowUp" ? -1 : 1);
    }
  };
  const editable = "title" in block && typeof block.title === "string" && block.type !== "events" && block.type !== "shorts" && block.type !== "gallery" && block.type !== "live";
  const subtitle = blockSummary(block, (platform) => platformName(platform as Parameters<typeof platformName>[0]));
  return (
    <li
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-line bg-surface p-3 pe-2",
        "transition-[opacity,scale] duration-standard ease-standard",
        isDragging && "layer-raised relative scale-lift border-primary",
        !block.visible && "border-dashed bg-canvas-muted",
      )}
    >
      <button
        type="button"
        {...handleProps}
        onKeyDown={(event) => {
          onReorderKey(event);
          if (!event.defaultPrevented) dndKeyDown(event);
        }}
        aria-label={t("dragHandle", { title: label })}
        className="grid h-control-md w-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-fg-tertiary opacity-0 transition-opacity duration-micro group-hover:opacity-100 focus-visible:opacity-100 focus-visible:focus-ring active:cursor-grabbing pointer-coarse:opacity-100"
      >
        <Icon icon={GripVertical} size="sm" />
      </button>
      <Thumb block={block} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        {editable ? (
          <input
            aria-label={t("titleLabel", { title: label })}
            defaultValue={label}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== label) onRename(value);
            }}
            onKeyDown={(event) => {
              onReorderKey(event);
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="-mx-1 min-w-0 truncate rounded-xs bg-transparent px-1 text-body font-medium outline-none hover:bg-hover focus-visible:bg-surface-elevated focus-visible:focus-ring"
          />
        ) : (
          <p className="truncate text-body font-medium">{label}</p>
        )}
        <p className="flex min-w-0 items-center gap-2 text-small text-fg-secondary">
          {!block.visible ? <Badge size="sm">{t("hidden")}</Badge> : null}
          <span className="shrink-0">{typeLabel}</span>
          {subtitle ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{subtitle}</span>
            </>
          ) : null}
        </p>
      </div>
      <span className="hidden shrink-0 font-mono text-small text-fg-secondary md:inline">{t("clicks", { count: sampleClicks(block.id) })}</span>
      <Switch checked={block.visible} onCheckedChange={onToggle} label={t("toggleVisibility", { title: label })} />
      <Menu
        trigger={<IconButton icon={MoreHorizontal} label={t("moreFor", { title: label })} />}
        items={[
          ...(first ? [] : [{ label: t("moveUp"), icon: ArrowUp, shortcut: "⌥↑", onSelect: () => onMove(-1) }]),
          ...(last ? [] : [{ label: t("moveDown"), icon: ArrowDown, shortcut: "⌥↓", onSelect: () => onMove(1) }]),
          { label: t("duplicate"), icon: Copy, onSelect: onDuplicate },
          { label: t("delete"), icon: Trash2, destructive: true, onSelect: onRemove },
        ]}
      />
    </li>
  );
}

export type { BlockType };
