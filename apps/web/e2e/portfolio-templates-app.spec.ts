import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Stage 3's portfolio templates (Leuchttisch, Grundriss, Logbuch) and the wide-canvas fixes (WP3.2):
 * axe on the three looks in every language, Leuchttisch's pictures uncropped and wider than the work
 * canvas on a large screen while its text keeps the creator column, Grundriss's figures isolated in
 * Arabic, Logbuch's log by year, the strip on a phone, rows of social icons without an orphan, and the
 * laptop's first screen filled on text-only heroes, About and Folio.
 *
 * Checked with reduced motion (see portfolio-a11y.spec.ts for why). Laptop checks run on the desktop
 * project; phone checks set their own 390 × 844 viewport and run on both projects.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOOKS = ["leuchttisch", "grundriss", "logbuch"] as const;
const sample = (locale: string, template: string, portfolio = true) => `/${locale}/directions/poster?chrome=0&template=${template}${portfolio ? "&page=portfolio" : ""}`;

async function open(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // A visitor who answered the privacy notice (it would cover the first screen).
  await page.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

/** Nothing wider than the screen. */
async function fits(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("the three looks", () => {
  for (const template of LOOKS) {
    for (const locale of ["de", "en", "ar"] as const) {
      test(`${template} in ${locale}: axe-clean, in its language and direction, nothing too wide`, async ({ page }) => {
        test.setTimeout(90_000);
        await open(page, sample(locale, template));
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        expect(await axe(page)).toEqual([]);
        await fits(page);
        // One h1, the name; the hero's action leads to the contact.
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        // Nothing moves with reduced motion.
        const moving = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running" && animation.timeline === document.timeline).length);
        expect(moving).toBe(0);
      });
    }
  }
});

test.describe("on the laptop", () => {
  test.skip(({ isMobile }) => isMobile, "laptop widths");

  test("Leuchttisch: the pictures run uncropped across the wall, wider than the work canvas, while the text keeps the creator column", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await open(page, sample("de", "leuchttisch"));
    const main = page.locator("main");
    const run = main.locator("ul").filter({ has: page.locator("[data-cover]") }).first();
    await expect(run).toBeVisible();
    const width = await run.evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(1120);
    // Every picture of the run and of the strip at its own ratio: the box keeps the file's ratio (±1 %).
    await page.evaluate(async () => {
      for (const image of document.images) if (!image.complete) await new Promise((resolve) => image.addEventListener("load", resolve, { once: true }));
    });
    const ratios = await page.locator("[data-cover='picture'] img, header [data-plate] img").evaluateAll((images) =>
      images.map((image) => {
        const img = image as HTMLImageElement;
        const box = img.getBoundingClientRect();
        return { box: box.width / box.height, file: img.naturalWidth / img.naturalHeight };
      }),
    );
    expect(ratios.length).toBeGreaterThan(3);
    for (const { box, file } of ratios) expect(Math.abs(box / file - 1)).toBeLessThanOrEqual(0.01);
    // The strip in the hero is one row wider than the work canvas.
    const strip = await page.locator("header [data-plate]").evaluateAll((plates) => {
      const boxes = plates.map((plate) => plate.getBoundingClientRect());
      return { width: Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left)), tops: new Set(boxes.map((box) => Math.round(box.top))).size, heights: boxes.map((box) => Math.round(box.height)) };
    });
    expect(strip.width).toBeGreaterThan(1120);
    expect(strip.tops).toBe(1);
    expect(Math.max(...strip.heights) - Math.min(...strip.heights)).toBeLessThanOrEqual(1);
    // A row that fits is no "scrollable row" and no stop for the keyboard (on a phone it is, see below).
    await expect(page.locator("header").getByRole("region")).toHaveCount(0);
    await expect(page.locator("header [data-plate]").first().locator("xpath=ancestor::*[@tabindex='0']")).toHaveCount(0);
    // Text keeps the creator column (layout.creator, 560 px): every paragraph of the page, but a caption under a picture (as wide as it).
    const widest = await page.locator("main p, header p").evaluateAll((paragraphs) => Math.max(...paragraphs.filter((p) => !p.closest("li")?.querySelector("[data-plate]")).map((p) => p.getBoundingClientRect().width)));
    expect(widest).toBeLessThanOrEqual(560.5);
    await fits(page);
    // Merle's page (Leuchttisch): the same on a real portfolio, quotes and About included.
    await open(page, "/de/p/merle-kastorf");
    const longest = await page.locator("main p").evaluateAll((paragraphs) => Math.max(...paragraphs.filter((p) => !p.closest("li")?.querySelector("[data-plate], [data-cover]")).map((p) => p.getBoundingClientRect().width)));
    expect(longest).toBeLessThanOrEqual(560.5);
    await fits(page);
  });

  test("Grundriss: the title block beside the lead cover, column guides behind the canvas, sheets with their facts", async ({ page }) => {
    await open(page, sample("de", "grundriss"));
    const header = page.locator("header").first();
    const block = await header.locator("dl").first().evaluate((element) => element.getBoundingClientRect());
    const plate = await header.locator("[data-plate]").first().evaluate((element) => element.getBoundingClientRect());
    // The block in the first five columns, the plate in the other seven, side by side.
    expect(block.right).toBeLessThan(plate.left);
    expect(plate.width).toBeGreaterThan(block.width);
    await expect(page.locator("[data-column-guides] span")).toHaveCount(12);
    // With more contrast asked for, the guides go.
    await page.emulateMedia({ contrast: "more", reducedMotion: "reduce" });
    await expect(page.locator("[data-column-guides] > div")).toBeHidden();
    // A sheet: the cover in seven columns, the facts beside it.
    const sheet = page.locator("main li#stadtbad");
    const cover = await sheet.locator("[data-cover]").evaluate((element) => element.getBoundingClientRect());
    const facts = await sheet.locator("dl").evaluate((element) => element.getBoundingClientRect());
    expect(cover.right).toBeLessThan(facts.left);
    await expect(sheet.locator("dt").first()).toHaveText("Rolle");
  });

  test("Logbuch: the work as a log by year, the year staying under the bar while its entries pass", async ({ page }) => {
    await open(page, sample("en", "logbuch"));
    const years = page.locator("main ol[aria-labelledby]");
    expect(await years.count()).toBeGreaterThan(1);
    const labels = await page.locator("main ol[aria-labelledby]").evaluateAll((lists) => lists.map((list) => document.getElementById(list.getAttribute("aria-labelledby") ?? "")?.textContent.trim() ?? ""));
    // The latest year first.
    const numbers = labels.map(Number).filter((year) => Number.isFinite(year));
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
    const label = page.locator("main p[id]").first();
    await expect(label).toHaveCSS("position", "sticky");
    // A running project says so in words, with a dot that is decoration only.
    await expect(page.locator("main li#rasterblick")).toContainText("ongoing");
    // The README's facts: the stack from the skills, the place, the repositories.
    const facts = page.locator("header dl").first();
    await expect(facts).toContainText("Berlin");
    await expect(facts).toContainText("milaaurel/rasterblick");
  });

  test("a section title beside its content stands at the top of the section, not in its middle (Logbuch, Grundriss)", async ({ page }) => {
    for (const template of ["logbuch", "grundriss"]) {
      await open(page, sample("de", template));
      const offsets = await page.locator("main section > h2").evaluateAll((titles) =>
        titles.flatMap((title) => {
          const content = title.parentElement?.lastElementChild;
          const box = title.getBoundingClientRect();
          // Only titles beside their content (the content starts to the side of the title, not below it).
          if (!content || content === title || content.getBoundingClientRect().top >= box.bottom) return [];
          return [Math.round(box.top - content.getBoundingClientRect().top)];
        }),
      );
      expect(offsets.length, template).toBeGreaterThan(0);
      for (const offset of offsets) expect(Math.abs(offset), `${template}: ${offsets.join(", ")}`).toBeLessThanOrEqual(8);
    }
  });

  test("a text-only hero fills both halves of the first screen (P-08): Elena in Arabic and Tobin", async ({ page }) => {
    for (const path of ["/ar/p/elena-novak", "/en/p/tobin-achterberg"]) {
      await open(page, path);
      const halves = await page.evaluate(() => {
        const middle = window.innerWidth / 2;
        const parts = [...document.querySelectorAll("header *")].filter((element) => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const leaf = element.children.length === 0 || element.tagName === "IMG" || (element as HTMLElement).dataset.plate !== undefined;
          return leaf && box.width > 0 && box.height > 0 && box.top < window.innerHeight && style.visibility !== "hidden" && (element.textContent.trim() !== "" || element.tagName === "IMG" || (element as HTMLElement).dataset.plate !== undefined);
        });
        return { start: parts.some((element) => element.getBoundingClientRect().left < middle - 40), end: parts.some((element) => element.getBoundingClientRect().right > middle + 40) };
      });
      expect(halves, path).toEqual({ start: true, end: true });
      await fits(page);
    }
    // Tobin's statement hero: the sentence follows the role line at the header's gap (20 px), however
    // tall the numbers, the action and the profiles beside them are.
    const gap = await page.locator("header p.text-h3").first().evaluate((role) => {
      const sentence = role.nextElementSibling;
      return sentence ? sentence.getBoundingClientRect().top - role.getBoundingClientRect().bottom : null;
    });
    expect(gap).not.toBeNull();
    expect(gap ?? 0).toBeLessThanOrEqual(24);
  });

  test("About spans at least ten of the twelve columns (P-09), and Folio uses the wide canvas (C-06)", async ({ page }) => {
    await open(page, "/de/p/ronja-feldkamp");
    const about = page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: /Über mich/ }) });
    const span = await about.locator("p, dl").evaluateAll((parts) => {
      const boxes = parts.map((part) => part.getBoundingClientRect());
      return Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left));
    });
    // Ten columns of the canvas (layout.work 1120, gaps of 24): 10 × 71.33 + 9 × 24.
    expect(span).toBeGreaterThanOrEqual(929);
    await open(page, "/de/p/jonas-ek");
    const width = await page.locator("main").evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(1000);
    await fits(page);
  });
});

