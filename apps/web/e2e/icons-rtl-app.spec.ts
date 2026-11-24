import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Frame, type Page } from "@playwright/test";
// eslint-disable-next-line no-restricted-imports -- looks DIRECTIONAL glyphs up by name to read their class names; draws nothing
import * as lucide from "lucide-react";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ar from "../src/messages/ar.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * Right to left, every directional icon is mirrored exactly once (S2.Z codemod, critique 16). `Icon`
 * mirrors the glyphs in `DIRECTIONAL` (packages/ui/src/icons.ts) by itself, so a hand-written flip on
 * the icon's button, link or any other wrapper would turn it back. This loads the main screens in
 * Arabic and, for every such glyph, multiplies out the computed `scale`, `rotate` and `transform` of
 * the svg and of each element above it (up to the document), counting the elements that mirror it
 * (a negative determinant). Right to left that count must be 1; inside a left-to-right island (a
 * German example in the gallery) and for a glyph told not to mirror (`data-icon-dir="fixed"`) it
 * must be 0.
 *
 * Glyphs are found two ways: `Icon` marks every directional glyph (`data-icon-dir`), and lucide's own
 * class names catch a directional glyph drawn without `Icon`. Laufbahn and the private previews are
 * not loaded here.
 *
 * With ICONS_RTL_SHOTS=<dir>, the phone run also saves a screenshot of each screen and a sheet of
 * every directional glyph it can see, cut out with its button or link, to look at the arrows.
 */

const TEAM_CODE = "linkyo-team-4827";
const SHOTS = process.env.ICONS_RTL_SHOTS;

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** lucide's own class name (`lucide-<name>`) of every glyph in DIRECTIONAL. */
const DIRECTIONAL_CLASSES: string[] = (() => {
  const source = readFileSync(path.resolve(import.meta.dirname, "../../../packages/ui/src/icons.ts"), "utf8");
  const start = source.indexOf("export const DIRECTIONAL");
  const names = [...source.slice(start, source.indexOf("]);", start)).matchAll(/^\s+([A-Z][A-Za-z0-9]+),$/gm)].map((match) => match[1] ?? "");
  const exports = lucide as unknown as Record<string, ComponentType | undefined>;
  return names.map((name) => {
    const glyph = exports[name];
    if (!glyph) throw new Error(`lucide-react has no ${name}`);
    // The first class after "lucide" is the glyph's own name; the ones after it are its aliases.
    const classes = /class="([^"]*)"/.exec(renderToStaticMarkup(createElement(glyph)))?.[1]?.split(" ") ?? [];
    return classes[1] ?? "";
  });
})();

interface Glyph {
  index: number;
  glyph: string;
  /** Where it sits: the name of its button or link, or its parent's tag. */
  where: string;
  marked: string | null;
  direction: string;
  flips: number;
  expected: number;
  visible: boolean;
}

/** Counts, for every directional glyph in a frame, how many elements mirror it. */
function census(frame: Frame, classes: string[]): Promise<Glyph[]> {
  return frame.evaluate((names) => {
    const directional = new Set(names);
    const linear = (element: Element): DOMMatrix => {
      const style = getComputedStyle(element);
      let matrix = new DOMMatrix();
      // CSS applies translate, rotate and scale before transform; translation does not mirror.
      if (style.rotate && style.rotate !== "none") {
        const parts = style.rotate.split(" ");
        const angle = Number.parseFloat(parts.at(-1) ?? "0");
        const axis = parts.length === 4 ? parts.slice(0, 3).map(Number) : parts.length === 2 ? { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[parts[0] ?? "z"] : [0, 0, 1];
        const [x = 0, y = 0, z = 1] = axis ?? [0, 0, 1];
        matrix = matrix.rotateAxisAngle(x, y, z, angle);
      }
      if (style.scale && style.scale !== "none") {
        const [sx = 1, sy = sx, sz = 1] = style.scale.split(" ").map(Number);
        matrix = matrix.scale(sx, sy, sz);
      }
      if (style.transform && style.transform !== "none") matrix = matrix.multiply(new DOMMatrix(style.transform));
      return matrix;
    };
    const mirrors = (element: Element) => {
      const m = linear(element);
      return m.a * m.d - m.b * m.c < 0;
    };
    const svgs = [...document.querySelectorAll("svg")].filter(
      (svg) => svg.hasAttribute("data-icon-dir") || svg.hasAttribute("data-mirror") || (svg.classList[0] === "lucide" && directional.has(svg.classList[1] ?? "")),
    );
    return svgs.map((svg, index) => {
      let flips = 0;
      for (let element: Element | null = svg; element; element = element.parentElement) if (mirrors(element)) flips++;
      const direction = getComputedStyle(svg).direction;
      const marked = svg.getAttribute("data-icon-dir");
      const owner = svg.closest("a, button, [role=button], [role=link], [role=menuitem], [role=tab]");
      const name = owner ? (owner.getAttribute("aria-label") ?? owner.textContent).replace(/\s+/g, " ").trim().slice(0, 48) : "";
      const box = svg.getBoundingClientRect();
      svg.setAttribute("data-rtl-census", String(index));
      return {
        index,
        glyph: [...svg.classList].find((name) => name.startsWith("lucide-")) ?? "(no lucide class)",
        where: owner ? `${owner.tagName.toLowerCase()} "${name}"` : (svg.parentElement?.tagName.toLowerCase() ?? "?"),
        marked,
        direction,
        flips,
        expected: marked === "fixed" || direction !== "rtl" ? 0 : 1,
        visible: box.width > 0 && box.height > 0 && getComputedStyle(svg).visibility !== "hidden",
      };
    });
  }, classes);
}

/** Scrolls the page from top to bottom, so anything drawn on the way into view is in the DOM. */
async function scrollThrough(page: Page) {
  for (let step = 0; step < 40; step++) {
    const done = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.9);
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    });
    await page.waitForTimeout(120);
    if (done) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
}

