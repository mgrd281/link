import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * WP8 on the project and portfolio pages (plan v8 §1.5.7, audit P-01, P-02, W-09, W-14, C-09):
 * a press on a project picture opens it full screen in a native dialog instead of downloading it;
 * a swipe, the arrow keys and the buttons move through the pictures; Escape, Close and the phone's
 * back gesture close it and give focus back without moving the page; Arabic follows the visual
 * direction; the viewer's code only loads on that first press. Rows of project cards page with
 * buttons for a mouse. Examples asked for in another language lead to their own; a missing
 * project names its owner; creator pages cross-fade, nothing else does.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const HAFENLICHT = "/de/p/ronja-feldkamp/hafenlicht";
/** The same project in Arabic (no Arabic example has project pictures; the sample route has them all). */
const HAFENLICHT_AR = "/ar/directions/poster/work/hafenlicht?chrome=0&template=werkbogen";
const rails = (locale: string) => `/${locale}/directions/poster?chrome=0&template=tiefdruck&page=portfolio&projects=rail`;

async function load(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

/** The page is hydrated: a press on a picture now opens the viewer. */
async function viewerReady(page: Page): Promise<void> {
  await expect(page.locator("[data-viewer-ready]")).toHaveCount(1);
}

const viewer = (page: Page) => page.locator("dialog[data-picture-viewer]");
const counter = (page: Page) => viewer(page).locator("[data-viewer-counter]");
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
/** The position in session history (Navigation API): one entry more while the viewer is open. */
const entry = (page: Page) => page.evaluate(() => (window as unknown as { navigation: { currentEntry: { index: number } } }).navigation.currentEntry.index);

/** A press as the device makes it: a tap on a phone, a click with a mouse. */
async function press(target: Locator, touch: boolean): Promise<void> {
  if (touch) await target.tap();
  else await target.click();
}

/** A sideways swipe on the viewer's track: a finger on a phone, a trackpad's sideways scroll on a laptop. */
/** Waits until a scroller has come to rest (a smooth scroll or a snap has finished). */
async function settled(scroller: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const before = await scroller.evaluate((element) => element.scrollLeft);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return (await scroller.evaluate((element) => element.scrollLeft)) === before;
    })
    .toBe(true);
}

async function swipe(page: Page, touch: boolean, direction: 1 | -1): Promise<void> {
  const track = viewer(page).locator("[data-viewer-track]");
  const box = await track.boundingBox();
  if (!box) throw new Error("no track");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (touch) {
    // A finger drawn across 60 % of the track: to the left (direction 1) or to the right (-1).
    const client = await page.context().newCDPSession(page);
    const from = x + (direction * box.width * 0.3);
    const to = x - (direction * box.width * 0.3);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] });
    for (let step = 1; step <= 12; step += 1) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from + ((to - from) * step) / 12, y }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await client.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.wheel(direction * box.width * 0.6, 0);
  }
}

