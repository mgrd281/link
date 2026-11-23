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
    await expect(index.getByRole("link", { name: "Werdegang" })).toHaveAttribute("aria-current", "true");
    await expect(index.locator("[aria-current]")).toHaveCount(1);
    // His page has a cover letter and no contact block: the hero's first action leads to the letter.
    await page.goto(SEVAG);
    await expect(index.getByRole("link", { name: "Über mich" })).toHaveAttribute("aria-current", "true");
    await page.locator("[data-hero-actions]").getByRole("link", { name: "Anschreiben lesen" }).press("Enter");
    await expect(page).toHaveURL(/#section-letter-title$/);
    await expect(page.getByRole("heading", { level: 2, name: "Anschreiben" })).toBeInViewport();
    // The whole letter on the wide canvas: no disclosure button, all seven paragraphs on screen.
    const letter = page.getByRole("region", { name: "Anschreiben" });
    await expect(letter.locator("summary")).toBeHidden();
    await expect(letter.getByText(/^Mit freundlichen Grüßen/)).toBeVisible();
    // The button is hidden only where CSS can also show the closed disclosure's content: every rule that
    // hides it sits inside @supports selector(::details-content), so an older browser keeps the button.
    const guards = await page.evaluate(() => {
      const found: string[] = [];
      const walk = (rules: CSSRuleList, supports: string) => {
        for (const rule of rules) {
          if (rule instanceof CSSSupportsRule) walk(rule.cssRules, rule.conditionText);
          else if (rule instanceof CSSGroupingRule) walk(rule.cssRules, supports);
          else if (rule instanceof CSSStyleRule && /\.lb-more\s*>\s*summary/.test(rule.selectorText) && rule.style.display === "none") found.push(supports);
        }
      };
      for (const sheet of document.styleSheets) walk(sheet.cssRules, "");
      return found;
    });
    expect(guards.length).toBeGreaterThan(0);
    for (const condition of guards) expect(condition).toContain("::details-content");
    // The wide canvas's index list has no mask (it would clip a chip's focus ring); the bar is solid.
    expect(await index.getByRole("list").evaluate((list) => getComputedStyle(list).maskImage)).toBe("none");
    expect(await page.locator(".poster-bar").evaluate((bar) => [getComputedStyle(bar).backdropFilter, getComputedStyle(bar).backgroundColor])).toEqual(["none", expect.not.stringMatching(/rgba?\(.*,\s*0(\.\d+)?\)$/)]);
  });

  test("phones: two hero buttons share a row on the first screen at 390 and 360 px; 'Teilen' copies the address and says so", async ({ browser }) => {
    for (const [width, height] of [
      [390, 844],
      [360, 780],
    ] as const) {
      const context = await browser.newContext({ ...PHONE, viewport: { width, height }, reducedMotion: "reduce" });
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
      const page = await context.newPage();
      await page.goto(SEVAG);
      const actions = page.locator("[data-hero-actions]");
      const [lead, share] = [actions.getByRole("link", { name: "Anschreiben lesen" }), actions.getByRole("button", { name: "Teilen" })];
      const [a, b] = [await lead.boundingBox(), await share.boundingBox()];
      // Side by side, the same height (at least 48 px), the first action the wider one; nothing leaves the screen.
      expect(a && b && Math.abs(a.y - b.y) < 1 && a.height >= 48 && b.height === a.height && a.width > b.width, `${String(width)}: ${JSON.stringify([a, b])}`).toBe(true);
      // Where the thumb is: both on the first screen, before the numbers.
      expect(a && a.y + a.height <= height, `${String(width)}: ${JSON.stringify(a)}`).toBe(true);
      const stats = await page.locator("header dl").boundingBox();
      expect(a && stats && stats.y > a.y + a.height).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      if (width === 390) {
        // Headless Chromium has no share sheet: the address is copied and a polite live region says so.
        expect(await page.evaluate(() => typeof navigator.share)).toBe("undefined");
        await share.click();
        await expect(actions.getByRole("status")).toHaveText("Link kopiert.");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/de\/p\/sevag-ghazarian-2131af$/);
        // The visible label stays the name (WCAG 2.5.3); only the icon turns into a check.
        await expect(share).toHaveText("Teilen");
        await expect(share).toHaveAccessibleName("Teilen");
        await expect(share.locator("svg.lucide-check")).toHaveCount(1);
      }
      await context.close();
    }
  });

  test("phones: closing the share sheet copies nothing and says nothing; a refused share sheet falls back to copying", async ({ browser }) => {
    for (const refusal of ["AbortError", "NotAllowedError"] as const) {
      const context = await browser.newContext({ ...PHONE, reducedMotion: "reduce" });
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await context.addInitScript((name) => {
        window.localStorage.setItem("linkyo.privacy.v1", "essential");
        Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new DOMException("No", name)) });
      }, refusal);
      const page = await context.newPage();
      await page.goto(SEVAG);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => navigator.clipboard.writeText("before"));
      const actions = page.locator("[data-hero-actions]");
      await actions.getByRole("button", { name: "Teilen" }).click();
      if (refusal === "AbortError") {
        // The visitor decided: their clipboard stays theirs, the live region stays silent.
        await page.waitForTimeout(300);
        await expect(actions.getByRole("status")).toHaveText("");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("before");
        await expect(actions.locator("svg.lucide-check")).toHaveCount(0);
      } else {
        await expect(actions.getByRole("status")).toHaveText("Link kopiert.");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/de\/p\/sevag-ghazarian-2131af$/);
      }
      await context.close();
    }
  });

  test("phones: moving along the stuck index with Tab or Shift+Tab never scrolls the page", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    await page.waitForLoadState("networkidle");
    const nav = page.getByRole("navigation", { name: "Abschnitte" });
    const letter = page.getByRole("region", { name: "Anschreiben" });
    // From the letter's disclosure back into the stuck index: the page stays where it is.
    await letter.locator("summary").focus();
    await expect(nav.getByRole("link").first()).toHaveCSS("scroll-margin-block-start", /^-/);
    const before = await page.evaluate(() => window.scrollY);
    const shifts: number[] = [];
    for (let step = 0; step < 5; step += 1) {
      await page.keyboard.press("Shift+Tab");
      shifts.push(await page.evaluate(() => window.scrollY));
    }
    expect(shifts, "Shift+Tab").toEqual(Array<number>(5).fill(before));
    // The focused chip is whole in the row, and the row (not the page) followed it.
    const focused = page.locator(":focus");
    await expect(focused).toHaveText(/Über mich/);
    const box = await focused.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 56).toBe(true);
    // Tab along the stuck row: still no jump.
    const tabs: number[] = [];
    for (let step = 0; step < 2; step += 1) {
      await page.keyboard.press("Tab");
      tabs.push(await page.evaluate(() => window.scrollY));
    }
    expect(tabs, "Tab").toEqual([before, before]);
    // Enter on a chip still lands its heading below the bar and the index.
    await page.keyboard.press("Enter");
    const [title, navBox] = [await page.getByRole("heading", { level: 2, name: "Werdegang" }).boundingBox(), await nav.boundingBox()];
    expect(title && navBox && title.y >= navBox.y + navBox.height).toBe(true);
    await page.context().close();
  });

  test("phones: the index sticks flush under the compact bar and marks the section being read", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    await page.waitForLoadState("networkidle");
    const nav = page.getByRole("navigation", { name: "Abschnitte" });
    await page.getByRole("heading", { level: 2, name: "Werdegang" }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    const bar = page.locator(".poster-bar");
    await expect(async () => {
      const [barBox, navBox] = [await bar.boundingBox(), await nav.boundingBox()];
      // Flush: the index starts where the bar ends, at the screen's top, compact (one row of 44 px chips).
      expect(barBox && navBox && Math.abs(navBox.y - (barBox.y + barBox.height)) <= 1 && barBox.y === 0 && navBox.height <= 56).toBe(true);
    }).toPass();
    // A solid ground: nothing shows through between or behind the chips, nor through the bar above them.
    expect(await nav.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toMatch(/rgba\(.*, 0\)|transparent/);
    expect(await bar.evaluate((element) => [getComputedStyle(element).backdropFilter, getComputedStyle(element).backgroundColor])).toEqual([
      "none",
      await nav.evaluate((element) => getComputedStyle(element).backgroundColor),
    ]);
    const current = nav.locator("[aria-current='true']");
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("Werdegang");
    // The marked chip is whole in the row; the row fades only on the sides where more chips lie.
    await expect(async () => {
      const box = await current.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
    }).toPass();
    const row = nav.getByRole("list");
    expect(await row.evaluate((list) => [list.hasAttribute("data-fade-start"), list.hasAttribute("data-fade-end")])).toEqual([true, true]);
    // Chips are 44 px targets.
    for (const link of await nav.getByRole("link").all()) expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    // A section jumped to from the index stops below the bar and the index (WCAG 2.4.11).
    await nav.getByRole("link", { name: "Was ich mitbringe" }).click();
    await expect(nav.getByRole("link", { name: "Was ich mitbringe" })).toHaveAttribute("aria-current", "true");
    const [title, navBox] = [await page.getByRole("heading", { level: 2, name: "Was ich mitbringe" }).boundingBox(), await nav.boundingBox()];
    expect(title && navBox && title.y >= navBox.y + navBox.height).toBe(true);
    // At the end of the page the last section is marked.
    await page.keyboard.press("End");
    await expect(nav.getByRole("link", { name: "Anschreiben" })).toHaveAttribute("aria-current", "true");
    await page.context().close();
  });

  test("phones: skills have an icon each, no numbers, no automatic hyphenation, and a compact bento", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const skills = page.getByRole("region", { name: "Was ich mitbringe" });
    const tiles = skills.getByRole("listitem");
    await expect(tiles).toHaveCount(12);
    for (const tile of await tiles.all()) await expect(tile.locator("svg.lucide")).toHaveCount(1);
    await expect(skills).not.toContainText(/\b0\d\b/);
    expect(await skills.locator("li span[dir]").first().evaluate((label) => getComputedStyle(label).hyphens)).toBe("manual");
    // Flat tiles: the icon beside its label. The lead runs across; tiles sharing a row are as tall as each other.
    const boxes = (await Promise.all((await tiles.all()).map((tile) => tile.boundingBox()))).filter((box) => box !== null);
    expect(boxes[0]?.width).toBeGreaterThan(300);
    const rows = new Map<number, number[]>();
    for (const box of boxes) rows.set(Math.round(box.y), [...(rows.get(Math.round(box.y)) ?? []), box.height]);
    expect(rows.size).toBe(8);
    for (const heights of rows.values()) expect(new Set(heights).size).toBe(1);
    for (const tile of await tiles.all()) {
      const [icon, label] = [await tile.locator("svg").boundingBox(), await tile.locator("span[dir]").boundingBox()];
      expect(icon && label && label.x > icon.x + icon.width && label.y < icon.y + icon.height).toBe(true);
    }
    // Twelve skills in about 520 px (round 1: 678 px for the grid, 783 px for the section), measured, not hoped.
    const grid = await skills.getByRole("list").boundingBox();
    expect(grid?.height).toBeLessThan(540);
    expect((await skills.boundingBox())?.height).toBeLessThan(640);
    // Every label fits its tile in at most two lines (long compounds break at their joints only).
    for (const label of await skills.locator("li span[dir]").all()) {
      const [lines, overflows] = await label.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return [new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size, element.scrollWidth > element.clientWidth] as const;
      });
      expect(lines).toBeLessThanOrEqual(2);
      expect(overflows).toBe(false);
    }
    await page.context().close();
  });

  test("phones: the letter opens with two paragraphs and a native disclosure that works by keyboard", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const letter = page.getByRole("region", { name: "Anschreiben" });
    await expect(letter.getByText("1 Min. Lesezeit")).toBeVisible();
    await expect(letter.getByText(/^Sehr geehrter Herr Vitt,$/)).toBeVisible();
    await expect(letter.getByText(/^Mit freundlichen Grüßen/)).toBeHidden();
    // Tab reaches the disclosure; its name says what it opens; Enter opens it, and its name changes.
    await letter.getByText(/^ich bewerbe mich/).click();
    const more = letter.locator("summary");
    await page.keyboard.press("Tab");
    await expect(more).toBeFocused();
    await expect(more).toHaveAccessibleName("Ganzes Anschreiben lesen");
    await expect(letter.locator("details")).not.toHaveAttribute("open");
    const before = await more.boundingBox();
    await page.keyboard.press("Enter");
    await expect(letter.locator("details")).toHaveAttribute("open", "");
    await expect(letter.getByText(/^Mit freundlichen Grüßen/)).toBeVisible();
    await expect(more).toHaveAccessibleName("Weniger anzeigen");
    // The button stays where it was pressed, focus ring on screen; the rest unfolds below it.
    const [signature, button] = [await letter.getByText(/^Mit freundlichen Grüßen/).boundingBox(), await more.boundingBox()];
    expect(button && before && Math.abs(button.y - before.y) < 1 && signature && signature.y > button.y).toBe(true);
    await expect(more).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Space");
    await expect(letter.locator("details")).not.toHaveAttribute("open");
    expect(await axe(page)).toEqual([]);
    await page.context().close();
  });

  test("phones: 'Anschreiben lesen' opens the whole letter, without a second tap", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const letter = page.getByRole("region", { name: "Anschreiben" });
    await expect(letter.getByText(/^Mit freundlichen Grüßen/)).toBeHidden();
    await page.locator("[data-hero-actions]").getByRole("link", { name: "Anschreiben lesen" }).click();
    await expect(page).toHaveURL(/#section-letter-title$/);
    await expect(letter.locator("summary")).toBeHidden();
    await expect(letter.getByText(/^Mit freundlichen Grüßen/)).toBeVisible();
    // The heading stops below the bar and the index.
    const [title, nav] = [await page.getByRole("heading", { level: 2, name: "Anschreiben" }).boundingBox(), await page.getByRole("navigation", { name: "Abschnitte" }).boundingBox()];
    expect(title && nav && title.y >= nav.y + nav.height).toBe(true);
    await page.context().close();
  });

  test("without JavaScript the index is plain links and claims no section as the current one", async ({ browser }) => {
    const context = await browser.newContext({ ...PHONE, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(SEVAG);
    const nav = page.getByRole("navigation", { name: "Abschnitte" });
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
    await nav.getByRole("link", { name: "Neu für mich: das Tönen" }).click();
    await expect(page).toHaveURL(/#section-toning-title$/);
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
    await context.close();
  });

  test("short screens: the index stands in the flow, like every sticky bar there", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 420 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
    const page = await context.newPage();
    await page.goto(SEVAG);
    const nav = page.getByRole("navigation", { name: "Abschnitte" });
    expect(await nav.evaluate((element) => getComputedStyle(element).position)).toBe("static");
    expect(await nav.getByRole("link").first().evaluate((link) => getComputedStyle(link).scrollMarginBlockStart)).toBe("0px");
    await context.close();
  });

  test("phones: the picture runs edge to edge, the index is a row of chips under the hero, and his own page has no Linkyo bar", async ({ browser }) => {
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
    // Sevag's page is shown as his own (bare): no Linkyo bar comes in.
    await expect(page.locator("[data-shown]")).toHaveCount(0);
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
    // With a contact block the hero leads with its action, "Share" beside it, the CV below as a quiet
    // link: one filled button in the hero.
    await small.goto(SAMPLE("en"));
    const actions = small.locator("[data-hero-actions]");
    const [ask, share, cv] = [actions.getByRole("link", { name: "Ask about a project" }), actions.getByRole("button", { name: "Share" }), actions.getByRole("link", { name: /^CV/ })];
    await expect(ask).toBeVisible();
    await expect(share).toBeVisible();
    const [askBox, shareBox, cvBox] = [await ask.boundingBox(), await share.boundingBox(), await cv.boundingBox()];
    expect(askBox && shareBox && cvBox && Math.abs(askBox.y - shareBox.y) < 1 && cvBox.y > askBox.y + askBox.height).toBe(true);
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
        // His own page carries no Linkyo badge at all; the sample has none either.
        if (url === SEVAG) expect(await underBadge(page)).toEqual(["no badge"]);
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
    // Skills carry their icons at the right, the label to their left.
    const tile = page.getByRole("region", { name: "المهارات والأدوات" }).getByRole("listitem").first();
    const [tileBox, iconBox] = [await tile.boundingBox(), await tile.locator("svg").boundingBox()];
    expect(tileBox && iconBox && iconBox.x > tileBox.x + tileBox.width / 2).toBe(true);
    // A timeline's nodes stand at the right edge of its steps.
    const step = page.locator(".lb-step").first();
    const [stepBox, nodeBox] = [await step.boundingBox(), await step.locator("span[aria-hidden]").first().boundingBox()];
    expect(stepBox && nodeBox && nodeBox.x + nodeBox.width >= stepBox.x + stepBox.width - 1).toBe(true);
    await page.context().close();
  });
});
