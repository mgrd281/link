"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Block, BlockType } from "@linkyo/blocks";
import { creatorTokens, type CreatorPresetId } from "@linkyo/tokens";
import { cn, Icon, Kbd, LogoGlyph } from "@linkyo/ui";
import { Command } from "cmdk";
import {
  AtSign,
  BarChart3,
  CalendarDays,
  Clapperboard,
  ExternalLink,
  FileText,
  FolderGit2,
  FolderKanban,
  Handshake,
  Heading,
  Image as ImageIcon,
  Images,
  Inbox,
  LayoutGrid,
  LetterText,
  Link2,
  Mail,
  Milestone,
  Minus,
  Music2,
  Palette,
  PanelsTopLeft,
  Plus,
  Quote,
  Radio,
  Redo2,
  Send,
  Settings,
  ShoppingBag,
  Smartphone,
  Undo2,
  Upload,
  UserRound,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

export const blockIcon: Record<BlockType, LucideIcon> = {
  link: Link2,
  card: PanelsTopLeft,
  header: Heading,
  // Not FileText: that one stands for documents (PDF links, the media kit).
  text: LetterText,
  divider: Minus,
  socials: AtSign,
  image: ImageIcon,
  gallery: Images,
  video: Video,
  shorts: Clapperboard,
  music: Music2,
  events: CalendarDays,
  product: ShoppingBag,
  newsletter: Mail,
  live: Radio,
  brands: Handshake,
  app: Smartphone,
  repo: FolderGit2,
  project: FolderKanban,
  about: UserRound,
  tools: Wrench,
  timeline: Milestone,
  quotes: Quote,
  contact: Send,
};

export const ADD_TYPES: BlockType[] = ["link", "video", "music", "events", "image", "product", "newsletter", "header"];

/** Deterministic, plausible click counts for the prototype (analytics arrive in Phase 1). */
export function sampleClicks(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return 40 + (hash % 900);
}

export const NAV = [
  { key: "page", icon: Smartphone },
  { key: "content", icon: LayoutGrid },
  { key: "design", icon: Palette },
  { key: "analytics", icon: BarChart3 },
  { key: "mediaKit", icon: FileText },
  { key: "inbox", icon: Inbox },
  { key: "settings", icon: Settings },
] as const;

export function SidebarNav({ density = "airy" }: { density?: "airy" | "dense" }) {
  const t = useTranslations("dashboard");
  return (
    <nav aria-label={t("navLabel")} className="grid gap-0.5">
      {NAV.map((item, index) => (
        <a
          key={item.key}
          href={`#${item.key}`}
          aria-current={index === 0 ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-sm px-3 font-medium text-fg-secondary transition-colors duration-micro",
            "hover:bg-hover hover:text-fg focus-visible:focus-ring aria-[current=page]:bg-selected aria-[current=page]:text-fg",
            density === "airy" ? "h-control-md text-small" : "h-control-sm text-small",
          )}
        >
          <Icon icon={item.icon} size="sm" />
          {t(`nav.${item.key}`)}
          {item.key === "inbox" ? (
            <span className="ms-auto rounded-full bg-primary px-2 text-caption text-primary-fg">3</span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}

export function WorkspaceBadge({ name, url }: { name: string; url: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-control-sm shrink-0 place-items-center rounded-sm bg-primary text-primary-fg">
        <LogoGlyph className="size-icon-sm" />
      </span>
      <span className="grid min-w-0">
        <span className="truncate text-small font-semibold">{name}</span>
        <span className="truncate text-caption text-fg-tertiary">{url}</span>
      </span>
    </div>
  );
}

/** Sortable list/grid with pointer + keyboard sensors and localized screen-reader announcements. */
export function SortableBlocks({
  blocks,
  onMove,
  layout = "list",
  className,
  children,
  label,
}: {
  blocks: Block[];
  onMove: (id: string, to: number) => void;
  layout?: "list" | "grid";
  className?: string;
  label: (block: Block) => string;
  children: (block: Block, index: number) => ReactNode;
}) {
  const t = useTranslations("dashboard");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const to = blocks.findIndex((block) => block.id === over.id);
    onMove(String(active.id), to);
  };
  const nameOf = (id: string | number): string => {
    const block = blocks.find((candidate) => candidate.id === id);
    return block ? label(block) : "";
  };
  const position = (id: string | number): number => blocks.findIndex((block) => block.id === id) + 1;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      // dnd-kit's own instructions and messages are English; these follow the page's language.
      accessibility={{
        screenReaderInstructions: { draggable: t("dragInstructions") },
        announcements: {
          onDragStart: ({ active }) => nameOf(active.id),
          onDragOver: ({ active, over }) => (over ? t("reorderAnnounce", { title: nameOf(active.id), position: position(over.id) }) : ""),
          onDragEnd: ({ active, over }) => (over ? t("reorderAnnounce", { title: nameOf(active.id), position: position(over.id) }) : ""),
          onDragCancel: ({ active }) => t("reorderCancel", { title: nameOf(active.id) }),
        },
      }}
    >
      <SortableContext items={blocks.map((block) => block.id)} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul className={className}>{blocks.map((block, index) => children(block, index))}</ul>
      </SortableContext>
    </DndContext>
  );
}

/** Sortable item: returns props for the row and its drag handle (lift 1.03 + e3 while dragging). */
export function useSortableRow(id: string) {
  const t = useTranslations("dashboard");
  // The handle's role is read out ("sortable"), so it is translated like everything else.
  const sortable = useSortable({ id, attributes: { roleDescription: t("sortableRole") } });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  const listeners = sortable.listeners ?? {};
  return {
    rowRef: sortable.setNodeRef,
    rowStyle: style,
    isDragging: sortable.isDragging,
    handleProps: { ...sortable.attributes, ...listeners },
    /** dnd-kit's keyboard activator, for handles that add their own shortcuts. */
    dndKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      const handler = listeners.onKeyDown as ((event: ReactKeyboardEvent<HTMLElement>) => void) | undefined;
      handler?.(event);
    },
  };
}

export function CommandPalette({
  onAddType,
  onTheme,
  onUndo,
  onRedo,
  onOpenPage,
}: {
  onAddType: (type: BlockType) => void;
  onTheme: (preset: CreatorPresetId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenPage: () => void;
}) {
  const t = useTranslations("dashboard");
  const tTypes = useTranslations("dashboard.types");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const item =
    "flex h-control-md cursor-default items-center gap-3 rounded-sm px-3 text-small text-fg data-[selected=true]:bg-hover";
  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("command.label")}
      overlayClassName="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in"
      contentClassName="layer-modal fixed inset-x-4 top-24 mx-auto max-w-prose overflow-hidden rounded-xl border border-line bg-surface-elevated text-fg motion-safe:animate-pop-in"
    >
      <Command.Input
        placeholder={t("command.placeholder")}
        className="h-control-xl w-full border-b border-line bg-transparent px-5 text-body text-fg outline-none placeholder:text-fg-tertiary"
      />
      <Command.List className="max-h-(--container-preview) overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-small text-fg-secondary">{t("command.empty")}</Command.Empty>
        <Command.Group heading={t("command.addGroup")} className="px-1 py-2 text-caption text-fg-tertiary">
          {ADD_TYPES.map((type) => (
            <Command.Item key={type} onSelect={run(() => onAddType(type))} className={item}>
              <Icon icon={blockIcon[type]} size="sm" className="text-fg-secondary" />
              {tTypes(type)}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading={t("command.themeGroup")} className="px-1 py-2 text-caption text-fg-tertiary">
          {(Object.keys(creatorTokens.presets) as CreatorPresetId[]).map((preset) => (
            <Command.Item key={preset} onSelect={run(() => onTheme(preset))} className={item}>
              <Icon icon={Palette} size="sm" className="text-fg-secondary" />
              {creatorTokens.presets[preset].label}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading={t("command.actionsGroup")} className="px-1 py-2 text-caption text-fg-tertiary">
          <Command.Item onSelect={run(onUndo)} className={item}>
            <Icon icon={Undo2} size="sm" className="text-fg-secondary" />
            {t("undo")}
            <Kbd className="ms-auto">⌘Z</Kbd>
          </Command.Item>
          <Command.Item onSelect={run(onRedo)} className={item}>
            <Icon icon={Redo2} size="sm" className="text-fg-secondary" />
            {t("redo")}
            <Kbd className="ms-auto">⇧⌘Z</Kbd>
          </Command.Item>
          <Command.Item onSelect={run(onOpenPage)} className={item}>
            <Icon icon={ExternalLink} size="sm" className="text-fg-secondary" />
            {t("openPage")}
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

export function DropOverlay({ visible }: { visible: boolean }) {
  const t = useTranslations("dashboard");
  if (!visible) return null;
  return (
    <div className="layer-overlay pointer-events-none fixed inset-4 grid place-items-center rounded-xl border-emphasis border-dashed border-primary bg-selected motion-safe:animate-fade-in">
      <p className="flex items-center gap-3 text-h3 text-link">
        <Icon icon={Upload} size="lg" />
        {t("dropHere")}
      </p>
    </div>
  );
}

export function AddTypeChips({ onPick, className }: { onPick: (type: BlockType) => void; className?: string }) {
  const tTypes = useTranslations("dashboard.types");
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {ADD_TYPES.map((type) => (
        <li key={type}>
          <button
            type="button"
            onClick={() => onPick(type)}
            className="inline-flex h-control-sm items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:border-line-input hover:text-fg focus-visible:focus-ring"
          >
            <Icon icon={blockIcon[type]} size="sm" />
            {tTypes(type)}
          </button>
        </li>
      ))}
    </ul>
  );
}

export { Plus };
