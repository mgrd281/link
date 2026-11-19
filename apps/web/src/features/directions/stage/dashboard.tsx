"use client";

import type { Block, Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { Badge, Button, cn, Icon, IconButton, Kbd, LogoSymbol, Menu, Switch, toast } from "@linkyo/ui";
import { ArrowDown, ArrowUp, Command as CommandIcon, Copy, Eye, GripVertical, MoreHorizontal, Plus, Share2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { copyText } from "@/lib/clipboard";

import { PreviewPane } from "../editor/preview-pane";
import type { EditorDoc } from "../editor/state";
import { blockIcon, CommandPalette, DropOverlay, SidebarNav, SortableBlocks, sampleClicks, useSortableRow } from "../editor/ui";
import { useDashboard } from "../editor/use-dashboard";
import { blockSummary } from "../editor/use-editor";
import { platformName } from "../shared/creator-kit";

/** Deterministic 7-day sparkline for the prototype. */
function spark(id: string): number[] {
  const base = sampleClicks(id);
  return Array.from({ length: 7 }, (_, i) => 20 + ((base * (i + 3)) % 80));
}

/**
 * Direction B — "Stage" dashboard: dark, dense, keyboard-first (Linear-like).
 * Stats at a glance, command bar for adding, compact rows with sparklines.
 */
export function StageDashboard({ initial, profile, pageHref }: { initial: EditorDoc; profile: Page["profile"]; pageHref: string }) {
  const t = useTranslations("dashboard");
  const tTypes = useTranslations("dashboard.types");
  const { editor, doc, dispatch, add, addRef, focusAdd, dragging, previewOpen, setPreviewOpen, label, page, url } = useDashboard(initial, profile);
  const locale = useLocale();
  const n = new Intl.NumberFormat(locale);
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "auto" });
  const delta = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "always" });
  const stats = [
    { label: t("stats.views"), value: n.format(2481), delta: delta.format(0.12) },
    { label: t("stats.clicks"), value: n.format(612), delta: delta.format(0.08) },
    { label: t("stats.ctr"), value: pct.format(0.247), delta: delta.format(0.012) },
    { label: t("stats.subscribers"), value: new Intl.NumberFormat(locale, { signDisplay: "always" }).format(38), delta: t("today") },
  ];

  return (
    <div data-theme="dark" className="flex min-h-dvh bg-canvas text-fg">
      <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col gap-5 border-e border-line p-3 lg:flex">
        <div className="flex items-center gap-2 px-2 pt-2">
          <span className="grid size-control-sm place-items-center rounded-sm bg-primary text-primary-fg">
            <LogoSymbol className="size-icon-sm" />
          </span>
          <span className="truncate text-small font-semibold">{profile.displayName}</span>
          <Badge size="sm" tone="outline" className="ms-auto">
            Free
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex h-control-sm items-center gap-2 rounded-sm border border-line bg-surface px-2 text-small text-fg-tertiary transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
        >
          <Icon icon={CommandIcon} size="sm" />
          <span className="min-w-0 flex-1 truncate text-start">{t("command.placeholder")}</span>
          <Kbd>⌘K</Kbd>
        </button>
        <SidebarNav density="dense" />
        <div className="mt-auto grid gap-2 rounded-md border border-line p-3 text-caption text-fg-secondary">
          <p className="font-medium text-fg">{t("shortcuts")}</p>
          <p className="flex justify-between">
            {t("add")} <Kbd>N</Kbd>
          </p>
          <p className="flex justify-between">
            {t("command.label")} <Kbd>⌘K</Kbd>
          </p>
          <p className="flex justify-between">
            {t("moveUp")} / {t("moveDown")} <Kbd>⌥↑↓</Kbd>
          </p>
          <p className="flex justify-between">
            {t("undo")} <Kbd>⌘Z</Kbd>
          </p>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1">
        <header className="layer-sticky sticky top-0 flex items-center gap-3 border-b border-line bg-canvas px-5 py-3">
          <h1 className="text-body font-semibold">{t("pageTitle")}</h1>
          <span className="truncate font-mono text-small text-fg-tertiary">{url}</span>
          <Badge tone="spark" dot size="sm">
            {t("live")}
          </Badge>
          <div className="ms-auto flex items-center gap-2">
            <IconButton icon={Eye} label={t("openPreview")} onClick={() => setPreviewOpen(true)} className="xl:hidden" />
            <IconButton
              icon={Share2}
              label={t("share")}
              onClick={() => {
                void copyText(`https://${url}`);
                toast({ title: t("copied"), tone: "success" });
              }}
            />
          </div>
        </header>

        <div className="mx-auto grid max-w-content gap-6 px-5 py-6">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="grid gap-1 bg-surface p-4">
                <dt className="text-caption text-fg-tertiary">{stat.label}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="font-mono text-h3">{stat.value}</span>
                  <span className="font-mono text-caption text-success-strong">{stat.delta}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 focus-within:border-focus focus-within:focus-ring">
            <span className="grid size-control-sm place-items-center rounded-sm bg-primary text-primary-fg">
              <Icon icon={Plus} size="sm" />
            </span>
            <label htmlFor="stage-add" className="sr-only">
              {t("addLabel")}
            </label>
            <input
              id="stage-add"
              ref={addRef}
              {...add.inputProps}
              placeholder={t("addPlaceholder")}
              autoComplete="off"
              className="h-control-lg min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
            />
            {add.detection ? <Badge tone="primary">{t("detected", { type: add.detectedLabel ?? "" })}</Badge> : <Kbd>N</Kbd>}
            {add.value ? (
              <Button size="sm" variant="primary" onClick={add.submit}>
                {t("add")}
              </Button>
            ) : null}
          </div>

          <section aria-labelledby="stage-blocks" className="grid gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 id="stage-blocks" className="text-caption font-semibold tracking-wide text-fg-tertiary uppercase">
                {t("blocks")} · {doc.blocks.length}
              </h2>
              <span className="hidden text-caption text-fg-tertiary md:inline">{t("stats.clicks")} · 7d</span>
            </div>
            <SortableBlocks
              blocks={doc.blocks}
              onMove={(id, to) => dispatch({ type: "move", id, to })}
              label={label}
              className="overflow-hidden rounded-lg border border-line bg-surface"
            >
              {(block, index) => (
                <StageRow
                  key={block.id}
                  block={block}
                  label={label(block)}
                  typeLabel={tTypes(block.type)}
                  first={index === 0}
                  last={index === doc.blocks.length - 1}
                  onToggle={() => dispatch({ type: "toggle", id: block.id })}
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
        direction="stage"
        tone="dark"
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
          dispatch({ type: "theme", theme: { ...doc.theme, preset, accent: undefined, mode: undefined } });
          toast({ title: creatorTokens.presets[preset].label, tone: "success" });
        }}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onOpenPage={() => window.open(pageHref, "_blank", "noopener")}
      />
    </div>
  );
}

