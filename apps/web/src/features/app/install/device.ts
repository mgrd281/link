/**
 * Which way to install Linkyo works on this device, so the install sheet shows only that one:
 *
 * - `installed`: Linkyo runs as the installed app (display mode standalone, or iOS's `navigator.standalone`),
 *   or was installed from this page a moment ago.
 * - `prompt`: Chrome, Edge or Samsung Internet (Windows, Mac, Linux, Android) offered to install it
 *   (`beforeinstallprompt`): one button opens the browser's own install dialog.
 * - `later`: that offer was declined in this page load; the browser's menu still has it.
 * - `ios`: iPhone and iPad (Safari, and since iOS 16.4 any browser there): Share › Add to Home Screen.
 * - `macSafari`: Safari 17 or newer on a Mac: File › Add to Dock.
 * - `other`: none of these (Firefox on a computer, an older Safari, a browser that has not offered it).
 */
export type InstallVariant = "installed" | "prompt" | "later" | "ios" | "macSafari" | "other";

export interface DeviceFacts {
  /** The page is shown as an installed app. */
  standalone: boolean;
  /** `appinstalled` fired in this page load. */
  installed: boolean;
  /** The browser's install offer is waiting. */
  canPrompt: boolean;
  /** The offer was shown and declined in this page load. */
  declined: boolean;
  userAgent: string;
  maxTouchPoints: number;
}

/** iPhone, iPod and iPad; iPadOS's Safari calls itself a Mac, but a Mac has no touch screen. */
export const isIos = (userAgent: string, maxTouchPoints: number): boolean => /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1);

/** Safari on a Mac from version 17 (macOS Sonoma), which can add a site to the Dock. */
export function isMacSafari(userAgent: string, maxTouchPoints: number): boolean {
  if (!userAgent.includes("Macintosh") || maxTouchPoints > 1 || !userAgent.includes("Safari/")) return false;
  if (/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(userAgent)) return false;
  return Number(/Version\/(\d+)/.exec(userAgent)?.[1] ?? 0) >= 17;
}

export function installVariant(facts: DeviceFacts): InstallVariant {
  if (facts.standalone || facts.installed) return "installed";
  if (facts.canPrompt) return "prompt";
  if (facts.declined) return "later";
  if (isIos(facts.userAgent, facts.maxTouchPoints)) return "ios";
  if (isMacSafari(facts.userAgent, facts.maxTouchPoints)) return "macSafari";
  return "other";
}