test.describe("picture viewer", () => {
  test("a press on picture 3 opens it full screen without a download, a swipe goes on, Escape closes and focus returns", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.suggestedFilename()));
    await load(page, HAFENLICHT);
    await viewerReady(page);
    const link = page.locator("a[data-viewer]").nth(2);
    await expect(link).toHaveAttribute("data-viewer", "3");
    await expect(link).toHaveAttribute("data-total", "11");
    await link.scrollIntoViewIfNeeded();
    const before = await scrollY(page);
    const at = await entry(page);

    await press(link, touch);
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page)).toHaveAttribute("open", "");
    await expect(counter(page)).toHaveText("3 / 11");
    await expect(viewer(page).locator("[aria-live=polite]")).toHaveText("Bild 3 von 11");
    await expect(viewer(page).getByRole("button", { name: "Schließen" })).toBeFocused();
    // Full screen, on the page's own ground, the third picture whole in view.
    const size = page.viewportSize();
    const box = await viewer(page).boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(size?.width);
    expect(Math.round(box?.height ?? 0)).toBe(size?.height);
    const shown = viewer(page).locator("img").nth(2);
    await expect(shown).toBeInViewport({ ratio: 0.9 });
    expect(await shown.evaluate((image) => getComputedStyle(image).objectFit)).toBe("contain");
    expect(await entry(page)).toBe(at + 1);
    expect(page.url()).toMatch(/\/de\/p\/ronja-feldkamp\/hafenlicht$/);

    await swipe(page, touch, 1);
    await expect(counter(page)).toHaveText("4 / 11");
    await expect(viewer(page).locator("[aria-live=polite]")).toHaveText("Bild 4 von 11");

    await page.keyboard.press("Escape");
    await expect(viewer(page)).toBeHidden();
    await expect(link).toBeFocused();
    expect(await scrollY(page)).toBe(before);
    expect(await entry(page)).toBe(at);
    expect(downloads).toEqual([]);
    expect(page.url()).toMatch(/\/de\/p\/ronja-feldkamp\/hafenlicht$/);
  });

  test("the back gesture closes the viewer and stays on the page", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    await load(page, HAFENLICHT);
    await viewerReady(page);
    const link = page.locator("a[data-viewer]").nth(5);
    await link.scrollIntoViewIfNeeded();
    const before = await scrollY(page);
    await press(link, touch);
    await expect(counter(page)).toHaveText("6 / 11");
    await page.goBack();
    await expect(viewer(page)).toBeHidden();
    expect(page.url()).toMatch(/\/de\/p\/ronja-feldkamp\/hafenlicht$/);
    await expect(page.locator("h1")).toBeVisible();
    await expect(link).toBeFocused();
    expect(await scrollY(page)).toBe(before);
    // It opens again, and Close closes it the same way.
    await press(link, touch);
    await expect(counter(page)).toHaveText("6 / 11");
    await viewer(page).getByRole("button", { name: "Schließen" }).click();
    await expect(viewer(page)).toBeHidden();
    await expect(link).toBeFocused();
  });

  test("without scrollend (WebKit before Safari 26), a press after a swipe starts from the picture on screen", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    // The engine as iOS browsers had it: no `onscrollend`, no `scrollend` event.
    await page.addInitScript(() => {
      for (const proto of [Window.prototype, Document.prototype, Element.prototype, HTMLElement.prototype]) {
        delete (proto as unknown as Record<string, unknown>).onscrollend;
      }
      const add = Object.getOwnPropertyDescriptor(EventTarget.prototype, "addEventListener")?.value as (this: EventTarget, ...args: unknown[]) => void;
      EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
        if (type === "scrollend") return;
        add.call(this, type, ...rest);
      };
    });
    await load(page, HAFENLICHT);
    await viewerReady(page);
    expect(await page.evaluate(() => "onscrollend" in window)).toBe(false);
    const link = page.locator("a[data-viewer]").nth(2);
    await link.scrollIntoViewIfNeeded();
    await press(link, touch);
    await expect(counter(page)).toHaveText("3 / 11");
    const track = viewer(page).locator("[data-viewer-track]");

    await swipe(page, touch, 1);
    await expect(counter(page)).toHaveText("4 / 11");
    await settled(track);
    await press(viewer(page).getByRole("button", { name: "Nächstes Bild" }), touch);
    await expect(counter(page)).toHaveText("5 / 11");
    await settled(track);
    await swipe(page, touch, 1);
    await expect(counter(page)).toHaveText("6 / 11");
    await settled(track);
    await press(viewer(page).getByRole("button", { name: "Vorheriges Bild" }), touch);
    await expect(counter(page)).toHaveText("5 / 11");
    await settled(track);
    if (!touch) {
      await page.keyboard.press("ArrowRight");
      await expect(counter(page)).toHaveText("6 / 11");
    }
  });

  test("on a laptop the keyboard does it all, and focus stays in the viewer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Keyboard and mouse: the laptop project.");
    await load(page, HAFENLICHT);
    await viewerReady(page);
    const link = page.locator("a[data-viewer]").nth(2);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("3 / 11");
    await page.keyboard.press("ArrowRight");
    await expect(counter(page)).toHaveText("4 / 11");
    await page.keyboard.press("ArrowLeft");
    await expect(counter(page)).toHaveText("3 / 11");
    await page.keyboard.press("End");
    await expect(counter(page)).toHaveText("11 / 11");
    await expect(viewer(page).getByRole("button", { name: "Nächstes Bild" })).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Home");
    await expect(counter(page)).toHaveText("1 / 11");
    await expect(viewer(page).getByRole("button", { name: "Vorheriges Bild" })).toHaveAttribute("aria-disabled", "true");
    // The buttons with a mouse, both sides of the picture.
    await viewer(page).getByRole("button", { name: "Nächstes Bild" }).click();
    await expect(counter(page)).toHaveText("2 / 11");
    // The page behind is inert: Tab goes round the viewer's controls (and the browser's own), never
    // to a link of the page.
    const visited = new Set<string>();
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return "outside the page";
        return active.closest("dialog[data-picture-viewer]") ? (active.getAttribute("aria-label") ?? active.tagName) : `page: ${active.outerHTML.slice(0, 80)}`;
      });
      expect(where).not.toMatch(/^page:/);
      visited.add(where);
    }
    expect([...visited]).toEqual(expect.arrayContaining(["Schließen", "Bildansicht", "Vorheriges Bild", "Nächstes Bild"]));
    const results = await new AxeBuilder({ page }).include("dialog[data-picture-viewer]").withTags(WCAG).analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(viewer(page)).toBeHidden();
    await expect(link).toBeFocused();
  });

  test("in Arabic the arrows follow what the visitor sees", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    await load(page, HAFENLICHT_AR);
    await viewerReady(page);
    const link = page.locator("a[data-viewer]").first();
    await link.scrollIntoViewIfNeeded();
    await press(link, touch);
    await expect(counter(page)).toHaveText("1 / 11");
    expect(await viewer(page).evaluate((element) => getComputedStyle(element).direction)).toBe("rtl");
    // The next picture lies to the left: the left arrow goes on, the right arrow back.
    await page.keyboard.press("ArrowLeft");
    await expect(counter(page)).toHaveText("2 / 11");
    await expect(viewer(page).locator("[aria-live=polite]")).toHaveText("الصورة 2 من 11");
    await page.keyboard.press("ArrowRight");
    await expect(counter(page)).toHaveText("1 / 11");
    // "Next" stands on the left and points left; "previous" on the right.
    const next = await viewer(page).getByRole("button", { name: "الصورة التالية" }).boundingBox();
    const previous = await viewer(page).getByRole("button", { name: "الصورة السابقة" }).boundingBox();
    expect(next && previous && next.x < previous.x).toBe(true);
    // A swipe towards the right (the finger moves right) goes on in Arabic.
    await settled(viewer(page).locator("[data-viewer-track]"));
    await swipe(page, touch, -1);
    await expect(counter(page)).toHaveText("2 / 11");
    await viewer(page).getByRole("button", { name: "إغلاق" }).click();
    await expect(link).toBeFocused();
  });

  test("with reduced motion it opens at once; otherwise it fades with the motion token", async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "A computed style: one project is enough.");
    for (const [reducedMotion, expected] of [
      ["reduce", "none"],
      ["no-preference", "opacity 0.2s"],
    ] as const) {
      const context = await browser.newContext({ reducedMotion, viewport: { width: 1440, height: 900 }, ...(baseURL ? { baseURL } : {}) });
      const page = await context.newPage();
      try {
        await load(page, HAFENLICHT);
        await viewerReady(page);
        await page.locator("a[data-viewer]").first().click();
        await expect(viewer(page)).toBeVisible();
        // No transition at all with reduced motion; otherwise opacity alone, at `duration-standard`.
        const transition = await viewer(page).evaluate((element) => {
          const style = getComputedStyle(element);
          return style.transitionProperty === "none" ? "none" : `${style.transitionProperty} ${style.transitionDuration}`;
        });
        expect(transition, reducedMotion).toBe(expected);
        if (reducedMotion === "reduce") {
          // The buttons move at once too: no glide across the pictures.
          await viewer(page).getByRole("button", { name: "Nächstes Bild" }).click();
          expect(await viewer(page).locator("[data-viewer-track]").evaluate((track) => Math.round(track.scrollLeft / track.clientWidth))).toBe(1);
        }
      } finally {
        await context.close();
      }
    }
  });

  test("without script a picture opens its own file, inline, on our origin", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, ...(baseURL ? { baseURL } : {}) });
    const page = await context.newPage();
    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.suggestedFilename()));
    try {
      await load(page, HAFENLICHT);
      const link = page.locator("a[data-viewer]").nth(2);
      await link.scrollIntoViewIfNeeded();
      const [response] = await Promise.all([page.waitForResponse((candidate) => candidate.url().includes("/_next/image?")  && candidate.request().isNavigationRequest()), link.click()]);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(/^image\//);
      expect(response.headers()["content-disposition"] ?? "").toMatch(/^inline/);
      expect(new URL(page.url()).origin).toBe(new URL(baseURL ?? page.url()).origin);
      expect(downloads).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("the viewer's code is not part of the page's first load; the first press fetches it", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    const scripts: { url: string; body: Promise<string> }[] = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "script") scripts.push({ url: response.url(), body: response.text().catch(() => "") });
    });
    await load(page, HAFENLICHT);
    await viewerReady(page);
    await page.waitForLoadState("networkidle");
    // The viewer's own history marker is a string the dialog's module alone contains.
    const first = await Promise.all(scripts.map(async (script) => ({ url: script.url, viewer: (await script.body).includes("linkyoPictureViewer") })));
    expect(first.length).toBeGreaterThan(0);
    expect(first.filter((script) => script.viewer).map((script) => script.url)).toEqual([]);
    const loaded = scripts.length;
    const link = page.locator("a[data-viewer]").first();
    await link.scrollIntoViewIfNeeded();
    await press(link, touch);
    await expect(viewer(page)).toBeVisible();
    const later = await Promise.all(scripts.slice(loaded).map(async (script) => (await script.body).includes("linkyoPictureViewer")));
    expect(later).toContain(true);
  });

  test("axe finds nothing on the open viewer, in German and Arabic", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    for (const path of [HAFENLICHT, HAFENLICHT_AR]) {
      await load(page, path);
      await viewerReady(page);
      const link = page.locator("a[data-viewer]").nth(1);
      await link.scrollIntoViewIfNeeded();
      await press(link, touch);
      await expect(viewer(page)).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`), path).toEqual([]);
    }
  });
});

test.describe("rows of project cards", () => {
  for (const locale of ["de", "ar"] as const) {
    test(`at 1440 the row pages one card per press, stops at both ends and shows that it goes on (${locale})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "mobile", "Buttons for a mouse: the laptop project (phones swipe).");
      await page.setViewportSize({ width: 1440, height: 900 });
      await load(page, rails(locale));
      const group = page.locator("[data-rail-group]").first();
      await group.scrollIntoViewIfNeeded();
      const rail = group.locator("[data-rail-track]");
      const back = group.getByRole("button", { name: locale === "de" ? "Zurückblättern" : "تمرير للخلف" });
      const on = group.getByRole("button", { name: locale === "de" ? "Weiterblättern" : "تمرير للأمام" });
      await expect(on).toBeVisible();
      await expect(back).toHaveAttribute("aria-disabled", "true");
      await expect(on).not.toHaveAttribute("aria-disabled", "true");
      // The chevrons follow the reading direction: "on" sits at the end of the row.
      const onBox = await on.boundingBox();
      const backBox = await back.boundingBox();
      expect(onBox && backBox && (locale === "ar" ? onBox.x < backBox.x : onBox.x > backBox.x)).toBe(true);

      // The fourth card peeks in at the end: part of it is inside the frame, part outside.
      const frame = await rail.boundingBox();
      const cards = rail.locator("li");
      expect(await cards.count()).toBeGreaterThanOrEqual(4);
      const fourth = await cards.nth(3).boundingBox();
      expect(frame && fourth).toBeTruthy();
      if (!frame || !fourth) return;
      // In Arabic the row runs leftwards: the fourth card peeks in at the left edge.
      const inside = locale === "ar" ? fourth.x + fourth.width - frame.x : frame.x + frame.width - fourth.x;
      const outside = locale === "ar" ? frame.x - fourth.x : fourth.x + fourth.width - (frame.x + frame.width);
      expect(inside, "visible part of the fourth card").toBeGreaterThan(24);
      expect(outside, "hidden part of the fourth card").toBeGreaterThan(24);
      if (locale === "ar") expect(fourth.x).toBeLessThan(frame.x);

      // One press, one card.
      const step = await cards.evaluateAll((items) => Math.abs((items[1]?.getBoundingClientRect().left ?? 0) - (items[0]?.getBoundingClientRect().left ?? 0)));
      await on.click();
      await expect.poll(() => rail.evaluate((element) => Math.round(Math.abs(element.scrollLeft)))).toBe(Math.round(step));
      expect(await rail.evaluate((element) => Math.sign(element.scrollLeft))).toBe(locale === "ar" ? -1 : 1);
      await expect(back).not.toHaveAttribute("aria-disabled", "true");
      // On to the end: there "on" is disabled and a further press does nothing.
      await settled(rail);
      for (let tries = 0; tries < 8 && (await on.getAttribute("aria-disabled")) !== "true"; tries += 1) {
        const at = await rail.evaluate((element) => element.scrollLeft);
        await on.click();
        await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).not.toBe(at);
        await settled(rail);
      }
      await expect(on).toHaveAttribute("aria-disabled", "true");
      const end = await rail.evaluate((element) => element.scrollLeft);
      // A disabled button still takes a press (it keeps focus); it just goes nowhere.
      await on.click({ force: true });
      await page.waitForTimeout(300);
      expect(await rail.evaluate((element) => element.scrollLeft)).toBe(end);
      // And back to the start.
      for (let tries = 0; tries < 8 && (await back.getAttribute("aria-disabled")) !== "true"; tries += 1) {
        const at = await rail.evaluate((element) => element.scrollLeft);
        await back.click();
        await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).not.toBe(at);
        await settled(rail);
      }
      await expect(back).toHaveAttribute("aria-disabled", "true");
      expect(await rail.evaluate((element) => Math.round(element.scrollLeft))).toBe(0);
      const results = await new AxeBuilder({ page }).include("[data-rail-group]").withTags(WCAG).analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }

  test("phones swipe the row and see no buttons", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "The phone project.");
    await load(page, rails("de"));
    const group = page.locator("[data-rail-group]").first();
    await group.scrollIntoViewIfNeeded();
    await expect(group.locator("[data-rail-track]")).toBeVisible();
    await expect(group.locator("[data-rail-buttons]")).toBeHidden();
  });
});

