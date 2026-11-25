"use client";

import type { Block, Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { Badge, Button, cn, Icon, IconButton, icons, Kbd, Logo, Menu, Switch, toast } from "@linkyo/ui";
import { ArrowDown, ArrowUp, Copy, Eye, Gem, GripVertical, Plus, Share2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { copyText } from "@/lib/clipboard";

import { AddTypeChips, blockIcon, CommandPalette, DropOverlay, SidebarNav, SortableBlocks, sampleClicks, useSortableRow, WorkspaceBadge } from "../editor/ui";
import { PreviewPane } from "../editor/preview-pane";
import type { EditorDoc } from "../editor/state";
import { thumbSizes, useDashboard } from "../editor/use-dashboard";
import { blockSummary } from "../editor/use-editor";
import { platformName } from "../shared/creator-kit";
import { resolveMedia } from "../shared/media";
import { selfTitle } from "./sections";
import { TemplatePicker } from "./template-picker";

/**
 * Direction D — "Poster" dashboard: the page as an outline of sections.
 * Section titles are rows of their own; the blocks under them are indented exactly as they will
 * group on the page. Templates switch the whole look in one click. The live phone preview uses the
 * real renderer.
 */
export function PosterDashboard({ initial, profile, pageHref }: { initial: EditorDoc; profile: Page["profile"]; pageHref: string }) {
  const t = useTranslations("dashboard");
  const tTypes = useTranslations("dashboard.types");
  const { editor, doc, dispatch, add, addRef, focusAdd, dragging, previewOpen, setPreviewOpen, label, page, url } = useDashboard(initial, profile);
  const [focusSection, setFocusSection] = useState<string | null>(null);

  // Which rows sit inside a section (same rule as the page: a header or a titled list opens one).
  const rows = doc.blocks.map((block, index) => {
    const opensSection = block.type === "header" || selfTitle(block) !== null;
    const nested = !opensSection && doc.blocks.slice(0, index).some((before) => before.type === "header" || selfTitle(before) !== null);
    return { block, opensSection, nested };
  });
  const countAfter = (index: number) => {
    let count = 0;
    for (const row of rows.slice(index + 1)) {
      if (row.opensSection) break;
      if (row.block.type !== "socials") count += 1;
    }
    return count;
  };

  const addSection = () => {
    const block: Block = { id: `section-${Date.now().toString(36)}`, type: "header", visible: true, highlight: false, title: t("newSection") };
    dispatch({ type: "add", block });
    setFocusSection(block.id);
  };

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
          <Button size="sm" icon={Gem} block>
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
            <div className="flex items-center gap-3 rounded-lg border border-line-input bg-surface-elevated px-4 focus-within:border-focus focus-within:focus-field">
              <Icon icon={Plus} size="md" className="text-fg-tertiary" />
              <label className="sr-only" htmlFor="poster-add">
                {t("addLabel")}
              </label>
              <input
                id="poster-add"
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
            <AddTypeChips onPick={(type) => (type === "header" ? addSection() : focusAdd())} />
          </section>

          <section aria-labelledby="template-title" className="grid gap-3">
            <h2 id="template-title" className="text-h3">
              {t("template")}
            </h2>
            <TemplatePicker
              value={doc.theme.template}
              profile={profile}
              onChange={(template) => {
                dispatch({ type: "theme", theme: { template } });
                toast({ title: t("templateApplied", { name: creatorTokens.templates[template].label }), tone: "success" });
              }}
            />
          </section>

          <section aria-labelledby="sections-title" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="sections-title" className="text-h3">
                {t("sections")}
              </h2>
              <div className="flex items-center gap-3">
                <p className="text-small text-fg-secondary">{t("blockCount", { count: doc.blocks.length })}</p>
                <Button size="sm" icon={icons.section} onClick={addSection}>
                  {t("addSection")}
                </Button>
              </div>
            </div>
            <p className="flex items-baseline gap-2 border-b border-line pb-2 text-small">
              <span className="font-semibold">{t("pageTop")}</span>
              <span className="text-fg-tertiary">{t("pageTopHint")}</span>
            </p>
            <SortableBlocks blocks={doc.blocks} onMove={(id, to) => dispatch({ type: "move", id, to })} label={label} className="grid gap-2">
              {(block, index) => {
                const row = rows[index];
                const common = {
                  block,
                  label: label(block),
                  first: index === 0,
                  last: index === doc.blocks.length - 1,
                  onToggle: () => dispatch({ type: "toggle", id: block.id }),
                  onRename: (title: string) => dispatch({ type: "update", id: block.id, patch: { title } as Partial<Block> }),
                  onDuplicate: () => dispatch({ type: "duplicate", id: block.id }),
                  onRemove: () => editor.remove(block),
                  onMove: (delta: number) => editor.moveBy(block.id, delta),
                };
                return block.type === "header" ? (
                  <SectionRow key={block.id} {...common} count={countAfter(index)} focus={focusSection === block.id} />
                ) : (
                  <PosterRow key={block.id} {...common} typeLabel={tTypes(block.type)} nested={row?.nested ?? false} opensSection={row?.opensSection ?? false} />
                );
              }}
            </SortableBlocks>
          </section>
        </div>
      </main>

      <PreviewPane direction="poster" page={page} theme={doc.theme} pageHref={pageHref} open={previewOpen} onClose={() => setPreviewOpen(false)} />
      <DropOverlay visible={dragging} />
      <CommandPalette
        onAddType={(type) => (type === "header" ? addSection() : focusAdd())}
        onTheme={(preset) => {
          dispatch({ type: "theme", theme: { ...doc.theme, preset } });
          toast({ title: creatorTokens.presets[preset].label, tone: "success" });
        }}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onOpenPage={() => window.open(pageHref, "_blank", "noopener")}
      />
    </div>
  );
}

interface RowProps {
  block: Block;
  label: string;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}

/** ⌥↑ / ⌥↓ moves a row from its handle or title (brand §7: keyboard reordering). */
const reorderKey = (onMove: (delta: number) => void) => (event: KeyboardEvent<HTMLElement>) => {
  if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    onMove(event.key === "ArrowUp" ? -1 : 1);
  }
};