function StageRow({
  block,
  label,
  typeLabel,
  first,
  last,
  onToggle,
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
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const t = useTranslations("dashboard");
  const { rowRef, rowStyle, isDragging, handleProps, dndKeyDown } = useSortableRow(block.id);
  const bars = spark(block.id);
  const max = Math.max(...bars);
  return (
    <li
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group flex h-control-xl items-center gap-3 border-b border-line bg-surface px-2 last:border-b-0",
        "transition-[background-color,scale] duration-micro hover:bg-surface-elevated",
        isDragging && "layer-raised relative scale-lift rounded-md border border-primary",
      )}
    >
      <button
        type="button"
        {...handleProps}
        onKeyDown={(event) => {
          if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            event.preventDefault();
            onMove(event.key === "ArrowUp" ? -1 : 1);
            return;
          }
          dndKeyDown(event);
        }}
        aria-label={t("dragHandle", { title: label })}
        className="grid h-control-md w-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-fg-tertiary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:focus-ring pointer-coarse:opacity-100"
      >
        <Icon icon={GripVertical} size="sm" />
      </button>
      <span className={cn("grid size-control-sm shrink-0 place-items-center rounded-sm bg-canvas-muted text-fg-secondary", !block.visible && "border border-dashed border-line-strong bg-transparent")}>
        <Icon icon={blockIcon[block.type]} size="sm" />
      </span>
      <div className="grid min-w-0 flex-1">
        <span className={cn("truncate text-small font-medium", !block.visible && "text-fg-secondary line-through")}>{label}</span>
        <span className="truncate text-caption text-fg-tertiary">
          {[typeLabel, !block.visible ? t("hidden") : blockSummary(block, (platform) => platformName(platform as Parameters<typeof platformName>[0]))]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <span aria-hidden className="hidden h-6 items-end gap-0.5 md:flex">
        {bars.map((value, i) => (
          <span
            key={i}
            className={cn("w-1 rounded-xs bg-link", i < bars.length - 1 && "opacity-secondary")}
            style={{ blockSize: `${Math.round((value / max) * 100)}%` }}
          />
        ))}
      </span>
      <span className="hidden w-16 shrink-0 text-end font-mono text-caption text-fg-secondary md:inline">{sampleClicks(block.id)}</span>
      <Switch checked={block.visible} onCheckedChange={onToggle} label={t("toggleVisibility", { title: label })} />
      <Menu
        trigger={<IconButton icon={MoreHorizontal} label={t("moreFor", { title: label })} size="sm" />}
        items={[
          ...(first ? [] : [{ label: t("moveUp"), icon: ArrowUp, shortcut: "⌥↑", onSelect: () => onMove(-1) }]),
          ...(last ? [] : [{ label: t("moveDown"), icon: ArrowDown, shortcut: "⌥↓", onSelect: () => onMove(1) }]),
          { label: t("duplicate"), icon: Copy, shortcut: "⌘D", onSelect: onDuplicate },
          { label: t("delete"), icon: Trash2, destructive: true, shortcut: "⌫", onSelect: onRemove },
        ]}
      />
    </li>
  );
}