test.describe("addresses of example pages", () => {
  test("an example asked for in another language leads to its own (308); a private preview does not", async ({ page }) => {
    for (const [path, target] of [
      ["/en/p/ronja-feldkamp", "/de/p/ronja-feldkamp"],
      ["/ar/p/ronja-feldkamp", "/de/p/ronja-feldkamp"],
      ["/de/p/tobin-achterberg", "/en/p/tobin-achterberg"],
      ["/en/p/naya-aldabbas", "/ar/p/naya-aldabbas"],
    ] as const) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(308);
      expect(new URL(response.headers().location ?? "", "http://x").pathname, path).toBe(target);
    }
    // An example that exists in every language stays where it is; a preview for one person is not moved.
    expect((await page.request.get("/en/p/journalist", { maxRedirects: 0 })).status()).toBe(200);
    expect((await page.request.get("/en/p/nizar", { maxRedirects: 0 })).status()).toBe(404);
    expect((await page.request.get("/de/p/gibt-es-nicht", { maxRedirects: 0 })).status()).toBe(404);
    const response = await page.goto("/en/p/ronja-feldkamp");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/de\/p\/ronja-feldkamp$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });

  for (const [path, label, home] of [
    ["/de/p/ronja-feldkamp/gibt-es-nicht", "Zurück zu Ronja Feldkamp", "/de/p/ronja-feldkamp"],
    ["/en/p/tobin-achterberg/no-such-project", "Back to Tobin Achterberg", "/en/p/tobin-achterberg"],
    ["/ar/p/tobin-achterberg/no-such-project", "العودة إلى Tobin Achterberg", "/en/p/tobin-achterberg"],
  ] as const) {
    test(`a missing project names whose page leads back (${path})`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      const back = page.locator("[data-project-back]");
      await expect(back).toHaveText(label);
      await expect(back).toHaveAttribute("href", home);
      // The name sits in its own <bdi>: a Latin name in Arabic words keeps its direction.
      await expect(back.locator("bdi")).toHaveText(label.includes("Ronja") ? "Ronja Feldkamp" : "Tobin Achterberg");
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }
});