test.describe("on a phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("Leuchttisch: the strip swipes picture by picture, each picture whole on the screen, at most 70svh tall", async ({ page }) => {
    await open(page, sample("ar", "leuchttisch"));
    const strip = page.getByRole("region", { name: /قابل للتمرير|scroll/i }).first();
    await expect(strip).toBeVisible();
    const boxes = await page.locator("header [data-plate]").evaluateAll((plates) => plates.map((plate) => plate.getBoundingClientRect()).map((box) => ({ width: box.width, height: box.height })));
    expect(boxes.length).toBeGreaterThan(1);
    for (const box of boxes) {
      expect(box.width).toBeLessThanOrEqual(390 - 40);
      expect(box.height).toBeLessThanOrEqual(844 * 0.7 + 1);
    }
    await fits(page);
  });

  test("no row of social icons ends with a single icon, on any common phone width", async ({ page }) => {
    test.setTimeout(120_000);
    // 360 (many Androids), 375 (iPhone SE and mini), 390, 430 and 440 (the large iPhones).
    for (const width of [360, 375, 390, 430, 440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const template of ["nocturne", "signal", "bloom", "tiefdruck", "leuchttisch", "grundriss", "logbuch"]) {
        await open(page, sample("de", template, false));
        const rows = await page.locator("header ul[data-block] > li").evaluateAll((items) => {
          const tops = new Map<number, number>();
          for (const item of items) {
            const top = Math.round(item.getBoundingClientRect().top);
            tops.set(top, (tops.get(top) ?? 0) + 1);
          }
          return [...tops.values()];
        });
        expect(rows.length, template).toBeGreaterThan(0);
        if (rows.length > 1) expect(rows.at(-1), `${template} at ${String(width)} px: ${rows.join(" + ")}`).toBeGreaterThan(1);
      }
    }
  });

  test("Grundriss in Arabic keeps Latin figures whole: every fact of a sheet is isolated", async ({ page }) => {
    await open(page, sample("ar", "grundriss"));
    const facts = await page.locator("main li dd").evaluateAll((values) => values.map((value) => ({ text: value.textContent, isolated: value.querySelector("bdi") !== null })));
    expect(facts.length).toBeGreaterThan(3);
    for (const fact of facts) expect(fact.isolated, fact.text).toBe(true);
    // The years and figures read as written, left to right.
    await expect(page.locator("main li#stadtbad dd bdi").filter({ hasText: "2024–2025" })).toHaveCount(1);
    await fits(page);
  });
});
