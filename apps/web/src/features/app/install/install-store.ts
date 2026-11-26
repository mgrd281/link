"use client";

import { useSyncExternalStore } from "react";

import { INSTALL_CHANGE_EVENT, INSTALL_PROMPT_KEY, INSTALLED_KEY } from "@/lib/install-prompt-script";

import { installVariant, type InstallVariant } from "./device";

/**
 * The browser's offer to install Linkyo, kept by the head script of every page (lib/install-prompt-script.ts),
 * and whether Linkyo already runs as the app. The install sheet and Home's hint read it here.
 */

/** Chrome's install offer (not in TypeScript's DOM types). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallWindow = Window & {
  [INSTALL_PROMPT_KEY]?: InstallPromptEvent | null;
  [INSTALLED_KEY]?: boolean;
};

/** Declined in this page load: the offer is used up until the next one. */
let declined = false;

/**
 * Shown as an installed app: standalone (and the other app display modes), or iOS's home-screen web app.
 * Not `fullscreen`: a normal tab matches it while the browser window is in F11 fullscreen.
 */
const APP_DISPLAY = "(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)";

const notify = () => window.dispatchEvent(new Event(INSTALL_CHANGE_EVENT));

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(APP_DISPLAY);
  window.addEventListener(INSTALL_CHANGE_EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(INSTALL_CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

function readVariant(): InstallVariant {
  const own = window as InstallWindow;
  return installVariant({
    standalone: window.matchMedia(APP_DISPLAY).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    installed: own[INSTALLED_KEY] === true,
    canPrompt: Boolean(own[INSTALL_PROMPT_KEY]),
    declined,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

/** This device's way to install Linkyo; null while the server renders (it cannot know). */
export function useInstallVariant(): InstallVariant | null {
  return useSyncExternalStore(subscribe, readVariant, () => null);
}

/**
 * Opens the browser's own install dialog (the offer can be used once). Accepted, the sheet says Linkyo
 * is installed; declined, it says where the browser's menu still offers it.
 */
export async function installApp(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const own = window as InstallWindow;
  const offer = own[INSTALL_PROMPT_KEY];
  if (!offer) return "unavailable";
  own[INSTALL_PROMPT_KEY] = null;
  try {
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    if (outcome === "accepted") own[INSTALLED_KEY] = true;
    else declined = true;
    return outcome;
  } catch {
    declined = true;
    return "dismissed";
  } finally {
    notify();
  }
}