/**
 * Every directional glyph on the page (and in its same-origin frames) is mirrored exactly once right
 * to left and not at all left to right. `direction` is the writing direction the screen's own glyphs
 * must be found in (a German creator page stays left to right on /ar).
 */
async function expectMirroredOnce(page: Page, label: string, projectName: string, direction: "rtl" | "ltr" = "rtl") {
  await scrollThrough(page);
  const origin = new URL(page.url()).origin;
  const glyphs: (Glyph & { frame: string })[] = [];
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame() && !frame.url().startsWith(origin)) continue;
    const name = frame === page.mainFrame() ? "page" : `frame ${frame.url().replace(origin, "")}`;
    for (const glyph of await census(frame, DIRECTIONAL_CLASSES)) glyphs.push({ ...glyph, frame: name });
  }
  const wrong = glyphs.filter((glyph) => glyph.flips !== glyph.expected).map((glyph) => `${glyph.frame}: ${glyph.glyph} in ${glyph.where} (${glyph.direction}, data-icon-dir=${String(glyph.marked)}): ${String(glyph.flips)} flips, expected ${String(glyph.expected)}`);
  expect(wrong, `${label}: directional glyphs not mirrored exactly once`).toEqual([]);
  // The screen really has arrows to check in its own direction, and they all come through Icon.
  const own = glyphs.filter((glyph) => glyph.direction === direction);
  expect(own.length, `${label}: directional glyphs (${direction})`).toBeGreaterThan(0);
  expect(
    glyphs.filter((glyph) => glyph.marked === null).map((glyph) => `${glyph.glyph} in ${glyph.where}`),
    `${label}: directional glyphs drawn without Icon`,
  ).toEqual([]);
  if (SHOTS && projectName === "mobile") {
    mkdirSync(SHOTS, { recursive: true });
    const tally = { label, glyphs: glyphs.length, rtl: glyphs.filter((glyph) => glyph.direction === "rtl").length, ltr: glyphs.filter((glyph) => glyph.direction !== "rtl").length, fixed: glyphs.filter((glyph) => glyph.marked === "fixed").length };
    appendFileSync(path.join(SHOTS, "census.jsonl"), `${JSON.stringify(tally)}\n`);
    await shoot(page, label, glyphs.filter((glyph) => glyph.frame === "page" && glyph.visible && glyph.direction === direction));
  }
  return glyphs;
}

