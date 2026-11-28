import { describe, expect, it } from "vitest";

import { isApplePlatform, isPaletteKey, isShortcutsKey, shortcutKeys, shortcutText, SHORTCUTS } from "./keys";

const press = (key: string, extra: Partial<{ code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...extra,
});

describe("the dashboard's shortcuts (D-15)", () => {
  it("knows Apple's platforms", () => {
    for (const platform of ["macOS", "MacIntel", "iPhone", "iPad"]) expect(isApplePlatform(platform), platform).toBe(true);
    for (const platform of ["Windows", "Win32", "Linux x86_64", "Android", "Chrome OS", ""]) expect(isApplePlatform(platform), platform).toBe(false);
  });

  it("writes ⌘ on a Mac and Ctrl elsewhere", () => {
    expect(shortcutText("palette", true)).toBe("⌘K");
    expect(shortcutText("palette", false)).toBe("Ctrl+K");
    expect(shortcutText("undo", true)).toBe("⌘Z");
    expect(shortcutText("undo", false)).toBe("Ctrl+Z");
    expect(shortcutText("redo", true)).toBe("⇧⌘Z");
    expect(shortcutText("redo", false)).toBe("Ctrl+Y");
    expect(shortcutKeys("moveUp", true)).toEqual(["⌥", "↑"]);
    expect(shortcutKeys("moveDown", false)).toEqual(["Alt", "↓"]);
    expect(shortcutText("shortcuts", false)).toBe("?");
    for (const id of SHORTCUTS) for (const apple of [true, false]) expect(shortcutKeys(id, apple).length, id).toBeGreaterThan(0);
  });

  it("opens the palette on ⌘K and Ctrl+K, also where K types another letter, and on nothing else", () => {
    expect(isPaletteKey(press("k", { metaKey: true }))).toBe(true);
    expect(isPaletteKey(press("K", { ctrlKey: true }))).toBe(true);
    expect(isPaletteKey(press("ن", { ctrlKey: true, code: "KeyK" }))).toBe(true);
    expect(isPaletteKey(press("k"))).toBe(false);
    expect(isPaletteKey(press("k", { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteKey(press("k", { metaKey: true, altKey: true }))).toBe(false);
    expect(isPaletteKey(press("j", { metaKey: true, code: "KeyJ" }))).toBe(false);
  });

  it("opens the list on ? and the Arabic ؟, never with a modifier", () => {
    expect(isShortcutsKey(press("?", { shiftKey: true }))).toBe(true);
    expect(isShortcutsKey(press("؟", { shiftKey: true }))).toBe(true);
    expect(isShortcutsKey(press("?", { metaKey: true }))).toBe(false);
    expect(isShortcutsKey(press("/"))).toBe(false);
  });
});
