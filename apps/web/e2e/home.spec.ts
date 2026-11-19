import { expect, test } from "@playwright/test";

test.describe("marketing home", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  test("hero states the promise and claims an address with real username rules", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/One link\.\s*Everything you create\./);
    const field = page.getByRole("textbox", { name: "Choose your page address" }).first();
    await field.fill("-bad");
    await field.press("Enter");
    await expect(page.getByText("Use 3–30 lowercase letters").first()).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await field.fill("mila-aurel");
    await field.press("Enter");
    await page.waitForURL("**/en/signup?name=mila-aurel");
  });

  test("pasting a link builds the right block, and examples work with one click", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Paste or type a link" });
    // The demo pops in as its panel scrolls into view (scroll-driven). Bring the panel to the middle
    // first: otherwise the scroll before a click can move a button between press and release.
    await input.evaluate((element) => {
      element.closest(".mk-panel")?.scrollIntoView({ block: "center" });
    });
    await input.fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    await expect(page.getByText("Recognised: Music")).toBeVisible();
    await input.press("Enter");
    const list = page.getByRole("list").filter({ has: page.getByRole("button", { name: /^Remove / }) });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await page.getByRole("button", { name: "YouTube", exact: true }).click();
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: /^Remove Music/ }).click();
    await expect(list.getByRole("listitem")).toHaveCount(1);
  });

  test("the template strip has no motion of its own: it slides with the page, nothing to pause", async ({ page }) => {
    const strip = page.getByRole("list", { name: "Templates" });
    await expect(strip.getByRole("link")).toHaveCount(16);
    // Driven by scrolling (a view timeline), never by a clock; so no pause button (WCAG 2.2.2).
    await expect(strip).toHaveCSS("animation-name", "mk-drift");
    expect(await strip.evaluate((list) => getComputedStyle(list).getPropertyValue("animation-timeline"))).toContain("view");
    await expect(page.getByRole("button", { name: /^(Pause|Play) the template strip$/ })).toHaveCount(0);
  });

  test("real example pages frame a two-line headline, whole on the first screen; each opens its page", async ({ page }) => {
    const title = page.getByRole("heading", { level: 1 });
    const pages = page.getByRole("list", { name: "Example pages" });
    // Four pages beside the headline; the fifth belongs to the phone fan and is hidden here.
    const links = pages.getByRole("link");
    await expect(links).toHaveCount(4);
    // Let the pages finish rising in once; after that nothing moves on its own (no carousel, no tabs).
    await pages.evaluate((list) => Promise.all(list.getAnimations({ subtree: true }).map((animation) => animation.finished)));
    await expect(page.getByRole("tab")).toHaveCount(0);

    // The promise on two lines, the sentence under it on one.
    const lines = (selector: string) =>
      page.locator(selector).evaluate((element) => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
    expect(await lines("#hero-title")).toBe(2);
    expect(await lines("#hero-title + p")).toBe(1);

    // Wide screens: four pages beside the headline (the fifth is for the phone fan), each whole inside
    // the first screen and never over the text.
    const heading = await title.boundingBox();
    const viewport = page.viewportSize();
    let shown = 0;
    for (const link of await links.all()) {
      if (!(await link.isVisible())) continue;
      shown += 1;
      const box = await link.boundingBox();
      if (!box || !heading || !viewport) throw new Error("no layout");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.x + box.width <= heading.x || box.x >= heading.x + heading.width).toBe(true);
      await expect(link).toHaveAttribute("href", /^\/(de|en|ar)\/p\/[a-z0-9-]+$/);
    }
    expect(shown).toBe(4);

    // Hovering a page straightens it and shows its address.
    const lou = pages.getByRole("link", { name: /Lou Ferreira/ });
    await expect(lou).toHaveAttribute("href", "/de/p/lou-ferreira");
    await lou.hover();
    await expect(lou.getByText("linkyo.app/lou-ferreira")).toHaveCSS("opacity", "1");

    const example = page.getByRole("link", { name: /^See .+'s example page$/ }).first();
    await expect(example).toHaveAttribute("href", /^\/(de|en|ar)\/p\/[a-z0-9-]+$/);
    // The four feature panels are there, with the paste demo inside one of them.
    await expect(page.getByRole("heading", { level: 3, name: "A page that looks like you" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Share like a pro" })).toBeAttached();
  });

  test("FAQ answers open in place", async ({ page }) => {
    const answer = page.getByText("Creator pages set no cookies and load no trackers.");
    await expect(answer).toBeHidden();
    await page.getByText("Do I need a cookie banner?").click();
    await expect(answer).toBeVisible();
  });

  test("in-page navigation reaches every section", async ({ page }) => {
    for (const id of ["features", "templates", "pricing", "faq", "start"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("loads nothing from third parties and sets no cookies", async ({ page, context }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).hostname;
      if (!["localhost", "127.0.0.1"].includes(host)) external.push(host);
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(external).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
});

test("phone menu opens as a popover and closes after choosing a section", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/en");
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.locator("#mk-menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Pricing" }).click();
  await expect(menu).toBeHidden();
  await context.close();
});

test("on phones the example pages fan out under the address field, the middle one in front", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/en");
  const pages = page.getByRole("list", { name: "Example pages" });
  await pages.evaluate((list) => Promise.all(list.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  expect(await page.locator("#hero-title").evaluate((h) => Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)))).toBe(2);
  const form = await page.getByRole("textbox", { name: "Choose your page address" }).first().boundingBox();
  const shown = [];
  for (const link of await pages.getByRole("link").all()) if (await link.isVisible()) shown.push(link);
  expect(shown).toHaveLength(3);
  const middle = await shown[1]?.boundingBox();
  expect(middle && form && middle.y > form.y).toBe(true);
  // The middle page is in front: its centre belongs to it, not to a page beside it.
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest("a")?.getAttribute("href"),
    [(middle?.x ?? 0) + (middle?.width ?? 0) / 2, (middle?.y ?? 0) + (middle?.height ?? 0) / 4],
  );
  expect(hit).toBe("/de/p/lou-ferreira");
  await context.close();
});

test("in Arabic the pages mirror: the page in front on the start side stands on the right", async ({ page }) => {
  await page.goto("/ar");
  const pages = page.getByRole("list", { name: "صفحات أمثلة" });
  await pages.evaluate((list) => Promise.all(list.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  const box = await pages.getByRole("link", { name: /Lou Ferreira/ }).boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box && box.x > width / 2).toBe(true);
});
