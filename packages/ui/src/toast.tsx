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
}
interface ToastItem extends ToastInput {
  id: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

/** Show a toast. Returns a function that dismisses it. */
export function toast(input: ToastInput): () => void {
  const id = nextId++;
  items = [...items.slice(-2), { ...input, id }];
  emit();
  return () => {
    dismiss(id);
  };
}
function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => items;
// One shared empty list: a new array per call makes React re-render forever during hydration.
const NONE: ToastItem[] = [];
const serverSnapshot = () => NONE;

export function Toaster({ closeLabel }: { closeLabel: string }) {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (
    <T.Provider swipeDirection="down" duration={tokens.motion.delay.toast}>
      {list.map((item) => (
        <T.Root
          key={item.id}
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className={cn(
            "pointer-events-auto flex w-full items-center gap-3 rounded-md bg-fg py-2 ps-4 pe-2 text-fg-inverse",
            "motion-safe:animate-rise-in data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y) data-[swipe=end]:hidden",
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
          {item.action ? (
            <T.Action
              altText={item.action.altText ?? item.action.label}
              onClick={item.action.onAction}
              className="h-control-sm shrink-0 rounded-sm px-3 text-small font-semibold text-fg-inverse hover:bg-hover-inverse focus-visible:focus-ring"
            >
              {item.action.label}
            </T.Action>
          ) : null}
          <T.Close
            aria-label={closeLabel}
            className="grid size-control-sm shrink-0 place-items-center rounded-sm opacity-secondary hover:opacity-100 focus-visible:focus-ring"
          >
            <Icon icon={X} size="sm" />
          </T.Close>
        </T.Root>
      ))}
      <T.Viewport className="layer-toast fixed inset-x-0 bottom-(--toast-offset) mx-auto flex w-full max-w-prose flex-col gap-2 p-4 outline-none" />
    </T.Provider>
  );
}
