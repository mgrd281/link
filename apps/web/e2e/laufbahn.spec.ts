import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Laufbahn (ADR 0069), the template for applications and CVs: the section index works with the
 * keyboard and keeps each section clear of the compact bar, reduced motion stills every animation,
 * phone and desktop pass axe, and Arabic pages are mirrored. Runs in the desktop project; phone checks
 * open their own phone-sized context.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SEVAG = "/de/p/sevag-ghazarian-2131af";
/** The portfolio sample on Laufbahn: a contact block, projects, quotes, clients, skills and experience. */
const SAMPLE = (locale: "en" | "ar") => `/${locale}/directions/poster?chrome=0&template=laufbahn&page=portfolio`;
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function phone(browser: Browser, options: { reducedMotion?: "reduce" | "no-preference" } = {}): Promise<Page> {
  const context = await browser.newContext({ ...PHONE, ...options });
  await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
  return context.newPage();
}

const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`);

/**
 * The contrast of the white words over the picture, measured on the pixels: the words are made
 * transparent (and the example badge hidden), the screen is captured, and every fourth pixel inside the
 * words' line boxes is compared with white. Returns the lowest ratio found.
 */
async function wordsContrast(page: Page): Promise<number> {
  const boxes = await page.evaluate(() => {
    const out: [number, number, number, number][] = [];
    for (const element of [document.querySelector("header h1"), document.querySelector("header p.inline-flex span[dir]")]) {
      if (!(element instanceof HTMLElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(element);
      for (const box of range.getClientRects()) out.push([box.left, box.top, box.width, box.height]);
      element.style.color = "transparent";
    }
    // The example badge (and, in development, the framework's indicator) are not part of the picture.
    for (const aside of document.querySelectorAll("aside, nextjs-portal")) (aside as HTMLElement).style.visibility = "hidden";
    return out;
  });
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ shot, boxes }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${shot}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      [canvas.width, canvas.height] = [image.width, image.height];
      const context = canvas.getContext("2d");
      if (!context) return 0;
      context.drawImage(image, 0, 0);
      const linear = (value: number) => (value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
      let lowest = 21;
      for (const [x, y, width, height] of boxes) {
        const data = context.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height))).data;
        for (let index = 0; index < data.length; index += 16) {
          const luminance = 0.2126 * linear(data[index] ?? 0) + 0.7152 * linear(data[index + 1] ?? 0) + 0.0722 * linear(data[index + 2] ?? 0);
          lowest = Math.min(lowest, 1.05 / (luminance + 0.05));
        }
      }
      return lowest;
    },
    { shot, boxes },
  );
}

/** Text of the page that runs under the example badge (none may). */
const underBadge = (page: Page) =>
  page.evaluate(() => {
    const aside = document.querySelector('aside[data-theme="dark"]')?.getBoundingClientRect();
    if (!aside) return ["no badge"];
    const hits: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("[lang]") ?? document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const owner = node.parentElement;
      if (!owner || owner.closest("aside") || !node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) {
        if (box.width > 0 && box.left < aside.right && box.right > aside.left && box.top < aside.bottom && box.bottom > aside.top) hits.push(node.textContent.trim());
      }
    }
    return hits;
  });

test.describe("Laufbahn", () => {
  test("the section index leads to each section by keyboard, clear of the compact bar", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const index = page.getByRole("navigation", { name: "Abschnitte" });
    await expect(index.getByRole("link")).toHaveText(["AÜber mich", "BWas ich mitbringe", "CWerdegang", "DNeu für mich: das Tönen", "EAnschreiben"]);
    // Tab walks the index in order; Enter follows a link.
    await index.getByRole("link", { name: "Über mich" }).focus();
    await page.keyboard.press("Tab");
    await expect(index.getByRole("link", { name: "Was ich mitbringe" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(index.getByRole("link", { name: "Werdegang" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#section-path$/);
    const title = page.getByRole("heading", { level: 2, name: "Werdegang" });
    await expect(title).toBeInViewport();
    // The section stops below the compact bar (scroll margin), never under it.
    const bar = await page.locator(".poster-bar").boundingBox();
    const box = await title.boundingBox();
    expect(box && bar && box.y >= bar.y + bar.height).toBe(true);
    // On the wide canvas the index stays in view beside the sections and marks the one being read.
    await expect(index.getByRole("list")).toBeInViewport();
    const here = (name: string) => index.getByRole("link", { name }).evaluate((link) => getComputedStyle(link).getPropertyValue("--lb-here").trim());
    expect(await here("Werdegang")).toBe("1");
    expect(await here("Über mich")).toBe("0");
    // "Weiterlesen" in the hero leads to the first section.
    await page.goto(SEVAG);
    await page.getByRole("link", { name: "Weiterlesen: Über mich" }).press("Enter");
    await expect(page).toHaveURL(/#section-about$/);
    await expect(page.getByRole("heading", { level: 2, name: "Über mich" })).toBeInViewport();
  });

  test("phones: the picture runs edge to edge, the index is a row of chips under the hero, the Linkyo bar still comes in", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const plate = await page.locator("[data-hero-plate]").boundingBox();
    expect(plate?.x).toBe(0);
    expect(plate?.width).toBe(390);
    // About three quarters of the screen, and the name stands on it.
    expect(plate && plate.height > 844 * 0.6 && plate.height < 844 * 0.8).toBe(true);
    const name = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(name && plate && name.y + name.height <= plate.y + plate.height).toBe(true);
    // The chips scroll sideways, the page itself never does.
    const chips = page.getByRole("navigation", { name: "Abschnitte" }).getByRole("list");
    expect(await chips.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    // Tab along the chips: each one scrolls fully into the row, label and focus ring whole (once the
    // row's small script is running).
    await page.waitForLoadState("networkidle");
    const links = page.getByRole("navigation", { name: "Abschnitte" }).getByRole("link");
    await links.first().focus();
    for (let index = 1; index < 5; index += 1) {
      await page.keyboard.press("Tab");
      await expect(links.nth(index)).toBeFocused();
      await expect(async () => {
        const box = await links.nth(index).boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
      }).toPass();
    }
    const link = links.last();
    await expect(link).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Anschreiben" })).toBeInViewport();
    await expect(page.locator("[data-shown]")).toHaveCount(1);
    expect(await axe(page)).toEqual([]);
    await page.context().close();
  });

  test("with reduced motion nothing moves; without it the sections, the picture and the rail are animated", async ({ browser }) => {
    const names = (page: Page) =>
      page.evaluate(() => ({
        reveal: getComputedStyle(document.querySelector(".lb-reveal") ?? document.body).animationName,
        rise: getComputedStyle(document.querySelector(".poster-rise") ?? document.body).animationName,
        zoom: getComputedStyle(document.querySelector(".lb-zoom") ?? document.body).animationName,
        rail: getComputedStyle(document.querySelector(".lb-step") ?? document.body, "::after").animationName,
        running: document
          .getAnimations()
          .filter((animation) => animation.playState === "running" && animation.timeline === document.timeline)
          .map((animation) => (animation instanceof CSSAnimation ? animation.animationName : "other")),
      }));
    const still = await phone(browser, { reducedMotion: "reduce" });
    await still.goto(SEVAG);
    expect(await names(still)).toEqual({ reveal: "none", rise: "none", zoom: "none", rail: "none", running: [] });
    // The rail is drawn in full without its animation.
    expect(await still.locator(".lb-step").first().evaluate((step) => getComputedStyle(step, "::after").scale)).toBe("none");
    await still.context().close();
    const moving = await phone(browser, { reducedMotion: "no-preference" });
    await moving.goto(SEVAG);
    const live = await names(moving);
    expect([live.reveal, live.rise, live.zoom, live.rail]).toEqual(["lb-rise", "poster-rise", "lb-zoom", "lb-fill"]);
    await moving.context().close();
  });

  test("axe finds nothing on phone and desktop, with and without a contact block", async ({ page, browser }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const url of [SEVAG, SAMPLE("en"), SAMPLE("ar")]) {
      await page.goto(url);
      expect(await axe(page), url).toEqual([]);
    }
    const small = await phone(browser, { reducedMotion: "reduce" });
    for (const url of [SAMPLE("en"), SAMPLE("ar")]) {
      await small.goto(url);
      expect(await axe(small), url).toEqual([]);
    }
    // With a contact block the hero leads with its action, "Read on" beside the CV link as a quiet
    // text action: one filled button in the hero.
    await small.goto(SAMPLE("en"));
    const actions = small.locator("[data-hero-actions]");
    await expect(actions.getByRole("link", { name: "Ask about a project" })).toBeVisible();
    await expect(actions.getByRole("link", { name: /^Read on/ })).toBeVisible();
    const [cv, read] = [await actions.getByRole("link", { name: /^CV/ }).boundingBox(), await actions.getByRole("link", { name: /^Read on/ }).boundingBox()];
    expect(cv && read && Math.abs(cv.y - read.y) < 2).toBe(true);
    await small.context().close();
  });

  test("large screens with motion on: nothing rests faded at the fold, and axe finds nothing", async ({ browser }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1680, height: 1050 },
    ]) {
      const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
      await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
      const page = await context.newPage();
      for (const url of [SEVAG, SAMPLE("en")]) {
        await page.goto(url);
        // Wait until the hero's lines have risen in.
        await expect.poll(() => page.evaluate(() => [...document.querySelectorAll(".poster-rise")].every((element) => getComputedStyle(element).opacity === "1"))).toBe(true);
        const faded = await page.evaluate(() =>
          [...document.querySelectorAll(".lb-reveal")].filter((element) => element.getBoundingClientRect().top < innerHeight && Number(getComputedStyle(element).opacity) < 1).length,
        );
        expect(faded, `${url} at ${String(viewport.width)}`).toBe(0);
        expect(await axe(page), `${url} at ${String(viewport.width)}`).toEqual([]);
      }
      await context.close();
    }
  });

  test("Shift+Tab from the index back into the hero never leaves focus under the compact bar", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SAMPLE("en"));
    await page.keyboard.press("End");
    const index = page.getByRole("navigation", { name: "Sections" });
    await index.getByRole("link").first().focus();
    const bar = page.locator(".poster-bar");
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press("Shift+Tab");
      const [focused, barBox] = [await page.evaluate(() => document.activeElement?.getBoundingClientRect().toJSON() as DOMRect), await bar.boundingBox()];
      expect(barBox && focused.top >= barBox.y + barBox.height).toBe(true);
    }
  });

  test("tablets: the index chips wrap inside the reading column, none cut off", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, reducedMotion: "reduce" });
    await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
    const page = await context.newPage();
    await page.goto(SEVAG);
    const list = page.getByRole("navigation", { name: "Abschnitte" }).getByRole("list");
    expect(await list.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const column = await list.boundingBox();
    for (const link of await list.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box && column && box.x >= column.x - 1 && box.x + box.width <= column.x + column.width + 1).toBe(true);
    }
    await context.close();
  });

  test("short screens (a landscape phone, 200 % zoom): the white words keep AA on the picture and stay clear of the badge", async ({ browser }) => {
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 640, height: 360 },
    ]) {
      for (const url of [SEVAG, SAMPLE("ar")]) {
        const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
        await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
        const page = await context.newPage();
        await page.goto(url);
        if (url === SEVAG) expect(await underBadge(page)).toEqual([]);
        // Large text: at least 3 : 1 on every pixel behind it (the veil gives about 6 : 1 even on white).
        expect(await wordsContrast(page), `${url} at ${String(viewport.width)}x${String(viewport.height)}`).toBeGreaterThanOrEqual(4.5);
        await context.close();
      }
    }
  });

  test("Arabic pages are mirrored: the name, the index, the signposts and the timeline start on the right", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SAMPLE("ar"));
    await expect(page.locator("[lang='ar']").first()).toHaveAttribute("dir", "rtl");
    const name = await page.getByRole("heading", { level: 1 }).boundingBox();
    // The name's lines end at the right gutter.
    const right = await page.getByRole("heading", { level: 1 }).evaluate((h1) => Math.max(...[...h1.querySelectorAll("bdi")].map((bdi) => bdi.getBoundingClientRect().right)));
    expect(name && right > 390 - 40).toBe(true);
    const links = page.getByRole("navigation", { name: "الأقسام" }).getByRole("link");
    const [first, second] = [await links.nth(0).boundingBox(), await links.nth(1).boundingBox()];
    expect(first && second && first.x > second.x).toBe(true);
    await expect(links.first()).toContainText("أ");
    // A timeline's nodes stand at the right edge of its steps.
    const step = page.locator(".lb-step").first();
    const [stepBox, nodeBox] = [await step.boundingBox(), await step.locator("span[aria-hidden]").first().boundingBox()];
    expect(stepBox && nodeBox && nodeBox.x + nodeBox.width >= stepBox.x + stepBox.width - 1).toBe(true);
    await page.context().close();
  });
});
