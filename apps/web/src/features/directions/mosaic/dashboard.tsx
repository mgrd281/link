"use client";

import type { Block, Page } from "@linkyo/blocks";
import { creatorTokens, type CreatorPresetId } from "@linkyo/tokens";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Badge, Button, cn, Icon, Kbd, Logo, Segmented, Switch, toast } from "@linkyo/ui";
import { Copy, Eye, Plus, Share2, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { copyText } from "@/lib/clipboard";
import { useMemo } from "react";

import { themeStyle } from "@/features/creator/theme";

import { PreviewPane } from "../editor/preview-pane";
import type { EditorDoc } from "../editor/state";
import { blockIcon, AddTypeChips, CommandPalette, DropOverlay, SidebarNav, SortableBlocks, useSortableRow, WorkspaceBadge } from "../editor/ui";
import { useDashboard } from "../editor/use-dashboard";
import { mediaSizes } from "../shared/creator-kit";
import { resolveMedia } from "../shared/media";
import { defaultTileSize, type TileSize } from "./renderer";

const tileSpan: Record<TileSize, string> = { s: "col-span-1", w: "col-span-2", l: "col-span-2 row-span-2" };

/**
 * Direction C — "Mosaic" dashboard: direct manipulation. The center is the page's own grid as
 * editable tiles (drag to rearrange, pick to resize); the inspector edits the selected tile.
 */
export function MosaicDashboard({ initial, profile, pageHref }: { initial: EditorDoc; profile: Page["profile"]; pageHref: string }) {
  const t = useTranslations("dashboard");
  const tTypes = useTranslations("dashboard.types");
  const { editor, doc, dispatch, add, addRef, focusAdd, dragging, previewOpen, setPreviewOpen, label, page, url } = useDashboard(initial, profile);
  const selected = doc.blocks.find((block) => block.id === editor.state.selectedId) ?? null;
  const theme = useMemo(() => resolveCreatorTheme(doc.theme), [doc.theme]);

  return (
    <div className="flex min-h-dvh bg-canvas text-fg">
      <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col gap-6 border-e border-line p-4 lg:flex">
        <div className="px-1 pt-1">
          <Logo className="h-6" />
        </div>
        <WorkspaceBadge name={profile.displayName} url={url} />
        <SidebarNav />
        <div className="mt-auto">
          <Button size="sm" icon={Sparkles} block variant="secondary">
            {t("upgrade")}
          </Button>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto grid max-w-content gap-6 px-5 py-8 lg:px-10">
          <header className="flex flex-wrap items-center gap-3">
            <div className="grid w-full min-w-0 gap-1 sm:w-auto sm:flex-1">
              <h1 className="text-h2">{t("grid")}</h1>
              <p className="text-small text-fg-secondary">{t("gridHint")}</p>
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
          </header>

          <div className="flex items-center gap-3 rounded-full border border-line-input bg-surface-elevated ps-2 pe-4 focus-within:border-focus focus-within:focus-field">
            <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-primary text-primary-fg">
              <Icon icon={Plus} size="md" />
            </span>
            <label htmlFor="mosaic-add" className="sr-only">
              {t("addLabel")}
            </label>
            <input
              id="mosaic-add"
              ref={addRef}
              {...add.inputProps}
              placeholder={t("addPlaceholder")}
              autoComplete="off"
              className="h-control-lg min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
            />
            {add.detection ? <Badge tone="primary">{t("detected", { type: add.detectedLabel ?? "" })}</Badge> : <Kbd>N</Kbd>}
          </div>
          <AddTypeChips onPick={focusAdd} />

          <div className="grid gap-6 lg:grid-cols-3">
            <section aria-label={t("grid")} className="lg:col-span-2" style={themeStyle(theme)}>
              <div className={cn("rounded-xl p-3", theme.background === "gradient" ? "bg-(image:--creator-gradient)" : "bg-creator-bg")}>
                <SortableBlocks
                  layout="grid"
                  blocks={doc.blocks}
                  onMove={(id, to) => dispatch({ type: "move", id, to })}
                  label={label}
                  className="grid grid-flow-row-dense grid-cols-2 gap-2"
                >
                  {(block) => (
                    <MosaicEditTile
                      key={block.id}
                      block={block}
                      label={label(block)}
                      typeLabel={tTypes(block.type)}
                      size={doc.sizes[block.id] ?? defaultTileSize(block)}
                      selected={selected?.id === block.id}
                      onSelect={() => dispatch({ type: "select", id: block.id })}
                    />
                  )}
                </SortableBlocks>
              </div>
            </section>

            <aside aria-label={t("inspector.title")} className="grid content-start gap-4 rounded-xl border border-line bg-surface p-5">
              {selected ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="grid size-control-md place-items-center rounded-md bg-selected text-selected-fg">
                      <Icon icon={blockIcon[selected.type]} size="md" />
                    </span>
                    <div className="grid min-w-0">
                      <p className="text-caption text-fg-tertiary">{tTypes(selected.type)}</p>
                      <p className="truncate text-body font-semibold">{label(selected)}</p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <p className="text-small font-medium">{t("inspector.size")}</p>
                    <Segmented<TileSize>
                      label={t("inspector.size")}
                      value={doc.sizes[selected.id] ?? defaultTileSize(selected)}
                      onValueChange={(size) => dispatch({ type: "resize", id: selected.id, size })}
                      options={(["s", "w", "l"] as const).map((size) => ({ value: size, label: t(`inspector.sizes.${size}`) }))}
                    />
                  </div>
                  <label className="flex items-center justify-between gap-3 text-small font-medium">
                    {t("inspector.visibility")}
                    <Switch checked={selected.visible} onCheckedChange={() => dispatch({ type: "toggle", id: selected.id })} />
                  </label>
                  <div className="flex gap-2 border-t border-line pt-4">
                    <Button size="sm" icon={Copy} onClick={() => dispatch({ type: "duplicate", id: selected.id })}>
                      {t("duplicate")}
                    </Button>
                    <Button size="sm" variant="destructive" icon={Trash2} onClick={() => editor.remove(selected)}>
                      {t("delete")}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-small text-fg-secondary">{t("inspector.empty")}</p>
              )}
              <div className="grid gap-2 border-t border-line pt-4">
                <p className="text-small font-medium">{t("command.themeGroup")}</p>
                <div className="grid grid-cols-6 gap-2">
                  {(Object.keys(creatorTokens.presets) as CreatorPresetId[]).map((preset) => {
                    const presetTheme = resolveCreatorTheme({ preset });
                    return (
                      <button
                        key={preset}
                        type="button"
                        aria-label={creatorTokens.presets[preset].label}
                        aria-pressed={doc.theme.preset === preset}
                        onClick={() => dispatch({ type: "theme", theme: { preset } })}
                        style={themeStyle(presetTheme)}
                        className="grid aspect-square place-items-center rounded-md border border-line bg-creator-bg transition-[scale] duration-micro hover:scale-lift focus-visible:focus-ring aria-pressed:focus-ring"
                      >
                        <span className="size-icon-sm rounded-full bg-creator-accent" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <PreviewPane
        direction="mosaic"
        page={page}
        theme={doc.theme}
        sizes={doc.sizes}
        pageHref={pageHref}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
      <DropOverlay visible={dragging} />
      <CommandPalette
        onAddType={focusAdd}
        onTheme={(preset) => dispatch({ type: "theme", theme: { preset } })}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onOpenPage={() => window.open(pageHref, "_blank", "noopener")}
      />
    </div>
  );
}

function MosaicEditTile({
  block,
  label,
  typeLabel,
  size,
  selected,
  onSelect,
}: {
  block: Block;
  label: string;
  typeLabel: string;
  size: TileSize;
  selected: boolean;
  onSelect: () => void;
}) {
  const { rowRef, rowStyle, isDragging, handleProps } = useSortableRow(block.id);
  const image =
    block.type === "music" ? block.cover.src : block.type === "video" ? block.poster.src : block.type === "product" || block.type === "card" || block.type === "image" ? block.image.src : null;
  const resolved = image ? resolveMedia(image) : null;
  return (
    <li ref={rowRef} style={rowStyle} className={cn(tileSpan[size], isDragging && "layer-raised relative")}>
      <button
        type="button"
        {...handleProps}
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "relative isolate flex w-full cursor-grab touch-none flex-col justify-end gap-1 overflow-hidden rounded-lg bg-creator-surface p-3 text-start text-creator-fg",
          "transition-[scale,opacity] duration-standard ease-standard focus-visible:focus-ring active:cursor-grabbing",
          size === "l" ? "aspect-video" : size === "s" ? "aspect-square" : "h-24",
          selected && "focus-ring",
          isDragging && "scale-lift",
          block.visible ? "border border-creator-line" : "border-emphasis border-dashed border-creator-line-strong",
        )}
      >
        {resolved ? (
          <Image src={resolved} alt="" fill sizes={size === "s" ? mediaSizes.third : mediaSizes.half} className="object-cover" unoptimized={typeof resolved === "string"} />
        ) : null}
        <span className={cn("relative grid min-w-0 gap-0.5", resolved && "self-start rounded-md bg-creator-surface px-2 py-1")}>
          <span className="flex items-center gap-2 text-caption font-medium text-creator-fg-muted">
            <Icon icon={blockIcon[block.type]} size="sm" />
            {typeLabel}
            <span className="sr-only">:</span>
          </span>
          {label !== typeLabel ? <span className="truncate text-small font-semibold">{label}</span> : null}
        </span>
      </button>
    </li>
  );
}
