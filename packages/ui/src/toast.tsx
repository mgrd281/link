"use client";

import { tokens } from "@linkyo/tokens";
import { X } from "lucide-react";
import { Toast as T } from "radix-ui";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { Icon } from "./icon";
import { cn } from "./lib/cn";
import { pickToastSide, type Box, type ToastSide } from "./toast-placement";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "danger";
  /** e.g. { label: "Undo", onAction: restore } — verb first. */
  action?: { label: string; onAction: () => void; altText?: string };
  /**
   * The toast is about one change in an undo history ("Link added · Edit", "Removed · Undo"):
   * `before` is the document the change was made from (compared by identity). Once that change is
   * undone some other way (⌘Z), its action would act on a page that has moved on, so
   * `toast.settle({ undone: before })` closes it, and only it. `latestOnly`: the action is a plain
   * "undo the last change", right only while no other change followed, so any later change
   * (`toast.settle({ moved: true })`) closes it too. Leave `undoable` off when the action still has
   * work after ⌘Z (an import's Undo also restores what the history does not hold).
   */
  undoable?: UndoableChange;
}
export interface UndoableChange {
  before: object;
  latestOnly?: boolean;
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
/** Closes every open toast: a sheet that opens closes them all, so none covers its controls. */
toast.dismiss = () => {
  for (const item of items) if (item.open) dismiss(item.id);
};
/**
 * Closes the toasts of changes that no longer stand as they did. `undone`: an undo brought this
 * document back, so the toasts of the change made from it go (no other toast: a removed block's
 * "Undo" still puts that block back after a later change was undone). `moved`: the document changed
 * in another way, so a toast whose action is a plain "undo the last change" would now undo that one
 * instead (`latestOnly`).
 */
toast.settle = (event: { undone: object } | { moved: true }) => {
  for (const item of items) {
    if (!item.open || !item.undoable) continue;
    if ("undone" in event ? item.undoable.before === event.undone : item.undoable.latestOnly) dismiss(item.id);
  }
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

/** What a thumb or a key can use: the controls a toast could cover. */
const CONTROLS =
  "a[href], button, summary, select, textarea, input:not([type=hidden]), label:has(input), [role=button], [role=tab], [role=switch], [role=radio], [role=checkbox], [role=menuitem], [role=link]";

/** A toast follows a press for this long (ms): the control used within that time is the one it must not cover. */
const USED_FOR = 5000;
const PHONE = `(width < ${String(tokens.breakpoint.lg / 16)}rem)`;

/** The control used last, by pointer or by Enter or Space (a module-level note: any press anywhere in the app). */
let used: { element: Element; at: number } | null = null;
let noting = false;
function noteUse() {
  if (noting) return;
  noting = true;
  const note = (event: Event) => {
    const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null;
    used = control ? { element: control, at: Date.now() } : null;
  };
  document.addEventListener("pointerdown", note, true);
  document.addEventListener("keydown", (event) => (event.key === "Enter" || event.key === " " ? note(event) : undefined), true);
}

/** Where the toasts stand now (see Toaster): a store, so the Toaster draws it and the measuring only decides it. */
let placed: ToastSide = "bottom";
const sideListeners = new Set<() => void>();
const placeAt = (next: ToastSide) => {
  if (placed === next) return;
  placed = next;
  for (const listener of sideListeners) listener();
};
const subscribeSide = (listener: () => void) => {
  sideListeners.add(listener);
  return () => sideListeners.delete(listener);
};

const boxOf = (element: Element): Box => {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return { left, top, right, bottom };
};
const union = (boxes: Box[]): Box | null =>
  boxes.length === 0
    ? null
    : { left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) };

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
 * screens, where it is a panel, they stay in the free space the app names with `--sheet-toast-start`
 * and `--sheet-toast-end` (before the panel, or after it when the space before is too narrow).
 *
 * On a phone without a sheet an app that names the top of its screen (`--toast-top`, under its bar)
 * lets a toast stand there too: it starts at the bottom, above the tab bar, and takes the top when
 * the bottom would cover the control that was just pressed or more controls than the top, and never
 * the parts marked `data-toast-avoid` (a preview that shows what the press did). See `pickToastSide`.
 */
export function Toaster({ closeLabel, regionLabel }: { closeLabel: string; regionLabel?: string }) {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const side = useSyncExternalStore(subscribeSide, () => placed, () => "bottom" as const);
  const viewport = useRef<HTMLOListElement>(null);
  const showing = list.some((item) => item.open);
  const wasShowing = useRef(false);
  useEffect(noteUse, []);
  // Decided once, when the first toast of a run appears and before it is painted: the measuring below
  // puts the stack at each side in turn and puts it back, so nothing flashes.
  useLayoutEffect(() => {
    const fresh = showing && !wasShowing.current;
    wasShowing.current = showing;
    if (list.length === 0) placeAt("bottom");
    const stack = viewport.current;
    if (!fresh || !stack) return;
    const root = document.documentElement;
    const sheet = root.dataset.sheetOpen !== undefined;
    // Only where the app says its top is free (the dashboard on a phone), and a sheet already has its own rule.
    if (sheet || !window.matchMedia(PHONE).matches || !getComputedStyle(root).getPropertyValue("--toast-top").trim()) {
      placeAt("bottom");
      return;
    }
    const band = () => union([...stack.querySelectorAll("li")].map(boxOf));
    stack.dataset.side = "bottom";
    const bottom = band();
    stack.dataset.side = "top";
    const top = band();
    stack.dataset.side = placed;
    if (!bottom || !top) return;
    const visible = (box: Box) => box.right > box.left && box.bottom > box.top && box.bottom > 0 && box.top < window.innerHeight;
    const controls = [...document.querySelectorAll(CONTROLS)]
      .filter((control) => !stack.contains(control) && !control.closest("[inert]"))
      .map(boxOf)
      .filter(visible);
    const lastUsed = used && used.element.isConnected && Date.now() - used.at < USED_FOR ? boxOf(used.element) : null;
    const keepClear = [...document.querySelectorAll("[data-toast-avoid]")].map(boxOf).filter(visible);
    placeAt(pickToastSide({ bands: { bottom, top }, controls, used: lastUsed, keepClear }));
  }, [list, showing]);
  return (
    <T.Provider swipeDirection={side === "top" ? "up" : "down"} duration={tokens.motion.delay.toast}>
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
              // 32 px to see, a 48 px tall target on touch screens (the hit area grows 8 px above and below).
              className="relative h-control-sm shrink-0 rounded-sm px-3 text-small font-semibold text-fg-inverse before:absolute before:inset-x-0 before:-inset-y-2 pointer-fine:before:hidden [--color-focus:var(--color-fg-inverse)] hover:bg-hover-inverse focus-visible:focus-ring"
            >
              {item.action.label}
            </T.Action>
          ) : null}
          <T.Close
            aria-label={closeLabel}
            // 32 px to see, 48 × 48 px on touch screens: the hit area grows 8 px on every side, and stays
            // clear of the action beside it (12 px away).
            className="relative grid size-control-sm shrink-0 place-items-center rounded-sm opacity-secondary before:absolute before:-inset-2 pointer-fine:before:hidden [--color-focus:var(--color-fg-inverse)] hover:opacity-100 focus-visible:opacity-100 focus-visible:focus-ring"
          >
            <Icon icon={X} size="sm" />
          </T.Close>
        </T.Root>
      ))}
      <T.Viewport
        ref={viewport}
        data-side={side}
        {...(regionLabel ? { label: regionLabel } : {})}
        className={cn(
          "layer-toast fixed start-(--toast-start) end-(--toast-end) bottom-(--toast-offset) mx-auto flex max-w-prose flex-col gap-2 p-4 pb-[max(var(--spacing-4),var(--toast-inset,env(safe-area-inset-bottom)))] outline-none",
          // On a phone, under the app's top bar, when the bottom would cover what was just pressed (see above).
          "max-lg:data-[side=top]:top-(--toast-top) max-lg:data-[side=top]:bottom-auto max-lg:data-[side=top]:p-2",
          // An open sheet: on phones at the top, above the sheet; on wide screens in the space before its panel.
          "max-lg:in-data-sheet-open:top-0 max-lg:in-data-sheet-open:bottom-auto max-lg:in-data-sheet-open:p-2 max-lg:in-data-sheet-open:pt-[max(var(--spacing-2),env(safe-area-inset-top))]",
          "lg:in-data-sheet-open:start-(--sheet-toast-start) lg:in-data-sheet-open:end-(--sheet-toast-end)",
        )}
      />
    </T.Provider>
  );
}
