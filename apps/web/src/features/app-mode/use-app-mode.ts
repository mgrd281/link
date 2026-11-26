"use client";

import { useSyncExternalStore } from "react";

import { inAppMode } from "./app-mode";

/** The app sets `<html data-app>` before the page's first script and never changes it. */
const subscribe = () => () => undefined;

/**
 * True inside Linkyo's app. For parts that must not exist there at all (a link to a purchase page, a
 * price inside a sentence); everything else hides through CSS (`data-app-hide`), which is right from
 * the first paint. False while the server renders and during hydration, so a server-rendered part
 * would show for a moment: use it in the dashboard's screens, which render in the browser only, behind
 * `AppGate`'s splash, and so know the answer on their first render.
 */
export function useAppMode(): boolean {
  return useSyncExternalStore(subscribe, inAppMode, () => false);
}
