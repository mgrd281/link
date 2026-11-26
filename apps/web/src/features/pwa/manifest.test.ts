import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { tokens } from "@linkyo/tokens";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { TAB_HREF } from "@/features/app/routes";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { APP_ID, appManifest, MANIFEST_SCREENSHOTS, type AppManifest, type ManifestKey } from "./manifest";
import { pngSize } from "./png";

/**
 * Each language's web app manifest, built as `/<locale>/manifest.webmanifest` serves it and parsed
 * back from its JSON: every field the installed app relies on, the icons and screenshots it names
 * (on disk, at their sizes, screenshots under 300 KB), and the same app id in every language.
 */
const FILES = { de, en, ar } as const;
type Locale = keyof typeof FILES;
const LOCALES = Object.keys(FILES) as Locale[];
const PUBLIC = path.resolve(import.meta.dirname, "../../../public");

function manifest(locale: Locale): AppManifest {
  const t = createTranslator({ locale, messages: FILES[locale], namespace: "pwa" }) as unknown as (key: ManifestKey) => string;
  return JSON.parse(JSON.stringify(appManifest(locale, t))) as AppManifest;
}

/** Width and height of a baseline or progressive JPEG (its SOF segment). */
function jpegSize(file: Buffer): { width: number; height: number } {
  for (let at = 2; at < file.length; ) {
    const marker = file[at + 1] ?? 0;
    const length = file.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: file.readUInt16BE(at + 5), width: file.readUInt16BE(at + 7) };
    at += 2 + length;
  }
  throw new Error("no SOF segment");
}

describe.each(LOCALES)("the %s manifest", (locale) => {
  const m = manifest(locale);
  const t = createTranslator({ locale, messages: FILES[locale], namespace: "pwa" });

  it("names the app, its language and its direction", () => {
    expect(m.id).toBe(APP_ID);
    expect(m.name).toBe("Linkyo");
    expect(m.short_name).toBe(t("shortName"));
    expect(m.description).toBe(t("description"));
    expect(m.description?.length).toBeGreaterThan(20);
    expect(m.lang).toBe(locale);
    expect(m.dir).toBe(locale === "ar" ? "rtl" : "ltr");
  });

  it("opens the dashboard in this language, in its own window, focusing a window that is already open", () => {
    expect(m.start_url).toBe(`/${locale}/app?source=app`);
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    // Without a title bar drawn by the page, window-controls-overlay is not asked for.
    expect(m).not.toHaveProperty("display_override");
    expect(m.launch_handler).toEqual({ client_mode: "focus-existing" });
    expect(m.categories).toEqual(expect.arrayContaining(["social", "productivity"]));
  });

  it("takes its colours from the dashboard's grey ground (console palette)", () => {
    expect(m.theme_color).toBe(tokens.semantic.canvasMuted.console.light);
    expect(m.background_color).toBe(tokens.semantic.canvasMuted.console.light);
  });

  it("lists the icons: 192 and 512 for any use, a maskable 512 and a monochrome one, each on disk at its size", () => {
    const icons = m.icons ?? [];
    expect(icons.map((icon) => `${icon.sizes ?? ""} ${icon.purpose ?? ""}`)).toEqual(["192x192 any", "512x512 any", "512x512 maskable", "512x512 monochrome"]);
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      const [width, height] = (icon.sizes ?? "").split("x").map(Number);
      expect(pngSize(readFileSync(path.join(PUBLIC, icon.src))), icon.src).toEqual({ width, height });
    }
  });

  it("offers four shortcuts into the dashboard, named in this language", () => {
    const shortcuts = m.shortcuts ?? [];
    expect(shortcuts.map((shortcut) => shortcut.name)).toEqual([t("shortcuts.editor"), t("shortcuts.add"), t("shortcuts.analytics"), t("shortcuts.share")]);
    expect(shortcuts.map((shortcut) => shortcut.url)).toEqual([`/${locale}${TAB_HREF.page}`, `/${locale}/app?add=1`, `/${locale}${TAB_HREF.analytics}`, `/${locale}/app#home-link`]);
    for (const shortcut of shortcuts) expect(shortcut.description?.length).toBeGreaterThan(5);
  });

  it("shows the dashboard and a creator page, on a phone and on a laptop, in this language, each picture on disk at its size and under 300 KB", () => {
    expect(m.screenshots.map((shot) => shot.form_factor)).toEqual(["narrow", "narrow", "wide", "wide"]);
    // This language's own set: its words on the dashboard and the page, mirrored in Arabic.
    for (const shot of m.screenshots) expect(shot.src).toMatch(new RegExp(`^/screenshots/${locale}/[\\w-]+\\.jpg$`));
    expect(m.screenshots.map((shot) => shot.label)).toEqual([t("screenshots.dashboard"), t("screenshots.page"), t("screenshots.dashboard"), t("screenshots.page")]);
    for (const shot of m.screenshots) {
      const file = path.join(PUBLIC, shot.src);
      expect(existsSync(file), shot.src).toBe(true);
      expect(shot.type).toBe("image/jpeg");
      const [width = 0, height = 0] = shot.sizes.split("x").map(Number);
      expect(jpegSize(readFileSync(file)), shot.src).toEqual({ width, height });
      expect(statSync(file).size, shot.src).toBeLessThan(300_000);
      // Chrome's richer install dialog: narrow is taller than wide, wide wider than tall, at most 2.3 : 1.
      expect(shot.form_factor === "narrow" ? height > width : width > height).toBe(true);
      expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(2.3);
    }
  });

  it("receives shared links with a GET to this language's share route", () => {
    expect(m.share_target).toEqual({ action: `/${locale}/app/share`, method: "GET", enctype: "application/x-www-form-urlencoded", params: { title: "title", text: "text", url: "url" } });
  });
});

it("shows each language its own pictures, not copies of one set", () => {
  for (const { file } of MANIFEST_SCREENSHOTS) {
    const digests = LOCALES.map((locale) => createHash("sha256").update(readFileSync(path.join(PUBLIC, "screenshots", locale, file))).digest("hex"));
    expect(new Set(digests).size, file).toBe(LOCALES.length);
  }
  // The shared set of the first version is gone.
  for (const { file } of MANIFEST_SCREENSHOTS) expect(existsSync(path.join(PUBLIC, "screenshots", file)), file).toBe(false);
});

it("is one app in every language: same id and scope, different start", () => {
  const all = LOCALES.map((locale) => manifest(locale));
  expect(new Set(all.map((m) => m.id)).size).toBe(1);
  expect(new Set(all.map((m) => m.scope)).size).toBe(1);
  expect(new Set(all.map((m) => m.start_url)).size).toBe(LOCALES.length);
});
