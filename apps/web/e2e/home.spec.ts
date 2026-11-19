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

  test("nine pages take turns, three in view; the one in front scrolls by itself; a face brings any page forward", async ({ page }) => {
    const deck = page.getByRole("region", { name: "Example pages" });
    const tabs = deck.getByRole("tab");
    // Nine pages, one face each (the face is the tab, the name its label).
    await expect(tabs).toHaveCount(9);
    await expect(deck.getByRole("tab", { name: "Taylor Swift" })).toHaveAttribute("aria-selected", "true");
    // No pause button: choosing a page stops the deck, it ends by itself after one round, and it
    // holds under the mouse or keyboard focus (WCAG 2.2.2).
    await expect(deck.getByRole("button", { name: /Pause|Play/ })).toHaveCount(0);

    // Three pages are in view; the other six wait out of sight.
    await expect(deck.locator('[data-slot="front"], [data-slot="next"], [data-slot="prev"]')).toHaveCount(3);
    const waiting = deck.locator('[data-slot="after"], [data-slot="before"]');
    await expect(waiting).toHaveCount(6);
    await expect(waiting.first()).toHaveCSS("opacity", "0");
    await expect(waiting.first()).toBeHidden();
    // Their pictures are fetched ahead, once the first is there: a chosen page shows at once.
    await expect(deck.locator('[role="tabpanel"] img')).toHaveCount(9);

    // The chip above the page in front is the link to it. Pages of well-known people are unofficial
    // concept pages: the chip says so instead of showing an address, and so does a note below.
    const front = deck.getByRole("link", { name: /View page, Taylor Swift/ });
    await expect(front).toHaveAttribute("href", "/en/p/taylor-swift");
    await expect(front).toContainText("Concept · Taylor Swift");
    await expect(deck.getByText("Concept pages are unofficial")).toBeVisible();

    // No moving line anywhere. The page in front is alive instead: its picture is taller than its
    // screen and scrolls down by itself. When it is back at the top, the next page comes to the front.
    await page.mouse.move(0, 0);
    const tour = deck.locator("[data-tour]");
    await expect(tour).toHaveCSS("animation-name", "mk-deck-scroll");
    // The ring around the face of the page in front is the deck's timer: it fills on the same clock.
    const ring = deck.locator("[data-ring]");
    await expect(ring).toHaveCount(1);
    await expect(deck.getByRole("tab", { name: "Taylor Swift" }).locator("[data-ring][data-running]")).toHaveCSS("animation-name", "mk-deck-ring");
    const taller = await tour.evaluate((picture) => picture.getBoundingClientRect().height / (picture.parentElement?.getBoundingClientRect().height ?? 1));
    expect(taller).toBeGreaterThan(1.5);
    await tour.evaluate((picture) => {
      for (const animation of picture.getAnimations()) animation.finish();
    });
    await expect(deck.getByRole("tab", { name: "Cristiano Ronaldo" })).toHaveAttribute("aria-selected", "true");
    await expect(deck.getByRole("link", { name: /View page, Cristiano Ronaldo/ })).toBeVisible();

    // Choosing a face stops the deck for good: nothing scrolls or changes on its own any more.
    await deck.getByRole("tab", { name: "Elon Musk" }).click();
    await expect(deck.getByRole("link", { name: /View page, / })).toHaveAttribute("href", "/en/p/elon-musk");
    await expect(deck.getByRole("link", { name: /View page, / })).toContainText("Concept · Elon Musk");
    await expect
      .poll(() => deck.locator('[data-slot="front"] img').evaluate((picture: HTMLImageElement) => picture.complete && picture.naturalWidth > 0))
      .toBe(true);
    await expect(tour).toHaveCount(0);
    // The timer has stopped too: the chosen face simply has a full ring.
    await expect(deck.getByRole("tab", { name: "Elon Musk" }).locator("[data-ring]")).toHaveCount(1);
    await expect(deck.locator("[data-ring][data-running]")).toHaveCount(0);
    // Arrow keys walk through the faces and wrap around at the ends.
    await deck.getByRole("tab", { name: "Elon Musk" }).press("End");
    await expect(tabs.nth(8)).toBeFocused();
    await tabs.nth(8).press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

    // A click on a page beside the front brings it forward.
    await deck.locator('[data-slot="next"] button').click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");

    const example = page.getByRole("link", { name: /^See .+'s example page$/ }).first();
    await expect(example).toHaveAttribute("href", /^\/(de|en|ar)\/p\/[a-z0-9-]+$/);
    // The four feature panels are there, with the paste demo inside one of them.
    await expect(page.getByRole("heading", { level: 3, name: "A page that looks like you" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Share like a pro" })).toBeAttached();
  });

  test("the promise sits on two lines and the sentence under it on two at most", async ({ page }) => {
    const lines = (selector: string) =>
      page.locator(selector).evaluate((element) => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
    expect(await lines("#hero-title")).toBe(2);
    expect(await lines("#hero-title + p")).toBeLessThanOrEqual(2);
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

test("on phones too the promise sits on two lines", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/de");
  const lines = await page
    .locator("#hero-title")
    .evaluate((element) => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
  expect(lines).toBe(2);
  await context.close();
});

test("the hero pages follow the reading direction in Arabic", async ({ page }) => {
  await page.goto("/ar");
  const deck = page.getByRole("region", { name: "صفحات أمثلة" });
  const tabs = deck.getByRole("tab");
  // Choosing a page stops the deck, so nothing below depends on timing.
  await tabs.nth(0).click();
  // The next page waits on the left (the reading side), and ArrowLeft moves forward.
  const front = await deck.locator('[data-slot="front"]').boundingBox();
  const next = await deck.locator('[data-slot="next"]').boundingBox();
  expect(next && front && next.x < front.x).toBe(true);
  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
});
