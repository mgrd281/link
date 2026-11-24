"use client";

import type { LucideIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Icon } from "./icon";
import { icons } from "./icons";
import { cn } from "./lib/cn";

export interface PaletteCommand {
  id: string;
  label: string;
  /** The heading it is listed under ("Seiten", "Aktionen"). */
  group?: string | undefined;
  /** More words it is found by (another name, the German and English word). */
  keywords?: readonly string[] | undefined;
  icon?: LucideIcon | undefined;
  /** A shortcut or a short note at the end of the row. */
  hint?: string | undefined;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: readonly PaletteCommand[];
  /** The dialog's name for screen readers ("Befehle"). */
  label: string;
  placeholder: string;
  /** Shown when nothing matches. */
  emptyLabel: string;
  /** Read out as the results change ("3 Treffer"). */
  resultsLabel: (count: number) => string;
}

/** Lower case without accents, so "uber" finds "Über" and "Ubersicht". */
export const normalizeQuery = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .trim();

/**
 * The commands that match a query, best first: a label that starts with it, then a word of the label,
 * then any other match (keywords, group). Every word of the query must match. An empty query lists
 * every command in its own order.
 */
export function filterCommands<C extends PaletteCommand>(commands: readonly C[], query: string): C[] {
  const words = normalizeQuery(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...commands];
  const scored: { command: C; score: number; index: number }[] = [];
  commands.forEach((command, index) => {
    const label = normalizeQuery(command.label);
    const extra = normalizeQuery([...(command.keywords ?? []), command.group ?? ""].join(" "));
    const haystack = `${label} ${extra}`;
    if (!words.every((word) => haystack.includes(word))) return;
    const first = words[0] ?? "";
    const score = label.startsWith(first) ? 0 : label.split(/\s+/).some((part) => part.startsWith(first)) ? 1 : 2;
    scored.push({ command, score, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((entry) => entry.command);
}

/**
 * Ranked results brought together by group: each heading appears once, at the place of its best match,
 * with its commands in ranked order under it.
 */
export function groupCommands<C extends PaletteCommand>(ranked: readonly C[]): C[] {
  const order: (string | undefined)[] = [];
  for (const command of ranked) if (!order.includes(command.group)) order.push(command.group);
  return order.flatMap((group) => ranked.filter((command) => command.group === group));
}

/** The next active row for a key, wrapping at the ends; `null` for keys the list does not handle. */
export function moveActive(index: number, key: string, length: number): number | null {
  if (length === 0) return null;
  if (key === "ArrowDown") return (index + 1) % length;
  if (key === "ArrowUp") return (index - 1 + length) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
}

/**
 * Opens the palette with ⌘K on a Mac and Ctrl+K elsewhere, from anywhere on the page. A second press
 * closes it.
 */
export function useCommandPaletteShortcut(toggle: () => void) {
  const latest = useRef(toggle);
  useEffect(() => {
    latest.current = toggle;
  });
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

/**
 * A command palette (⌘K) for both consoles: one field, the matching commands under their headings,
 * arrow keys to move, Enter to run, Escape to close. A combobox with a listbox (ARIA 1.2), so screen
 * readers hear the active row and the number of results. Right to left it simply follows the page.
 */
export function CommandPalette({ open, onOpenChange, commands, label, placeholder, emptyLabel, resultsLabel }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  // The rows as shown (each group once, where its best match ranks), so the arrow keys follow the screen.
  const results = useMemo(() => groupCommands(filterCommands(commands, query)), [commands, query]);
  const groups = useMemo(() => {
    const out: { name: string | undefined; items: { command: PaletteCommand; index: number }[] }[] = [];
    results.forEach((command, index) => {
      const last = out.at(-1);
      if (last && last.name === command.group) last.items.push({ command, index });
      else out.push({ name: command.group, items: [{ command, index }] });
    });
    return out;
  }, [results]);
  const current = Math.min(active, Math.max(results.length - 1, 0));
  const optionId = (index: number) => `${listId}-option-${String(index)}`;

  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
  });

  const run = (command: PaletteCommand | undefined) => {
    if (!command) return;
    onOpenChange(false);
    command.onSelect();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      run(results[current]);
      return;
    }
    // Home and End move the caret in the field; with the list they jump only together with Ctrl.
    if ((event.key === "Home" || event.key === "End") && !event.ctrlKey) return;
    const next = moveActive(current, event.key, results.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setActive(0);
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "layer-modal fixed inset-x-4 top-16 mx-auto flex max-h-[70dvh] max-w-prose flex-col overflow-hidden rounded-xl border border-line bg-surface-elevated text-fg",
            "motion-safe:animate-pop-in sm:inset-x-0 sm:w-full",
          )}
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Icon icon={icons.search} size="md" className="text-fg-tertiary" />
            <input
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results.length > 0 ? optionId(current) : undefined}
              aria-label={label}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              // 16 px text: iOS zooms into a smaller field.
              className="h-control-xl min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-tertiary"
            />
          </div>
          {/* A listbox owns only options and groups: the "nothing found" line sits beside it, and the
              empty list is hidden (the combobox then reports itself collapsed). */}
          <div id={listId} role="listbox" aria-label={label} hidden={results.length === 0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {groups.map((group) => (
              <div key={group.name ?? "-"} role="group" aria-label={group.name}>
                {group.name ? (
                  <p aria-hidden className="px-3 pt-3 pb-1 text-caption font-medium text-fg-tertiary">
                    {group.name}
                  </p>
                ) : null}
                {group.items.map(({ command, index }) => (
                  <div
                    key={command.id}
                    id={optionId(index)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === current}
                    onMouseMove={() => {
                      if (index !== current) setActive(index);
                    }}
                    onClick={() => {
                      run(command);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") run(command);
                    }}
                    className={cn(
                      "flex min-h-control-md cursor-default items-center gap-3 rounded-md px-3 py-2 text-small pointer-coarse:min-h-control-lg pointer-coarse:text-body",
                      index === current ? "bg-selected text-selected-fg" : "text-fg",
                    )}
                  >
                    {command.icon ? <Icon icon={command.icon} size="sm" /> : null}
                    <span className="min-w-0 flex-1 truncate">{command.label}</span>
                    {command.hint ? (
                      <span dir="ltr" className="shrink-0 text-caption text-fg-tertiary">
                        {command.hint}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {results.length === 0 ? <p className="px-3 py-8 text-center text-small text-fg-secondary">{emptyLabel}</p> : null}
          <p aria-live="polite" className="sr-only">
            {resultsLabel(results.length)}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
