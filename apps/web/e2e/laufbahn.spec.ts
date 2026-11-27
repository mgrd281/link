import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Laufbahn (ADR 0069), the template for applications and CVs, set like a native app: on phones one app
 * bar names the section being read and opens the contents as a sheet (keyboard included), the index
 * beside the sections works on wider screens, every section stops clear of the bar, facts and skills
 * are grouped lists with whole words, reduced motion stills every animation, phone and desktop pass
 * axe, and Arabic pages are mirrored. Runs in the desktop project; phone checks open their own
 * phone-sized context.
 *
 * Round 6 ("Dossier", ADR 0069; documents, ADR 0089): the head is ink and type first, its picture a
 * 3 : 2 plate under the figures (no parallax); the hero's second action is the Lebenslauf as a PDF where
 * the page offers one (Share then lives in the bar on the wide canvas); the contents end with
 * "Unterlagen" and list the documents as a second group; on the wide canvas the titles hang beside
 * their sections and the chip index is the tablet's. This file was brought to round 6 by reading the
 * code only: it opens a real person's page, which the review runs never open. The template itself is
 * checked on fictional pages in e2e/laufbahn-dossier-app.spec.ts. Since review 4, "Über mich" keeps
 * his drawn still beside the facts (the founder's choice), "Beides in einer Datei · 2 Seiten" keeps
 * its no-break spaces and the career's rail is a column of its own; the assertions changed for that
 * were run once on the fictional application without a contact block and on the portfolio sample.
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
    // The chip index is the tablet's (on the wide canvas the titles hang beside their sections).
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const index = page.getByRole("navigation", { name: "Abschnitte" });
    // Words only: no letters before the titles; the documents close the contents.
    await expect(index.getByRole("link")).toHaveText(["Über mich", "Was ich mitbringe", "Werdegang", "Neu für mich: das Tönen", "Anschreiben", "Unterlagen"]);
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
    await expect(page.locator(".poster-bar")).toBeVisible();
    const bar = await page.locator(".poster-bar").boundingBox();
    const box = await title.boundingBox();
    expect(box && bar && box.y >= bar.y + bar.height).toBe(true);
    // The index marks the section being read: the last one whose top has passed the reading line, at
    // 35 % of the screen. His career has two steps, so at 1180 px the section after it ("Neu für mich:
    // das Tönen") may have passed the line as well; then that one is marked, never an earlier one.
    const read = await page.evaluate(() => {
      const line = window.innerHeight * 0.35;
      const passed = [...document.querySelectorAll("#page-content > section.lb-section")].filter((section) => section.getBoundingClientRect().top <= line);
      return passed.at(-1)?.querySelector(":scope > h2")?.textContent ?? "";
    });
    expect(["Werdegang", "Neu für mich: das Tönen"]).toContain(read);
    await expect(index.locator("[aria-current]")).toHaveCount(1);
    await expect(index.locator("[aria-current='true']")).toHaveText(read);
    // His page has a cover letter and no contact block: the hero's first action leads to the letter.
    await page.goto(SEVAG);
    await expect(index.getByRole("link", { name: "Über mich" })).toHaveAttribute("aria-current", "true");
    await page.locator("[data-hero-actions]").getByRole("link", { name: "Anschreiben lesen" }).press("Enter");
    await expect(page).toHaveURL(/#section-letter-title$/);
    await expect(page.getByRole("heading", { level: 2, name: "Anschreiben" })).toBeInViewport();
    // Arrived at by its address, the whole letter: there is no disclosure at all (round 6, the founder's review).
    const letter = page.getByRole("region", { name: "Anschreiben" });
    await expect(letter.locator("details, summary")).toHaveCount(0);
    await expect(letter.getByText(/^Mit freundlichen Grüßen/)).toBeVisible();
    // The index list has no mask (it would clip a chip's focus ring); the bar is solid.
    expect(await index.getByRole("list").evaluate((list) => getComputedStyle(list).maskImage)).toBe("none");
    expect(await page.locator(".poster-bar").evaluate((bar) => [getComputedStyle(bar).backdropFilter, getComputedStyle(bar).backgroundColor])).toEqual(["none", expect.not.stringMatching(/rgba?\(.*,\s*0(\.\d+)?\)$/)]);
  });

  test("phones: the letter and the Lebenslauf as a PDF on the first screen, side by side at 390 px and stacked at full width at 360 px", async ({ browser }) => {
    // Without the private contact lines (CI) the page has no contact block, so the hero pairs
    // "Anschreiben lesen" with "Lebenslauf": 338 of the 350 px a 390 px phone has (px-3 on phones),
    // so they share a row there, and stack at full width on a 360 px phone (ADR 0069 round 6). The same
    // pair on the fictional page: e2e/laufbahn-dossier-app.spec.ts (application-no-contact).
    for (const [width, height, together] of [
      [390, 844, true],
      [360, 780, false],
    ] as const) {
      const context = await browser.newContext({ ...PHONE, viewport: { width, height }, reducedMotion: "reduce" });
      await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
      const page = await context.newPage();
      await page.goto(SEVAG);
      const actions = page.locator("[data-hero-actions]");
      // The page offers its documents: the second action is the Lebenslauf (Share is the bar's).
      const [lead, cv] = [actions.getByRole("link", { name: "Anschreiben lesen" }), actions.getByRole("link", { name: /^Lebenslauf herunterladen \(PDF, \d+ Seiten?\)$/ })];
      await expect(cv).toHaveAttribute("href", /\/de\/p\/sevag-ghazarian-2131af\/cv$/);
      await expect(cv).toHaveAttribute("download", /^Lebenslauf_.+\.pdf$/);
      await expect(actions.getByRole("button", { name: "Teilen" })).toHaveCount(0);
      const [a, b, row] = [await lead.boundingBox(), await cv.boundingBox(), await actions.boundingBox()];
      const where = `${String(width)}: ${JSON.stringify([a, b, row])}`;
      expect(a && b && row, where).toBeTruthy();
      if (!a || !b || !row) continue;
      // The same height (at least 48 px) either way.
      expect(a.height >= 48 && Math.abs(b.height - a.height) < 1, where).toBe(true);
      if (together) {
        // Side by side, the first action the wider one.
        expect(Math.abs(a.y - b.y) < 1 && a.width > b.width, where).toBe(true);
      } else {
        // One under the other, each as wide as the row.
        expect(b.y >= a.y + a.height && Math.abs(a.x - b.x) < 1 && Math.abs(a.width - row.width) < 1 && Math.abs(b.width - row.width) < 1, where).toBe(true);
      }
      // Where the thumb is: both on the first screen, before the numbers.
      expect(b.y + b.height <= height, where).toBe(true);
      const stats = await page.locator("header dl").boundingBox();
      expect(stats && stats.y > Math.max(a.y + a.height, b.y + b.height)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await context.close();
    }
  });

  test("the wide canvas: the bar's Share copies the address and says so", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
    const page = await context.newPage();
    await page.goto(SEVAG);
    // The bar comes in once the name has passed under it.
    await page.getByRole("heading", { level: 1 }).evaluate((name) => window.scrollBy({ top: name.getBoundingClientRect().bottom + 200, behavior: "instant" }));
    const bar = page.locator(".poster-bar");
    await expect(bar).toBeVisible();
    // Headless Chromium has no share sheet: the address is copied and a polite live region says so.
    expect(await page.evaluate(() => typeof navigator.share)).toBe("undefined");
    const share = bar.getByRole("button", { name: "Seite teilen" });
    await expect(share).toHaveCount(1);
    await share.click();
    await expect(bar.getByRole("status")).toHaveText("Link kopiert.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/de\/p\/sevag-ghazarian-2131af$/);
    // The name stays the same (WCAG 2.5.3); only the icon turns into a check.
    await expect(share).toHaveAccessibleName("Seite teilen");
    await expect(share.locator("svg.lucide-check")).toHaveCount(1);
    await context.close();
  });

  test("the wide canvas: closing the share sheet copies nothing and says nothing; a refused share sheet falls back to copying", async ({ browser }) => {
    for (const refusal of ["AbortError", "NotAllowedError"] as const) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await context.addInitScript((name) => {
        window.localStorage.setItem("linkyo.privacy.v1", "essential");
        Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new DOMException("No", name)) });
      }, refusal);
      const page = await context.newPage();
      await page.goto(SEVAG);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => navigator.clipboard.writeText("before"));
      // Share is the bar's on this page (the hero offers the Lebenslauf): past the name, it comes in.
      await page.getByRole("heading", { level: 1 }).evaluate((name) => window.scrollBy({ top: name.getBoundingClientRect().bottom + 200, behavior: "instant" }));
      const actions = page.locator(".poster-bar");
      await expect(actions).toBeVisible();
      await actions.getByRole("button", { name: "Seite teilen" }).click();
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

  test("phones: one app bar at the top, solid, names the section being read; no row of chips, no letters", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    await page.waitForLoadState("networkidle");
    // The index of wider screens has no place on a phone: the bar carries the contents.
    await expect(page.getByRole("navigation", { name: "Abschnitte" })).toBeHidden();
    await page.getByRole("heading", { level: 2, name: "Werdegang" }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    const bar = page.locator(".poster-bar");
    const title = bar.getByRole("button", { name: /Inhalt öffnen/ });
    await expect(title).toContainText("Werdegang");
    await expect(title).toContainText("Sevag Ghazarian");
    await expect(async () => {
      const box = await bar.boundingBox();
      // Flush at the top and the only chrome there: one bar of 56 px and its hairline.
      expect(box?.y === 0 && Math.round(box.height) >= 56 && Math.round(box.height) <= 57).toBe(true);
    }).toPass();
    // Solid: nothing shows through it.
    expect(await bar.evaluate((element) => [getComputedStyle(element).backdropFilter, getComputedStyle(element).backgroundColor])).toEqual(["none", expect.not.stringMatching(/rgba?\(.*,\s*0(\.\d+)?\)$/)]);
    // The title is a 44 px target that says it opens a dialog.
    expect((await title.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(title).toHaveAttribute("aria-haspopup", "dialog");
    // No letters anywhere on the page: the sections are titled by their words.
    for (const heading of await page.getByRole("heading", { level: 2 }).all()) await expect(heading).not.toHaveText(/^[A-E]\s*$/);
    // At the end of the page the last section is named: the documents.
    await page.keyboard.press("End");
    await expect(title).toContainText("Unterlagen");
    await page.context().close();
  });

  test("phones: scrolled by hand, a few pixels a frame, the bar names each section as its top passes the reading line, both ways", async ({ browser }) => {
    const page = await phone(browser);
    await page.goto(SEVAG);
    await page.waitForLoadState("networkidle");
    const title = page.locator(".poster-bar").getByRole("button", { name: /Inhalt öffnen/ });
    // A finger's pace: 4 px a frame, less than the observer's band (1 % of the screen), so the section's
    // top is seen entering it and nothing else happens until the next section. Stops a little past
    // (or, going back, a little before) the reading line at 35 % of the screen.
    const drag = (name: string, direction: 1 | -1, stop = direction > 0 ? 0.3 : 0.4) =>
      page.evaluate(
        async ([heading, step, until]) => {
          const section = [...document.querySelectorAll("section.lb-section")].find((element) => element.querySelector("h2")?.textContent === heading);
          if (!section) throw new Error(`no section "${heading}"`);
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
          const done = () => (step > 0 ? section.getBoundingClientRect().top < window.innerHeight * until : section.getBoundingClientRect().top > window.innerHeight * until);
          for (let moves = 0; moves < 2000 && !done(); moves += 1) {
            window.scrollBy({ top: step, behavior: "instant" });
            await frame();
          }
        },
        [name, direction * 4, stop] as const,
      );
    // The bar slides in once the picture has all but left the screen: the first section near the top.
    await drag("Über mich", 1, 0.1);
    await expect(title).toContainText("Über mich");
    await drag("Was ich mitbringe", 1);
    await expect(title).toContainText("Was ich mitbringe");
    await drag("Werdegang", 1);
    await expect(title).toContainText("Werdegang");
    // Back up: the section before is named again once this one's top is below the line.
    await drag("Werdegang", -1);
    await expect(title).toContainText("Was ich mitbringe");
    await page.context().close();
  });

  test("phones: the contents open as a sheet; a section chosen there lands below the bar; Escape and the close button close it", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    await page.waitForLoadState("networkidle");
    await page.getByRole("heading", { level: 2, name: "Über mich" }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 300));
    const title = page.locator(".poster-bar").getByRole("button", { name: /Inhalt öffnen/ });
    await expect(title).toContainText("Über mich");
    // By keyboard: focusing the bar's title never moves the page (it sits in the band kept clear for the bar).
    const before = await page.evaluate(() => window.scrollY);
    await title.focus();
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    // Enter opens it, focus moves in and stays in, Escape closes it and focus comes back.
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: "Inhalt" });
    await expect(sheet).toBeVisible();
    // The sections, then the documents as a second group (each a direct download).
    const links = sheet.locator("ol").getByRole("link");
    await expect(links).toHaveText(["Über mich", "Was ich mitbringe", "Werdegang", "Neu für mich: das Tönen", "Anschreiben", "Unterlagen"]);
    await expect(sheet.locator("[aria-current='true']")).toHaveCount(1);
    const documents = sheet.getByRole("list", { name: "Unterlagen" }).getByRole("link");
    // The count keeps its word and the dot ends a line: no-break spaces there (keepCounts, review 4).
    await expect(documents).toHaveText(["Lebenslauf · PDF", "Anschreiben · PDF", /^Beides in einer Datei\u00a0· \d\u00a0Seiten$/u]);
    for (const link of await documents.all()) await expect(link).toHaveAttribute("download", /\.pdf$/);
    // Tab never reaches the page behind the sheet (it is inert): focus stays in the sheet, or passes to
    // the browser's own controls after the last row, as a native modal dialog allows.
    const inSheetOrBrowser = () => sheet.evaluate((dialog) => dialog.contains(document.activeElement) || document.activeElement === document.body);
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press("Tab");
      expect(await inSheetOrBrowser()).toBe(true);
    }
    for (let step = 0; step < 3; step += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await inSheetOrBrowser()).toBe(true);
    }
    // The page holds still under the sheet.
    const held = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    expect(await page.evaluate(() => window.scrollY)).toBe(held);
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(title).toBeFocused();
    // A sheet from the bottom edge, as wide as the screen; every row a 56 px target.
    await title.click();
    const box = await sheet.boundingBox();
    expect(box && Math.round(box.x) === 0 && Math.round(box.width) === 390 && Math.round(box.y + box.height) === 844).toBe(true);
    for (const link of await links.all()) expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(56);
    // The close button closes it too.
    await sheet.getByRole("button", { name: "Schließen" }).click();
    await expect(sheet).toBeHidden();
    // Choosing a section: the sheet closes, the address follows, and the heading stops below the bar.
    await title.click();
    await sheet.getByRole("link", { name: "Werdegang", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#section-path$/);
    const [heading, bar] = [await page.getByRole("heading", { level: 2, name: "Werdegang" }).boundingBox(), await page.locator(".poster-bar").boundingBox()];
    expect(heading && bar && heading.y >= bar.y + bar.height).toBe(true);
    await expect(title).toContainText("Werdegang");
    await page.context().close();
  });

  test("phones: skills are a list on one soft sheet: an icon and the whole label in each row, no lines, no hyphenation, nothing broken; the facts stand beside his portrait", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const skills = page.getByRole("region", { name: "Was ich mitbringe" });
    const rows = skills.getByRole("listitem");
    await expect(rows).toHaveCount(12);
    for (const row of await rows.all()) await expect(row.locator("svg.lucide")).toHaveCount(1);
    await expect(skills).not.toContainText(/\b0\d\b/);
    expect(await skills.locator("li span[dir]").first().evaluate((label) => getComputedStyle(label).hyphens)).toBe("manual");
    // One skill a row, each row the sheet's full inner width, the icon beside its label; no rule or frame anywhere.
    const sheet = skills.getByRole("list");
    const list = await sheet.boundingBox();
    const inner = await sheet.evaluate((element) => element.clientWidth - parseFloat(getComputedStyle(element).paddingInlineStart) - parseFloat(getComputedStyle(element).paddingInlineEnd));
    expect(await sheet.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
    for (const row of await rows.all()) {
      const [box, icon, label] = [await row.boundingBox(), await row.locator("svg").boundingBox(), await row.locator("span[dir]").boundingBox()];
      expect(box && Math.abs(box.width - inner) <= 2).toBe(true);
      expect(icon && label && label.x > icon.x + icon.width && label.y < icon.y + icon.height).toBe(true);
      expect(await row.evaluate((element) => [getComputedStyle(element).borderTopWidth, getComputedStyle(element).borderBottomWidth])).toEqual(["0px", "0px"]);
    }
    // Every label whole on one line at 390 px: no word broken, nothing cut.
    for (const label of await skills.locator("li span[dir]").all()) {
      const [lines, overflows, text] = await label.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return [new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size, element.scrollWidth > element.clientWidth, element.textContent] as const;
      });
      expect(lines, text).toBe(1);
      expect(overflows, text).toBe(false);
      expect(text).not.toContain("\u00AD");
    }
    // Twelve skills in under 600 px.
    expect(list?.height).toBeLessThan(600);
    // "Über mich" keeps a picture beside the facts until his own photo comes (the founder, round 6
    // review 4: a drawn still for now): the portrait on two of five columns at the start, the facts on
    // the other three, one a row under a hairline. The position and the employer stand in the head's
    // target line only. A value may wrap between its words, never inside one, and nothing hyphenates.
    const about = page.getByRole("region", { name: "Über mich" });
    const portrait = about.locator("[data-about-portrait]");
    await expect(portrait).toHaveCount(1);
    await expect(portrait.locator("img").first()).toHaveAttribute("alt", /^Illustration: /);
    const facts = portrait.locator("dl");
    await expect(facts.locator("dt")).toHaveText(["Stapler", "Farbsehen"]);
    await expect(about).not.toContainText("Bewerbung als");
    const [picture, column] = [await portrait.locator(":scope > div").first().boundingBox(), await facts.boundingBox()];
    expect(picture && column && picture.x + picture.width <= column.x && Math.abs(picture.y - column.y) <= 1, JSON.stringify([picture, column])).toBe(true);
    for (const row of await facts.locator(":scope > div").all()) expect(await row.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThan(0);
    for (const value of await facts.locator("dd").all()) {
      const text = (await value.textContent()) ?? "";
      expect(text).not.toContain("\u00AD");
      expect(await value.evaluate((element) => getComputedStyle(element).hyphens)).toBe("manual");
      // Every word on one line: a range over each word has one line box.
      const broken = await value.evaluate((element) => {
        const node = element.firstChild;
        if (node?.nodeType !== Node.TEXT_NODE) return ["no text"];
        return [...(node.textContent ?? "").matchAll(/\S+/gu)].flatMap((word) => {
          const range = document.createRange();
          range.setStart(node, word.index);
          range.setEnd(node, word.index + word[0].length);
          return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size > 1 ? [word[0]] : [];
        });
      });
      expect(broken, text).toEqual([]);
    }
    await page.context().close();
  });

  test("phones: the whole letter, with nothing to open, so the page never moves by itself", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const letter = page.getByRole("region", { name: "Anschreiben" });
    await expect(letter.getByText("1 Min. Lesezeit")).toBeAttached();
    await expect(letter.locator("details, summary")).toHaveCount(0);
    await letter.getByText(/^Sehr geehrter Herr Vitt,$/).scrollIntoViewIfNeeded();
    await expect(letter.getByText(/^Sehr geehrter Herr Vitt,$/)).toBeVisible();
    await letter.getByText(/^Mit freundlichen Grüßen/).scrollIntoViewIfNeeded();
    await expect(letter.getByText(/^Mit freundlichen Grüßen/)).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.context().close();
  });

  test("phones: 'Anschreiben lesen' leads to the whole letter", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const letter = page.getByRole("region", { name: "Anschreiben" });
    await page.locator("[data-hero-actions]").getByRole("link", { name: "Anschreiben lesen" }).click();
    await expect(page).toHaveURL(/#section-letter-title$/);
    await expect(letter.locator("details, summary")).toHaveCount(0);
    await expect(letter.getByText(/^Mit freundlichen Grüßen/)).toBeVisible();
    // The heading stops below the bar.
    const [title, bar] = [await page.getByRole("heading", { level: 2, name: "Anschreiben" }).boundingBox(), await page.locator(".poster-bar").boundingBox()];
    expect(title && bar && title.y >= bar.y + bar.height).toBe(true);
    await page.context().close();
  });

  test("without JavaScript the index is plain links and claims no section as the current one", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(SEVAG);
    const nav = page.getByRole("navigation", { name: "Abschnitte" });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
    await nav.getByRole("link", { name: "Neu für mich: das Tönen" }).click();
    await expect(page).toHaveURL(/#section-toning-title$/);
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
    await context.close();
  });

  test("short screens (a phone held sideways): the contents sheet fits the screen and every section in it is reachable", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
    const page = await context.newPage();
    await page.goto(SEVAG);
    await page.waitForLoadState("networkidle");
    await page.getByRole("heading", { level: 2, name: "Werdegang" }).scrollIntoViewIfNeeded();
    await page.locator(".poster-bar").getByRole("button", { name: /Inhalt öffnen/ }).click();
    const sheet = page.getByRole("dialog", { name: "Inhalt" });
    await expect(sheet).toBeVisible();
    expect((await sheet.boundingBox())?.height).toBeLessThanOrEqual(390);
    // The section row, not the document row below it ("Anschreiben · PDF herunterladen").
    const letter = sheet.locator("ol").getByRole("link", { name: "Anschreiben", exact: true });
    await letter.scrollIntoViewIfNeeded();
    await expect(letter).toBeInViewport({ ratio: 1 });
    // The last row of all, the combined file, can be reached too.
    const last = sheet.getByRole("list", { name: "Unterlagen" }).getByRole("link").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport({ ratio: 1 });
    await letter.scrollIntoViewIfNeeded();
    await letter.click();
    await expect(page).toHaveURL(/#section-letter-title$/);
    await context.close();
  });

  test("phones: the picture runs edge to edge under the figures, About shows another still, nothing runs off the side, and his own page has no Linkyo bar", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const plate = await page.locator("[data-hero-plate]").boundingBox();
    expect(plate?.x).toBe(0);
    expect(plate?.width).toBe(390);
    // A 3 : 2 plate, last in the ink head: the name and the figures stand above it, never on it.
    expect(plate && Math.abs(plate.height - 390 * (2 / 3)) <= 1).toBe(true);
    const name = await page.getByRole("heading", { level: 1 }).boundingBox();
    const figures = await page.locator("[data-lb-head] dl").boundingBox();
    expect(name && plate && name.y + name.height <= plate.y).toBe(true);
    expect(figures && plate && figures.y + figures.height <= plate.y).toBe(true);
    // "Über mich" shows a drawn still of its own beside the facts, never the plate's (the rotation swaps
    // the two when the header plays the portrait's clip): no visit shows one picture twice.
    const still = async (selector: string) => /ex-motion-[a-z-]+/u.exec((await page.locator(selector).first().getAttribute("src")) ?? "")?.[0] ?? "";
    const [plateStill, portraitStill] = [await still("[data-hero-plate] img"), await still("[data-about-portrait] img")];
    expect(plateStill).toMatch(/^ex-motion-/);
    expect(portraitStill).toMatch(/^ex-motion-/);
    expect(portraitStill).not.toBe(plateStill);
    // The page never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    // Sevag's page is shown as his own (bare): no Linkyo bar comes in.
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-shown]")).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
    await page.context().close();
  });

  test("with reduced motion nothing moves; without it only the hero's lines and the rail move: no parallax, no section rises", async ({ browser }) => {
    const names = (page: Page) =>
      page.evaluate(() => ({
        rise: getComputedStyle(document.querySelector(".poster-rise") ?? document.body).animationName,
        // Round 6 has no parallax: no element carries it.
        drift: document.querySelectorAll(".lb-parallax").length,
        rail: getComputedStyle(document.querySelector(".lb-step") ?? document.body, "::before").animationName,
        // Nothing in the content rises, zooms or fills a reading line as the page scrolls.
        rising: document.querySelectorAll(".lb-reveal, .lb-zoom, .lb-progress, .poster-reveal").length,
        running: document
          .getAnimations()
          .filter((animation) => animation.playState === "running" && animation.timeline === document.timeline)
          .map((animation) => (animation instanceof CSSAnimation ? animation.animationName : "other")),
      }));
    const still = await phone(browser, { reducedMotion: "reduce" });
    await still.goto(SEVAG);
    expect(await names(still)).toEqual({ rise: "none", drift: 0, rail: "none", rising: 0, running: [] });
    // The rail is drawn in full without its animation.
    expect(await still.locator(".lb-step").first().evaluate((step) => getComputedStyle(step, "::before").scale)).toBe("none");
    await still.context().close();
    const moving = await phone(browser, { reducedMotion: "no-preference" });
    await moving.goto(SEVAG);
    const live = await names(moving);
    expect([live.rise, live.drift, live.rail, live.rising]).toEqual(["poster-rise", 0, "lb-fill", 0]);
    await moving.context().close();
  });

  test("phones: the app bar stays away while the name is on screen and fades in, whole, once it has passed under it", async ({ browser }) => {
    const page = await phone(browser);
    await page.goto(SEVAG);
    await page.waitForLoadState("networkidle");
    const bar = page.locator(".poster-bar");
    await expect(bar).toBeHidden();
    // The name passes under the bar: the bar comes, after a short fixed fade (not tied to the scroll).
    await page.getByRole("heading", { level: 1 }).evaluate((name) => window.scrollBy({ top: name.getBoundingClientRect().bottom, behavior: "instant" }));
    await expect(bar).toBeVisible();
    await expect.poll(() => bar.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    // Back up to the name: the bar goes again.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(bar).toBeHidden();
    await page.context().close();
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
    // With a contact block the hero leads with its action (filled), the owner's own CV beside it
    // (soft) on one row: one filled button in the hero, and no Share there (it is the bar's).
    await small.goto(SAMPLE("en"));
    const actions = small.locator("[data-hero-actions]");
    const [ask, cv] = [actions.getByRole("link", { name: "Ask about a project" }), actions.getByRole("link", { name: /^CV/ })];
    await expect(ask).toBeVisible();
    await expect(cv).toBeVisible();
    await expect(actions.getByRole("button", { name: "Share" })).toHaveCount(0);
    const [askBox, cvBox] = [await ask.boundingBox(), await cv.boundingBox()];
    expect(askBox && cvBox && Math.abs(askBox.y - cvBox.y) < 1).toBe(true);
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
        // Wait until the hero's lines have risen in; nothing else on the page fades or rises.
        await expect.poll(() => page.evaluate(() => [...document.querySelectorAll(".poster-rise")].every((element) => getComputedStyle(element).opacity === "1"))).toBe(true);
        const faded = await page.evaluate(() =>
          [...document.querySelectorAll("main :is(section, h2, p, ul, ol, dl)")].filter((element) => element.getBoundingClientRect().top < innerHeight && Number(getComputedStyle(element).opacity) < 1).length,
        );
        expect(faded, `${url} at ${String(viewport.width)}`).toBe(0);
        expect(await axe(page), `${url} at ${String(viewport.width)}`).toEqual([]);
      }
      await context.close();
    }
  });

  test("Shift+Tab from the index back into the hero never leaves focus under the compact bar", async ({ page }) => {
    // The chip index is the tablet's.
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SAMPLE("en"));
    // To the end at once: the End key's scroll is animated by Chrome and could still be running (and pull
    // the page back down) while focus moves up into the hero.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const index = page.getByRole("navigation", { name: "Sections" });
    await index.getByRole("link").first().focus();
    const bar = page.locator(".poster-bar");
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press("Shift+Tab");
      const [focused, barBox] = [await page.evaluate(() => document.activeElement?.getBoundingClientRect().toJSON() as DOMRect), await bar.boundingBox()];
      // Back in the hero, with the name on screen, the bar has gone (no box): nothing can be under it.
      expect(barBox === null || focused.top >= barBox.y + barBox.height).toBe(true);
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

  test("short screens (a landscape phone, 200 % zoom): the white words keep AA on the ink head and stay clear of the badge", async ({ browser }) => {
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
        // On ink (round 6 sets no words over the picture): at least 4.5 : 1 on every pixel behind them.
        expect(await wordsContrast(page), `${url} at ${String(viewport.width)}x${String(viewport.height)}`).toBeGreaterThanOrEqual(4.5);
        await context.close();
      }
    }
  });

  test("Arabic pages are mirrored: the name, the contents, the skills and the timeline start on the right", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SAMPLE("ar"));
    await expect(page.locator("[lang='ar']").first()).toHaveAttribute("dir", "rtl");
    const name = await page.getByRole("heading", { level: 1 }).boundingBox();
    // The name's lines end at the right gutter.
    const right = await page.getByRole("heading", { level: 1 }).evaluate((h1) => Math.max(...[...h1.querySelectorAll("bdi")].map((bdi) => bdi.getBoundingClientRect().right)));
    expect(name && right > 390 - 40).toBe(true);
    // The contents sheet reads from the right, in Arabic.
    await page.waitForLoadState("networkidle");
    await page.locator(".lb-step").first().scrollIntoViewIfNeeded();
    await page.locator(".poster-bar").getByRole("button", { name: /فتح المحتويات/ }).click();
    const sheet = page.getByRole("dialog", { name: "المحتويات" });
    await expect(sheet).toBeVisible();
    const [sheetBox, rowText] = [await sheet.boundingBox(), await sheet.getByRole("link").first().locator("span[dir]").boundingBox()];
    expect(sheetBox && rowText && rowText.x + rowText.width > sheetBox.x + sheetBox.width * 0.6).toBe(true);
    await page.keyboard.press("Escape");
    // Skills carry their icons at the right, the label to their left.
    const tile = page.getByRole("region", { name: "المهارات والأدوات" }).getByRole("listitem").first();
    const [tileBox, iconBox] = [await tile.boundingBox(), await tile.locator("svg").boundingBox()];
    expect(tileBox && iconBox && iconBox.x > tileBox.x + tileBox.width / 2).toBe(true);
    // A timeline's rail and dots stand at the right of its words: the rail is the step's first column
    // (the rightmost in Arabic), the words to its left, each dot centred on the rail.
    const step = page.locator("li:has(> .lb-step)").first();
    const [item, rail, dot, words] = [await step.boundingBox(), await step.locator(".lb-step").boundingBox(), await step.locator(".lb-step > span").boundingBox(), await step.locator("[data-lb-entry]").boundingBox()];
    const where = JSON.stringify({ item, rail, dot, words });
    expect(item && rail && dot && words, where).toBeTruthy();
    if (item && rail && dot && words) {
      expect(rail.x + rail.width >= item.x + item.width - 1 && rail.x >= words.x + words.width - 1, where).toBe(true);
      expect(Math.abs(dot.x + dot.width / 2 - (rail.x + rail.width / 2)), where).toBeLessThanOrEqual(0.5);
    }
    await page.context().close();
  });
});
