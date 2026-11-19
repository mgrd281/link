import type { DeviceInfo } from "./types";

/**
 * Device, system and browser from a User-Agent string: enough to tell a customer "iOS · Safari"
 * apart from "Windows · Chrome". Coarse on purpose (no versions); pure, so it runs anywhere.
 */
export function parseUserAgent(ua: string): DeviceInfo {
  const has = (...parts: string[]) => parts.some((part) => ua.includes(part));
  const ipad = has("iPad") || (has("Macintosh") && has("Mobile/"));
  const os = ipad
    ? "iPadOS"
    : has("iPhone", "iPod")
      ? "iOS"
      : has("Android")
        ? "Android"
        : has("Windows")
          ? "Windows"
          : has("Mac OS X", "Macintosh")
            ? "macOS"
            : has("CrOS")
              ? "ChromeOS"
              : has("Linux")
                ? "Linux"
                : "Other";
  const browser = has("SamsungBrowser")
    ? "Samsung Internet"
    : has("Edg/")
      ? "Edge"
      : has("OPR/", "Opera")
        ? "Opera"
        : has("Firefox/", "FxiOS")
          ? "Firefox"
          : has("Chrome/", "CriOS")
            ? "Chrome"
            : has("Safari/")
              ? "Safari"
              : "Other";
  const type = ipad || (has("Android") && !has("Mobile")) ? "tablet" : has("Mobile", "iPhone", "Android") ? "mobile" : "desktop";
  return { type, os, browser };
}