function RowMenu({ label, first, last, onMove, onDuplicate, onRemove }: Pick<RowProps, "label" | "first" | "last" | "onMove" | "onDuplicate" | "onRemove">) {
  const t = useTranslations("dashboard");
  return (
    <Menu
      trigger={<IconButton icon={icons.more} label={t("moreFor", { title: label })} />}
      items={[
        ...(first ? [] : [{ label: t("moveUp"), icon: ArrowUp, shortcut: "⌥↑", onSelect: () => onMove(-1) }]),
        ...(last ? [] : [{ label: t("moveDown"), icon: ArrowDown, shortcut: "⌥↓", onSelect: () => onMove(1) }]),
        { label: t("duplicate"), icon: Copy, onSelect: onDuplicate },
        { label: t("delete"), icon: Trash2, destructive: true, onSelect: onRemove },
      ]}
    />
  );
}

type Sortable = ReturnType<typeof useSortableRow>;

function DragHandle({ sortable, label, onMove }: { sortable: Sortable; label: string; onMove: (delta: number) => void }) {
  const t = useTranslations("dashboard");
  const { handleProps, dndKeyDown } = sortable;
  const onKey = reorderKey(onMove);
  return (
    <button
      type="button"
      {...handleProps}
      onKeyDown={(event) => {
        onKey(event);
        if (!event.defaultPrevented) dndKeyDown(event);
      }}
      aria-label={t("dragHandle", { title: label })}
      className="grid h-control-md w-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-fg-tertiary opacity-0 transition-opacity duration-micro group-hover:opacity-100 focus-visible:opacity-100 focus-visible:focus-ring active:cursor-grabbing pointer-coarse:opacity-100"
    >
      <Icon icon={GripVertical} size="sm" />
    </button>
  );
}

