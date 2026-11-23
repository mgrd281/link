import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * A project's own page (plan §1.5): on the example pages in their languages, and on the portfolio
 * sample's project route, where every template × language can be rendered. A card opens the
 * project and the bar returns to the card; pictures keep their stored ratio and never outgrow the
 * screen; story text keeps a reading width; focus never hides under the bar; only the code box
 * scrolls sideways; everything that matters is in the server HTML; nothing is stored, no cookie is
 * set and nothing is loaded from another origin; axe finds nothing.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const TEMPLATES = ["werkbogen", "tiefdruck"] as const;
const LOCALES = ["de", "en", "ar"] as const;
/** The sample's project with twelve pictures and its project with a repository and a code sample. */
const SAMPLE_PROJECTS = ["hafenlicht", "rasterblick"] as const;

const sample = (locale: string, template: string, slug: string) => `/${locale}/directions/poster/work/${slug}?chrome=0&template=${template}`;

/** One example page and one of its projects that has a page, in the example's own language. */
const EXAMPLES = [
  { locale: "de", slug: "ronja-feldkamp", project: "die-schneiderinnen", title: "Die Schneiderinnen" },
  { locale: "en", slug: "tobin-achterberg", project: "plotweft", title: "Plotweft" },
  { locale: "ar", slug: "naya-aldabbas", project: "accountant-to-analyst", title: "من محاسبة إلى محللة بيانات في 8 أشهر" },
] as const;

async function load(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  return response;
}

/** Every picture box (cover and pictures) with its stored size and its rendered box. */
async function pictureBoxes(page: Page) {
  return page.locator("[data-cover], [data-picture-box]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { w: Number(node.getAttribute("data-w") ?? 0), h: Number(node.getAttribute("data-h") ?? 0), width: rect.width, height: rect.height };
    }),
  );
}

