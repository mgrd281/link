"use client";

import { Dialog } from "radix-ui";
import { useId, useState, type ReactNode } from "react";

import { Button } from "./button";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { icons } from "./icons";
import { cn } from "./lib/cn";

export interface FilterSheetProps {
  /** The sheet's title and the trigger's label ("Filter"). */
  title: string;
  /** How many filters are on; shown on the trigger and read with its name. */
  activeCount: number;
  /** Read after the trigger's name while filters are on ("2 Filter aktiv"), as its description. */
  activeLabel: (count: number) => string;
  resetLabel: string;
  /** The button that closes the sheet ("{count} Ergebnisse zeigen", or "Fertig"). */
  doneLabel: string;
  closeLabel: string;
  onReset: () => void;
  /** Filters apply as they change; the done button only closes the sheet. */
  children: ReactNode;
  /** Controlled open state (optional). */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  className?: string | undefined;
}

/**
 * Filters for a long list, behind one button (A-11): on a phone they open in a sheet from the bottom
 * instead of four selects pushing the first row off the screen; on a laptop the sheet comes in from
 * the end. Filters apply as they change, so what the list shows is always what the sheet says.
 * Pair it with `ActiveFilters` above the list.
 */
export function FilterSheet({ title, activeCount, activeLabel, resetLabel, doneLabel, closeLabel, onReset, children, open, onOpenChange, className }: FilterSheetProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const countId = useId();
  const isOpen = open ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };
  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          icon={icons.filter}
          className={className}
          // The name is the visible label (WCAG 2.5.3); how many filters are on is its description.
          aria-describedby={activeCount > 0 ? countId : undefined}
          trailing={
            activeCount > 0 ? (
              <span aria-hidden className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-caption font-semibold tabular-nums text-primary-fg">
                {activeCount}
              </span>
            ) : undefined
          }
        >
          {title}
        </Button>
      </Dialog.Trigger>
      {activeCount > 0 ? (
        <span id={countId} hidden>
          {activeLabel(activeCount)}
        </span>
      ) : null}
      <Dialog.Portal>
        <Dialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-scrim-in data-[state=closed]:motion-safe:animate-fade-out" />
        <Dialog.Content
          aria-describedby={undefined}
          // The sheet itself takes focus when it opens (its title is read out), not its close button:
          // focus put there by the sheet popped the button's tooltip up ("Schließen") the moment the
          // sheet opened, also after a tap. Tab goes on to the close button, whose tooltip shows then.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          className={cn(
            // Phones: a sheet from the bottom; wide screens: a panel from the end of the line.
            "layer-modal fixed inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-xl border border-line bg-surface-elevated text-fg outline-none",
            "motion-safe:animate-sheet-in data-[state=closed]:motion-safe:animate-sheet-out",
            "lg:inset-y-0 lg:start-auto lg:end-0 lg:max-h-none lg:w-full lg:max-w-prose lg:rounded-none lg:rounded-s-xl",
            "lg:motion-safe:animate-fade-in lg:data-[state=closed]:motion-safe:animate-fade-out",
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong lg:hidden" />
          <header className="flex items-center gap-3 border-b border-line px-5 pt-3 pb-4 lg:pt-5">
            <Dialog.Title className="flex-1 text-h3">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton variant="tinted" icon={icons.close} label={closeLabel} className="rounded-full" />
            </Dialog.Close>
          </header>
          <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          <footer className="flex gap-3 border-t border-line px-5 pt-4 pb-[max(var(--spacing-4),env(safe-area-inset-bottom))]">
            <Button variant="ghost" size="lg" disabled={activeCount === 0} onClick={onReset}>
              {resetLabel}
            </Button>
            <Dialog.Close asChild>
              <Button variant="primary" size="lg" className="flex-1">
                {doneLabel}
              </Button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** One question in a FilterSheet ("Plan", "Status"): a group of chips under a heading. */
export function FilterGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 text-small font-semibold text-fg">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/**
 * A choice inside a FilterGroup: a toggle chip. Chosen chips carry a check and a stronger border, not
 * only a fill (WCAG 1.4.1, 1.4.11).
 */
export function FilterChip({ label, selected, onToggle, count }: { label: string; selected: boolean; onToggle: () => void; count?: number | undefined }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex h-control-md items-center gap-2 rounded-full border px-4 text-small font-medium",
        "transition-[background-color,border-color,color] duration-micro ease-standard focus-visible:focus-ring",
        selected ? "border-line-input bg-selected text-selected-fg" : "border-line-strong bg-surface text-fg hover:bg-hover",
      )}
    >
      {selected ? <Icon icon={icons.confirm} size="sm" strong /> : null}
      {label}
      {count !== undefined ? <span className="text-caption tabular-nums text-fg-secondary">{count}</span> : null}
    </button>
  );
}

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * The filters that are on, as chips above the list, each with a remove button that says what it
 * removes ("Filter Pro entfernen"). Nothing renders when no filter is on.
 */
export function ActiveFilters({ label, filters, removeLabel, clearLabel, onClear }: { label: string; filters: readonly ActiveFilter[]; removeLabel: (filter: string) => string; clearLabel?: string | undefined; onClear?: (() => void) | undefined }) {
  if (filters.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <span key={filter.key} className="inline-flex h-control-sm items-center gap-1 rounded-full border border-line-strong bg-surface ps-3 text-small">
          {filter.label}
          <button
            type="button"
            onClick={filter.onRemove}
            aria-label={removeLabel(filter.label)}
            className="relative grid size-control-sm place-items-center rounded-full text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring before:absolute before:-inset-2 pointer-fine:before:hidden"
          >
            <Icon icon={icons.close} size="xs" strong />
          </button>
        </span>
      ))}
      {clearLabel && onClear ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {clearLabel}
        </Button>
      ) : null}
    </div>
  );
}
