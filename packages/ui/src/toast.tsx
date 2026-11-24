"use client";

import { tokens } from "@linkyo/tokens";
import { X } from "lucide-react";
import { Toast as T } from "radix-ui";
import { useSyncExternalStore } from "react";

import { Icon } from "./icon";
import { cn } from "./lib/cn";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "danger";
  /** e.g. { label: "Undo", onAction: restore } — verb first. */
  action?: { label: string; onAction: () => void; altText?: string };
  /**
   * The toast is about the last change in an undo history ("Link added · Edit", "Removed · Undo"):
   * once that change is undone or redone some other way (⌘Z), its action would act on a page that
   * has moved on, so `toast.dismiss("undoable")` closes it. Leave it off when the action still has
   * work after ⌘Z (an import's Undo also restores what the history does not hold).
   */
  undoable?: boolean;
}
interface ToastItem extends ToastInput {
  id: number;
  /** False once dismissed: the toast fades out, then the item is purged. */
  open: boolean;
}

/** How long a dismissed toast stays in the list: longer than its fade-out, so the fade is never cut. */
const PURGE_AFTER = 1000;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

/** Show a toast. Returns a function that dismisses it. */
export function toast(input: ToastInput): () => void {
  const id = nextId++;
  // At most three on screen: the two newest open ones and this one. Closing ones finish their fade.
  const keep = new Set(
    items
      .filter((item) => item.open)
      .slice(-2)
      .map((item) => item.id),
  );
  items = [...items.filter((item) => !item.open || keep.has(item.id)), { ...input, id, open: true }];
  emit();
  return () => {
    dismiss(id);
  };
}
/**
 * Closes open toasts: every one, or (`"undoable"`) only those about the last change of an undo
 * history. A sheet that opens closes them all, so none covers its controls; the dashboard closes a
 * change's toast once that change is undone or redone, by whatever route.
 */
toast.dismiss = (which: "all" | "undoable" = "all") => {
  for (const item of items) if (item.open && (which === "all" || item.undoable)) dismiss(item.id);
};
function dismiss(id: number) {
  if (!items.some((item) => item.id === id && item.open)) return;
  items = items.map((item) => (item.id === id ? { ...item, open: false } : item));
  emit();
  setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    emit();
  }, PURGE_AFTER);
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => items;
// One shared empty list: a new array per call makes React re-render forever during hydration.
const NONE: ToastItem[] = [];
const serverSnapshot = () => NONE;

/**
 * `regionLabel` names the notification landmark for screen readers, in the page's language; "{hotkey}"
 * stands for the shortcut that jumps there (F8).
 *
 * The toasts sit over the content column: `--toast-start` and `--toast-end` (set in the app's
 * stylesheet) keep them clear of the dashboard's sidebar and live preview, and they are centred in the
 * space left, at most a prose column wide. `--toast-offset` lifts them above a bottom tab bar.
 *
 * While a sheet is open (the root carries `data-sheet-open`), a toast never covers its controls: on
 * phones, where the sheet rises from the bottom, toasts move to the top of the screen; on wide
 * screens, where it is a panel at the end, they stay in the space before it (`--sheet-inline` is
 * the width the panel and anything beside it take from the end).
 */
export function Toaster({ closeLabel, regionLabel }: { closeLabel: string; regionLabel?: string }) {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <T.Provider swipeDirection="down" duration={tokens.motion.delay.toast}>
      {list.map((item) => (
        <T.Root
          key={item.id}
          open={item.open}
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className={cn(
            "pointer-events-auto flex w-full items-center gap-3 rounded-md bg-fg py-2 ps-4 pe-2 text-fg-inverse",
            // A dismissed toast stays mounted while it fades: it takes no more clicks, so a double-click
            // on Undo undoes once, not twice.
            "motion-safe:animate-rise-in data-[state=closed]:pointer-events-none data-[state=closed]:motion-safe:animate-fade-out",
            "data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y) data-[swipe=end]:hidden",
          )}
        >
          {item.tone && item.tone !== "neutral" ? (
            <span
              aria-hidden
              className={cn("size-dot shrink-0 rounded-full", item.tone === "success" ? "bg-success" : "bg-danger")}
            />
          ) : null}
          <div className="min-w-0 flex-1 py-1">
            <T.Title className="text-small">{item.title}</T.Title>
            {item.description ? (
              <T.Description className="text-small opacity-secondary">{item.description}</T.Description>
            ) : null}
          </div>
          {/* The teal focus ring all but disappears on the near-black toast, so Undo and close draw
              theirs in the toast's own text color. Set on the two controls, not on the toast: the
              toast itself takes focus too (F8), and its ring is drawn outside, on the page. */}
          {item.action ? (
            <T.Action
              altText={item.action.altText ?? item.action.label}
              onClick={item.action.onAction}
              className="h-control-sm shrink-0 rounded-sm px-3 text-small font-semibold text-fg-inverse [--color-focus:var(--color-fg-inverse)] hover:bg-hover-inverse focus-visible:focus-ring"
            >
              {item.action.label}
            </T.Action>
          ) : null}
          <T.Close
            aria-label={closeLabel}
            className="grid size-control-sm shrink-0 place-items-center rounded-sm opacity-secondary [--color-focus:var(--color-fg-inverse)] hover:opacity-100 focus-visible:opacity-100 focus-visible:focus-ring"
          >
            <Icon icon={X} size="sm" />
          </T.Close>
        </T.Root>
      ))}
      <T.Viewport
        {...(regionLabel ? { label: regionLabel } : {})}
        className={cn(
          "layer-toast fixed start-(--toast-start) end-(--toast-end) bottom-(--toast-offset) mx-auto flex max-w-prose flex-col gap-2 p-4 pb-[max(var(--spacing-4),var(--toast-inset,env(safe-area-inset-bottom)))] outline-none",
          // An open sheet: on phones at the top, above the sheet; on wide screens in the space before its panel.
          "max-lg:in-data-sheet-open:top-0 max-lg:in-data-sheet-open:bottom-auto max-lg:in-data-sheet-open:p-2 max-lg:in-data-sheet-open:pt-[max(var(--spacing-2),env(safe-area-inset-top))]",
          "lg:in-data-sheet-open:start-0 lg:in-data-sheet-open:end-(--sheet-inline)",
        )}
      />
    </T.Provider>
  );
}
