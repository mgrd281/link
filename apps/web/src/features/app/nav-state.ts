"use client";

import { useCallback, useSyncExternalStore } from "react";

import { NAV_PANEL_STORAGE_KEY } from "@/lib/nav-panel-script";

/*
 * Whether the section panel is folded. The truth is `<html data-nav-panel>`: the pre-paint script sets
 * it from storage, CSS lays out the frame from it (`nav-folded:`), and React only mirrors it for the
 * toggle's `aria-expanded` and icon. So the width never depends on a render.
 */

const read = () => document.documentElement.dataset.navPanel === "folded";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-nav-panel"] });
  return () => observer.disconnect();
}

export function useNavPanel(): { open: boolean; toggle: () => void } {
  // The server renders the splash only, with the panel open; the shell mounts in the browser.
  const folded = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => {
    const next = read() ? "open" : "folded";
    document.documentElement.dataset.navPanel = next;
    // "open" is stored too, so a later default can never override an explicit choice.
    try {
      window.localStorage.setItem(NAV_PANEL_STORAGE_KEY, next);
    } catch {
      // Storage is blocked (private mode, settings): this tab still remembers until it reloads.
    }
  }, []);
  return { open: !folded, toggle };
}
