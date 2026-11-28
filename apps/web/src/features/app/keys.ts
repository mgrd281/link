import { useSyncExternalStore } from "react";

/*
 * The dashboard's keyboard shortcuts (D-15): which key presses open the ⌘K palette and the "?" list,
 * and how each shortcut is written on this device: ⌘ on a Mac (and an iPad with a keyboard), Ctrl
 * elsewhere. The shortcuts themselves live where they act (site-context.tsx: undo and redo;
 * editor-screen.tsx: moving a block); this list only names them, so it must stay true to them.
 */

/** True on Apple's platforms, which name the modifier ⌘ (Command) and Alt ⌥ (Option). */
export const isApplePlatform = (platform: string): boolean => /mac|iphone|ipad|ipod/i.test(platform);

/** The platform as the browser names it ("macOS", "MacIntel", "Win32", "Linux x86_64"). */
export function currentPlatform(): string {
  if (typeof navigator === "undefined") return "";
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  // An empty name counts as none.
  if (data?.platform) return data.platform;
  return navigator.platform;
}

const subscribeNever = () => () => undefined;

/** Whether this browser runs on an Apple platform (⌘), read once in the browser; false on the server. */
export const useApplePlatform = (): boolean => useSyncExternalStore(subscribeNever, () => isApplePlatform(currentPlatform()), () => false);

export const SHORTCUTS = ["palette", "shortcuts", "undo", "redo", "moveUp", "moveDown", "close"] as const;
export type ShortcutId = (typeof SHORTCUTS)[number];

/** The keys of a shortcut, one chip each, as this platform writes them. */
export function shortcutKeys(id: ShortcutId, apple: boolean): string[] {
  const mod = apple ? "⌘" : "Ctrl";
  switch (id) {
    case "palette":
      return [mod, "K"];
    case "shortcuts":
      return ["?"];
    case "undo":
      return [mod, "Z"];
    case "redo":
      // site-context.tsx takes both ⇧⌘Z and ⌘Y / Ctrl+Y; each platform's usual one is named.
      return apple ? ["⇧", "⌘", "Z"] : ["Ctrl", "Y"];
    case "moveUp":
      return [apple ? "⌥" : "Alt", "↑"];
    case "moveDown":
      return [apple ? "⌥" : "Alt", "↓"];
    case "close":
      return ["Esc"];
  }
}

/** A shortcut as one short text for a tooltip or a hint: "⌘K" on a Mac, "Ctrl+K" elsewhere. */
export const shortcutText = (id: ShortcutId, apple: boolean): string => shortcutKeys(id, apple).join(apple ? "" : "+");

interface KeyPress {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * ⌘K / Ctrl+K: by the key's letter, or by its place on the keyboard (`KeyK`), so it also works where
 * that key types another letter (the Arabic layout's "ن").
 */
export const isPaletteKey = (event: KeyPress): boolean =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && (event.key.toLowerCase() === "k" || event.code === "KeyK");

/** "?" (and the Arabic "؟"), typed without ⌘, Ctrl or Alt. */
export const isShortcutsKey = (event: KeyPress): boolean => (event.key === "?" || event.key === "؟") && !event.metaKey && !event.ctrlKey && !event.altKey;

/** Where a key press is typing, not a shortcut: a field, a text area, a select or editable text. */
export function isTyping(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** A dialog or sheet that is open now (Radix keeps a closing one with data-state="closed" for its exit). */
export const openDialog = (except?: Element | null): boolean =>
  [...document.querySelectorAll("[role=dialog]:not([data-state=closed]), [role=alertdialog]")].some((dialog) => dialog !== except);
