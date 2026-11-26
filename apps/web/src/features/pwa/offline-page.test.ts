import { readFileSync } from "node:fs";
import path from "node:path";

import { tokens } from "@linkyo/tokens";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { monoSymbol, offlinePage, type OfflineKey } from "./offline-page";

/**
 * The offline page the service worker keeps: in each language and direction, self-contained (nothing
 * from the network), in the dashboard's black and grey for light and dark, with the Linkyo symbol in
 * its mono tone and a working "try again".
 */
const FILES = { de, en, ar } as const;
const FAVICON = readFileSync(path.resolve(import.meta.dirname, "../../../public/favicon.svg"), "utf8");

describe.each(Object.keys(FILES) as (keyof typeof FILES)[])("the %s offline page", (locale) => {
  const t = createTranslator({ locale, messages: FILES[locale], namespace: "pwa.offline" }) as unknown as (key: OfflineKey) => string;
  const html = offlinePage(locale, t, FAVICON);

  it("is in this language and direction, with its title, sentence and button", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">`);
    expect(html).toContain(`<title>${t("title")} · Linkyo</title>`);
    expect(html).toContain(`<h1>${t("title")}</h1>`);
    expect(html).toContain(`<p>${t("body")}</p>`);
    expect(html).toContain(`<button type="button" id="retry">${t("retry")}</button>`);
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it("needs nothing from the network", () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<link\b|\bsrc=|@import|url\(/);
  });

  it("draws with the console palette, light and dark (the stored choice too)", () => {
    for (const mode of ["light", "dark"] as const) {
      expect(html).toContain(`--ground:${tokens.semantic.canvasMuted.console[mode]}`);
      expect(html).toContain(`--primary:${tokens.semantic.primary.console[mode]}`);
      expect(html).toContain(`content="${tokens.semantic.canvasMuted.console[mode]}"`);
    }
    expect(html).toContain("@media (prefers-color-scheme: dark){:root:not([data-theme=light])");
    expect(html).toContain(":root[data-theme=dark]");
    expect(html).toContain('localStorage.getItem("ly-theme")');
    // Linkyo is flat and links have no line under them.
    expect(html).not.toMatch(/shadow|underline/);
  });

  it("tries again on the button and when the device is back online", () => {
    expect(html).toContain('getElementById("retry").addEventListener("click",r)');
    expect(html).toContain('addEventListener("online",r)');
  });
});

it("recolours the brand's symbol into the dashboard's mono tone", () => {
  const symbol = monoSymbol(FAVICON);
  expect(symbol).toMatch(/^<svg class="symbol" viewBox="0 0 32 32" aria-hidden="true" focusable="false">/);
  expect(symbol.match(/class="tile"/g)).toHaveLength(1);
  expect(symbol.match(/class="tile-stroke"/g)).toHaveLength(1);
  expect(symbol.match(/class="cut"/g)).toHaveLength(2);
  // No colour of the brand file is left: the page's styles colour it.
  expect(symbol).not.toMatch(/#[0-9a-f]{6}/i);
});