test.describe("example pages", () => {
  for (const example of EXAMPLES) {
    test(`${example.slug}: a card opens the project in one tap, and the bar leads back to that card`, async ({ page }) => {
      await load(page, `/${example.locale}/p/${example.slug}`);
      const card = page.locator(`a[href="/${example.locale}/p/${example.slug}/${example.project}"]`).first();
      await card.scrollIntoViewIfNeeded();
      await card.click();
      await expect(page).toHaveURL(new RegExp(`/${example.locale}/p/${example.slug}/${example.project}$`));
      await expect(page.locator("h1")).toHaveText(example.title);
      // Its own title, description and link preview.
      await expect(page).toHaveTitle(new RegExp(`^${example.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · `));
      expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
      const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
      expect(og).toBeTruthy();
      const image = await page.request.get(new URL(og ?? "", page.url()).pathname);
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"]).toBe("image/png");
      // Back: to the portfolio, at the card this project came from.
      await page.locator("[data-project-bar] a").first().click();
      await expect(page).toHaveURL(new RegExp(`/${example.locale}/p/${example.slug}#${example.project}$`));
      await expect(page.locator(`[id="${example.project}"]`)).toBeInViewport();
    });
  }

  test("a thin project's card opens its own link, and its address still answers", async ({ page }) => {
    await load(page, "/ar/p/naya-aldabbas");
    const card = page.locator('[id="cv-is-not-your-story"]');
    const href = await card.locator("a").first().getAttribute("href");
    expect(href).toMatch(/^https:\/\/example\.com\//);
    await load(page, "/ar/p/naya-aldabbas/cv-is-not-your-story");
    await expect(page.locator("h1")).toHaveText("Your CV Is Not Your Story");
  });

  test("an unknown project answers 404 with the way back to its page", async ({ page }) => {
    const response = await page.goto("/de/p/ronja-feldkamp/gibt-es-nicht");
    expect(response?.status()).toBe(404);
    const back = page.locator("[data-project-back]");
    await expect(back).toHaveAttribute("href", "/de/p/ronja-feldkamp");
    await expect(back).toContainText("Zur Seite");
    await back.click();
    await expect(page).toHaveURL(/\/de\/p\/ronja-feldkamp$/);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("the Example badge shows under the bar, never over it, and names the photographers", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await load(page, "/de/p/ronja-feldkamp/hafenlicht");
    const badge = page.locator("[data-preview-badge]");
    await expect(badge).toBeVisible();
    const bar = await page.locator("[data-project-bar]").boundingBox();
    const label = await badge.boundingBox();
    expect(bar && label).toBeTruthy();
    if (!bar || !label) return;
    expect(label.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    await badge.getByRole("button").last().click();
    await expect(page.locator("#preview-info")).toContainText("Paul Einerhand");
    // The portfolio page says the same, and its label covers neither the plate nor the name.
    await load(page, "/de/p/ronja-feldkamp");
    await page.locator("[data-preview-badge]").getByRole("button").last().click();
    await expect(page.locator("#preview-info")).toContainText("Paul Einerhand");
    await page.keyboard.press("Escape");
    const top = await page.locator("[data-preview-badge]").boundingBox();
    const plate = await page.locator("header [data-plate]").boundingBox();
    const name = await page.locator("h1").boundingBox();
    if (!top || !plate || !name) throw new Error("no boxes");
    for (const other of [plate, name]) expect(top.y + top.height <= other.y || other.y + other.height <= top.y).toBe(true);
  });
});

test.describe("project pages of the sample, every template and language", () => {
  for (const template of TEMPLATES) {
    for (const locale of LOCALES) {
      test(`${template} ${locale}: pictures, reading width, focus, overflow, privacy and axe`, async ({ page, baseURL }) => {
        const origin = new URL(baseURL ?? "http://localhost:3100").origin;
        const foreign: string[] = [];
        page.on("request", (request) => {
          const address = request.url();
          if (/^https?:/.test(address) && new URL(address).origin !== origin) foreign.push(address);
        });
        await page.addInitScript(() => {
          const counter = window as unknown as { __writes: number };
          counter.__writes = 0;
          // Every write to local or session storage is counted (and still made).
          const original = Object.getOwnPropertyDescriptor(Storage.prototype, "setItem")?.value as (this: Storage, key: string, value: string) => void;
          Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
            counter.__writes += 1;
            original.call(this, key, value);
          };
        });
        for (const slug of SAMPLE_PROJECTS) {
          await page.setViewportSize({ width: 1280, height: 800 });
          await load(page, sample(locale, template, slug));
          // Every picture box at its stored ratio, none taller than the screen.
          const boxes = await pictureBoxes(page);
          expect(boxes.length, slug).toBeGreaterThan(0);
          for (const item of boxes) {
            if (item.w && item.h) expect(Math.abs(item.width / item.height - item.w / item.h), `${slug} ${String(item.w)}×${String(item.h)}`).toBeLessThanOrEqual(0.01);
            expect(item.height).toBeLessThanOrEqual(800);
          }
          // Story text keeps a reading width.
          for (const width of [768, 1280, 1920]) {
            await page.setViewportSize({ width, height: 900 });
            const widths = await page.locator("[data-story] p").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
            for (const measured of widths) expect(measured, `${slug} at ${String(width)}`).toBeLessThanOrEqual(640.5);
          }
          // Tabbing: the focused element is never under the bar, going down and coming back up (going
          // down, the browser scrolls a target in from the bottom; only on the way back up does
          // scroll-padding-top keep it out from under the bar).
          await page.setViewportSize({ width: 390, height: 844 });
          await load(page, sample(locale, template, slug));
          const barBottom = (await page.locator("[data-project-bar]").boundingBox())?.height ?? 64;
          expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop), slug).toBe(`${String(barBottom)}px`);
          for (const key of ["Tab", "Shift+Tab"]) {
            for (let step = 0; step < 30; step += 1) {
              await page.keyboard.press(key);
              const focus = await page.evaluate(() => {
                const active = document.activeElement;
                if (!active || active === document.body) return null;
                const rect = active.getBoundingClientRect();
                return { top: rect.top, inBar: active.closest("[data-project-bar]") !== null, tag: active.tagName };
              });
              if (!focus || focus.inBar) continue;
              expect(focus.top, `${slug} ${key} ${String(step)} ${focus.tag}`).toBeGreaterThanOrEqual(barBottom - 1);
            }
          }
          // At 320 px only the code box scrolls sideways.
          await page.setViewportSize({ width: 320, height: 640 });
          await load(page, sample(locale, template, slug));
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, slug).toBeLessThanOrEqual(0);
          if (slug === "rasterblick") {
            const region = page.locator("[data-code-box] [role=region]");
            expect(await region.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
          }
          const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
          expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`), slug).toEqual([]);
        }
        expect(await page.context().cookies()).toEqual([]);
        expect(await page.evaluate(() => (window as unknown as { __writes: number }).__writes)).toBe(0);
        expect(foreign).toEqual([]);
      });
    }
  }

  test("without script: the install command and the sample are selectable text, and a picture opens its own file", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, ...(baseURL ? { baseURL } : {}) });
    const page = await context.newPage();
    try {
      await load(page, sample("ar", "tiefdruck", "rasterblick"));
      const code = page.locator("[data-code]");
      await expect(code).toContainText('import { chart } from "rasterblick";');
      expect(await code.evaluate((node) => getComputedStyle(node).userSelect)).not.toBe("none");
      await expect(page.getByText("npm install https://example.com/rasterblick.tgz")).toBeVisible();
      await load(page, sample("de", "werkbogen", "hafenlicht"));
      const links = page.locator("[data-viewer]");
      expect(await links.count()).toBeGreaterThan(5);
      const href = (await links.first().getAttribute("href")) ?? "";
      expect(href.startsWith("/_next/image?")).toBe(true);
      const file = await page.request.get(href);
      expect(file.status()).toBe(200);
      expect(file.headers()["content-type"]).toMatch(/^image\//);
      // Its name: the owner's description, then "Enlarge, picture 1 of N".
      const name = await links.first().evaluate((node) => `${node.querySelector("img")?.getAttribute("alt") ?? ""} ${node.textContent}`);
      expect(name).toMatch(/\S.* Vergrößern, Bild 1 von \d+/);
      // The way back and the cards work as plain links.
      await expect(page.locator("[data-project-bar] a").first()).toHaveAttribute("href", /\/de\/directions\/poster\?.*page=portfolio.*#hafenlicht$/);
    } finally {
      await context.close();
    }
  });

  test("no picture is served wider than 1.5 × its drawn width × the pixel density (P10)", async ({ browser, baseURL }, testInfo) => {
    // Each screen is its own context (a picture cached at another size would be reused), so the
    // desktop project covers phones as well; the mobile project would only repeat it.
    test.skip(testInfo.project.name !== "desktop", "Every screen below runs in the desktop project.");
    test.setTimeout(240_000);
    const screens = [
      { width: 390, height: 844, dpr: 3 },
      { width: 412, height: 915, dpr: 2.625 },
      { width: 768, height: 1024, dpr: 1 },
      { width: 768, height: 1024, dpr: 2 },
      { width: 1280, height: 800, dpr: 1 },
      { width: 1366, height: 768, dpr: 1 },
      { width: 1440, height: 900, dpr: 1 },
    ];
    // Twelve pictures in every kind of row; a portrait cover; the sample's quote photo and code project.
    const pages = ["/de/p/ronja-feldkamp/hafenlicht", "/de/p/jorinde-ahlfeld/sechs-stuehle", sample("en", "werkbogen", "rasterblick")];
    for (const path of pages) {
      for (const { width, height, dpr } of screens) {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: "reduce", ...(baseURL ? { baseURL } : {}) });
        const page = await context.newPage();
        try {
          await load(page, path);
          const images = page.locator("[data-project-page] img");
          const count = await images.count();
          expect(count, path).toBeGreaterThan(0);
          for (let index = 0; index < count; index += 1) {
            const image = images.nth(index);
            if (!(await image.isVisible())) continue;
            await image.scrollIntoViewIfNeeded();
            await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
          }
          const drawn = await images.evaluateAll((nodes) =>
            nodes.map((node) => ({ src: (node as HTMLImageElement).currentSrc, natural: (node as HTMLImageElement).naturalWidth, width: node.getBoundingClientRect().width })),
          );
          for (const item of drawn) {
            if (item.width === 0) continue;
            expect(item.natural, `${path} at ${String(width)}×${String(height)}@${String(dpr)}: ${item.src} drawn ${item.width.toFixed(0)} px`).toBeLessThanOrEqual(Math.ceil(1.5 * item.width * dpr));
          }
        } finally {
          await context.close();
        }
      }
    }
  });

  test("the sample portfolio's cards lead to these pages, in the same template", async ({ page }) => {
    await load(page, "/en/directions/poster?chrome=0&template=tiefdruck&page=portfolio");
    const card = page.locator('a[href="/en/directions/poster/work/rasterblick?chrome=0&template=tiefdruck"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page).toHaveURL(/\/en\/directions\/poster\/work\/rasterblick\?chrome=0&template=tiefdruck$/);
    await expect(page.locator("h1")).toHaveText("rasterblick");
    // Unknown slugs and other directions answer "not found".
    expect((await page.goto("/en/directions/poster/work/nope"))?.status()).toBe(404);
    expect((await page.goto("/en/directions/gallery/work/rasterblick"))?.status()).toBe(404);
  });
});