/** A section title: edited in place, shows how many blocks it holds. */
function SectionRow({ block, label, count, focus, first, last, onToggle, onRename, onDuplicate, onRemove, onMove }: RowProps & { count: number; focus: boolean }) {
  const t = useTranslations("dashboard");
  const sortable = useSortableRow(block.id);
  const { rowRef, rowStyle, isDragging } = sortable;
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) inputRef.current?.select();
  }, [focus]);
  return (
    <li
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group flex items-center gap-3 rounded-lg pe-2 pt-4 pb-1",
        "transition-[opacity,scale] duration-standard ease-standard",
        isDragging && "layer-raised relative scale-lift bg-surface",
        !block.visible && "opacity-secondary",
      )}
    >
      <DragHandle sortable={sortable} label={label} onMove={onMove} />
      <span className="grid size-control-md shrink-0 place-items-center rounded-md bg-selected text-selected-fg">
        <Icon icon={icons.section} size="sm" />
      </span>
      <input
        ref={inputRef}
        aria-label={t("sectionTitle", { title: label })}
        defaultValue={label}
        onBlur={(event) => {
          const value = event.target.value.trim();
          if (value && value !== label) onRename(value);
        }}
        onKeyDown={(event) => {
          reorderKey(onMove)(event);
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="-mx-1 min-w-0 flex-1 truncate rounded-xs bg-transparent px-1 text-h3 outline-none hover:bg-hover focus-visible:bg-surface-elevated focus-visible:focus-ring"
      />
      <span className="hidden shrink-0 text-small text-fg-secondary sm:inline">{t("sectionItems", { count })}</span>
      {!block.visible ? <Badge size="sm">{t("hidden")}</Badge> : null}
      <Switch checked={block.visible} onCheckedChange={onToggle} label={t("toggleVisibility", { title: label })} />
      <RowMenu label={label} first={first} last={last} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
    </li>
  );
}

function Thumb({ block }: { block: Block }) {
  const src =
    block.type === "music"
      ? block.cover.src
      : block.type === "video"
        ? block.poster.src
        : block.type === "product" || block.type === "card" || block.type === "image"
          ? block.image.src
          : block.type === "link"
            ? (block.thumbnail?.src ?? null)
            : null;
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

/** A block row, indented when it belongs to a section. */
function PosterRow({
  block,
  label,
  typeLabel,
  nested,
  opensSection,
  first,
  last,
  onToggle,
  onRename,
  onDuplicate,
  onRemove,
  onMove,
}: RowProps & { typeLabel: string; nested: boolean; opensSection: boolean }) {
  const t = useTranslations("dashboard");
  const sortable = useSortableRow(block.id);
  const { rowRef, rowStyle, isDragging } = sortable;
  const editable = (block.type === "link" || block.type === "card" || block.type === "music" || block.type === "video" || block.type === "product" || block.type === "newsletter") && "title" in block;
  const subtitle = blockSummary(block, (platform) => platformName(platform as Parameters<typeof platformName>[0]));
  return (
    <li
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-line bg-surface p-2 pe-2",
        "transition-[opacity,scale] duration-standard ease-standard",
        nested && "ms-4 md:ms-8",
        opensSection && "mt-4",
        isDragging && "layer-raised relative scale-lift border-primary",
        !block.visible && "border-dashed bg-canvas-muted",
      )}
    >
      <DragHandle sortable={sortable} label={label} onMove={onMove} />
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
              reorderKey(onMove)(event);
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="-mx-1 min-w-0 truncate rounded-xs bg-transparent px-1 text-body font-medium outline-none hover:bg-hover focus-visible:bg-surface-elevated focus-visible:focus-ring"
          />
        ) : (
          <p className={cn("truncate", opensSection ? "text-body-lg font-semibold" : "text-body font-medium")}>{label}</p>
        )}
        <p className="flex min-w-0 items-center gap-2 text-small text-fg-secondary">
          {!block.visible ? <Badge size="sm">{t("hidden")}</Badge> : null}
          {block.highlight ? (
            <Badge tone="primary" size="sm">
              {t("featured")}
            </Badge>
          ) : null}
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
      <RowMenu label={label} first={first} last={last} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
    </li>
  );
}