/** A screenshot of the screen and a sheet of its directional glyphs with their buttons and links. */
async function shoot(page: Page, label: string, glyphs: Glyph[]) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const file = label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  await page.screenshot({ path: path.join(SHOTS, `${file}.png`) });
  const cuts: { image: string; caption: string }[] = [];
  for (const glyph of glyphs.slice(0, 24)) {
    const svg = page.locator(`[data-rtl-census="${String(glyph.index)}"]`).first();
    const owner = svg.locator("xpath=ancestor-or-self::*[self::a or self::button or @role='button' or @role='link' or @role='menuitem'][1]");
    const target = (await owner.count()) ? owner : svg.locator("xpath=..");
    try {
      await target.scrollIntoViewIfNeeded({ timeout: 2_000 });
      const box = await target.boundingBox();
      const icon = await svg.boundingBox();
      if (!box || !icon) continue;
      const viewport = page.viewportSize() ?? { width: 390, height: 844 };
      // The owner, at most 360 × 96 px around the icon, inside the viewport.
      const width = Math.min(box.width + 16, 360);
      const height = Math.min(box.height + 16, 96);
      const x = Math.max(0, Math.min(Math.max(box.x - 8, icon.x + icon.width / 2 - width / 2), viewport.width - width));
      const y = Math.max(0, Math.min(Math.max(box.y - 8, icon.y + icon.height / 2 - height / 2), viewport.height - height));
      const image = await page.screenshot({ clip: { x, y, width, height } });
      cuts.push({ image: image.toString("base64"), caption: `${glyph.glyph.replace("lucide-", "")} · ${String(glyph.flips)} flip · ${glyph.where}` });
    } catch {
      // Off screen or behind a closed sheet: the count above still covers it.
    }
  }
  if (!cuts.length) return;
  const sheet = await page.context().newPage();
  await sheet.setViewportSize({ width: 800, height: 600 });
  await sheet.setContent(
    `<html dir="ltr"><body style="margin:0;padding:12px;font:12px system-ui;background:#f2f2f2;display:grid;grid-template-columns:repeat(2,1fr);gap:12px">${cuts
      .map((cut) => `<figure style="margin:0;background:#fff;padding:6px"><img style="display:block;max-width:100%" src="data:image/png;base64,${cut.image}"><figcaption dir="auto" style="margin-top:4px;color:#333">${cut.caption.replace(/[<>&]/g, "")}</figcaption></figure>`)
      .join("")}</body></html>`,
  );
  await sheet.screenshot({ path: path.join(SHOTS, `${file}-glyphs.png`), fullPage: true });
  await sheet.close();
}

async function signUp(page: Page) {
  const name = `rtl-${unique()}`;
  await page.goto(`/ar/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL("**/ar/app/welcome");
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("directional icons mirror exactly once in Arabic", () => {
  test("the website: home, templates and the portfolio landing", async ({ page }, info) => {
    test.setTimeout(150_000);
    for (const [label, url] of [
      ["home", "/ar"],
      ["templates", "/ar/templates"],
      ["portfolio", "/ar/portfolio"],
    ] as const) {
      await page.goto(url);
      await expect(page.locator("h1").first()).toBeVisible();
      await expectMirroredOnce(page, label, info.project.name);
    }
    // On a phone the menu sheet lists the pages with a chevron each.
    const menu = page.getByRole("button", { name: ar.marketing.nav.menu, exact: true });
    if (await menu.isVisible()) {
      await menu.click();
      await expect(page.getByRole("dialog", { name: ar.marketing.nav.menu })).toBeVisible();
      await expectMirroredOnce(page, "menu", info.project.name);
    }
  });

  test("creator pages and their project pages, in the page's own direction", async ({ page }, info) => {
    test.setTimeout(150_000);
    // Ronja writes in German: /ar/p/ronja-feldkamp opens her page in German (a page is shown in its
    // creator's language), left to right, and its arrows are not mirrored; so is her project page.
    // Naya writes in Arabic: her page and her project pages run right to left.
    for (const [label, url, lands, direction] of [
      ["ronja", "/ar/p/ronja-feldkamp", "/de/p/ronja-feldkamp", "ltr"],
      ["ronja project", "/de/p/ronja-feldkamp/hafenlicht", "/de/p/ronja-feldkamp/hafenlicht", "ltr"],
      ["naya", "/ar/p/naya-aldabbas", "/ar/p/naya-aldabbas", "rtl"],
      ["naya project", "/ar/p/naya-aldabbas/accountant-to-analyst", "/ar/p/naya-aldabbas/accountant-to-analyst", "rtl"],
    ] as const) {
      await page.goto(url);
      await expect(page).toHaveURL((address) => address.pathname === lands);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator(`[dir="${direction}"]`).first()).toBeAttached();
      await expectMirroredOnce(page, label, info.project.name, direction);
    }
  });

  test("the dashboard: home, editor and design", async ({ page }, info) => {
    test.setTimeout(150_000);
    await signUp(page);
    await page.getByRole("button", { name: ar.app.welcome.skip }).click();
    await page.waitForURL("**/ar/app");
    for (const [label, url] of [
      ["app home", "/ar/app"],
      ["app editor", "/ar/app/editor"],
      ["app design", "/ar/app/design"],
    ] as const) {
      if (!page.url().endsWith(url)) await page.goto(url);
      await expect(page.locator("#main h1").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectMirroredOnce(page, label, info.project.name);
    }
  });

  test("the team console's overview (demo)", async ({ page }, info) => {
    test.setTimeout(120_000);
    await signUp(page);
    await page.goto("/ar/admin");
    await page.locator("#team-code").fill(TEAM_CODE);
    await page.locator("form button[type=submit]").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("أهلاً");
    await page.waitForLoadState("networkidle");
    await expectMirroredOnce(page, "admin overview", info.project.name);
  });
});