/** A plain link followed from inside the page: a document navigation, as a visitor's tap makes it. */
async function follow(page: Page, href: string): Promise<void> {
  await page.evaluate((target) => {
    const link = document.createElement("a");
    link.href = target;
    document.body.append(link);
    link.click();
  }, href);
}

test.describe("page cross-fade", () => {
  /** Whether the document that was just shown arrived with a view transition. */
  const revealed = (page: Page) => page.evaluate(() => (window as unknown as { __revealedWithTransition?: boolean }).__revealedWithTransition);

  test("a creator page fades into its project page and back; the website never fades", async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Document navigations: one project is enough.");
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      const context = await browser.newContext({ reducedMotion, viewport: { width: 1440, height: 900 }, ...(baseURL ? { baseURL } : {}) });
      await context.addInitScript(() => {
        window.addEventListener("pagereveal", (event) => {
          (window as unknown as { __revealedWithTransition?: boolean }).__revealedWithTransition = Boolean((event as Event & { viewTransition?: unknown }).viewTransition);
        });
      });
      const page = await context.newPage();
      try {
        await load(page, "/de/p/ronja-feldkamp");
        await page.locator('a[href="/de/p/ronja-feldkamp/die-schneiderinnen"]').first().click();
        await page.waitForURL(/\/die-schneiderinnen$/);
        await expect(page.locator("h1")).toBeVisible();
        expect(await revealed(page), `portfolio → project, ${reducedMotion}`).toBe(reducedMotion === "no-preference");
        await page.locator("[data-project-bar] a").first().click();
        await page.waitForURL(/\/de\/p\/ronja-feldkamp#die-schneiderinnen$/);
        expect(await revealed(page), `project → portfolio, ${reducedMotion}`).toBe(reducedMotion === "no-preference");
        if (reducedMotion === "reduce") continue;
        // Leaving for the website, and the website itself, never fade.
        await follow(page, "/de/templates");
        await page.waitForURL(/\/de\/templates$/);
        await page.waitForLoadState("domcontentloaded");
        expect(await revealed(page), "creator page → website").toBe(false);
        await follow(page, "/de/login");
        await page.waitForURL(/\/de\/login$/);
        await page.waitForLoadState("domcontentloaded");
        expect(await revealed(page), "website → website").toBe(false);
        const rules = await page.evaluate(() =>
          [...document.styleSheets].flatMap((sheet) => {
            try {
              return [...sheet.cssRules].map((rule) => rule.cssText);
            } catch {
              return [];
            }
          }),
        );
        expect(rules.some((rule) => rule.includes("view-transition"))).toBe(false);
      } finally {
        await context.close();
      }
    }
  });
});
