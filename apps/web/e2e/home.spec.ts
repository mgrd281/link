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
    const list = page.locator("#step-paste").getByRole("list").filter({ has: page.getByRole("button", { name: /^Remove / }) });
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

  test("the tour: four steps in the order people use Linkyo; the step bar follows the reader and jumps to a step", async ({ page }) => {
    const titles = page.locator("#features ol > li h3");
    await expect(titles).toHaveText(["A page that looks like you", "Paste a link. Done.", "Share like a pro", "Analytics without cookies"]);
    const rail = page.getByRole("navigation", { name: "The four steps" });
    await expect(rail.getByRole("link")).toHaveText([/1\s*Design/, /2\s*Add/, /3\s*Share/, /4\s*Measure/]);
    // A tap on a step brings it under the bar, and the bar marks it as the current one.
    await rail.getByRole("link", { name: /Share/ }).click();
    await expect(rail.getByRole("link", { name: /Share/ })).toHaveAttribute("aria-current", "step");
    await expect(rail.getByRole("link", { name: /Design/ })).not.toHaveAttribute("aria-current", "step");
    // The bars of the steps before it are full.
    await expect
      .poll(() => rail.locator("li").first().locator("[style]").evaluate((fill) => Number(getComputedStyle(fill).getPropertyValue("--p"))))
      .toBe(1);
  });

  test("step 1: a tap puts the small page in another look, arrow keys walk the looks, and any color works", async ({ page }) => {
    const step = page.locator("#step-look");
    const looks = step.getByRole("radiogroup", { name: "Choose a look" });
    await expect(looks.getByRole("radio")).toHaveCount(5);
    await expect(looks.getByRole("radio", { name: "Nocturne" })).toHaveAttribute("aria-checked", "true");
    const preview = step.locator("[data-look-preview]");
    const before = await preview.evaluate((element) => getComputedStyle(element).getPropertyValue("--creator-bg"));
    await looks.getByRole("radio", { name: "Daylight" }).click();
    await expect(looks.getByRole("radio", { name: "Daylight" })).toHaveAttribute("aria-checked", "true");
    await expect(step.locator("[aria-live]")).toContainText("Daylight");
    expect(await preview.evaluate((element) => getComputedStyle(element).getPropertyValue("--creator-bg"))).not.toBe(before);
    // A radio group: the arrow keys move the choice.
    await looks.getByRole("radio", { name: "Daylight" }).press("ArrowRight");
    await expect(looks.getByRole("radio", { name: "Pulse" })).toBeFocused();
    await expect(looks.getByRole("radio", { name: "Pulse" })).toHaveAttribute("aria-checked", "true");
    // Any color: the theme engine makes a whole, readable page of it.
    await step.getByLabel("Your color").fill("#ff7a00");
    await expect(step.locator("[aria-live]")).toContainText("Your color");
    await expect(looks.getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("step 2 shows itself once: two links become blocks by themselves, quietly", async ({ page }) => {
    const step = page.locator("#step-paste");
    // Jump there at once (no smooth scroll): under load a long smooth scroll plus the tour's own
    // three and a half seconds can outlast the wait.
    await step.locator(".mk-panel").evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    const blocks = step.getByRole("list").filter({ has: page.getByRole("button", { name: /^Remove / }) }).getByRole("listitem");
    await expect(blocks).toHaveCount(2, { timeout: 15_000 });
    await expect(blocks.first()).toContainText("Video");
    await expect(blocks.last()).toContainText("Music");
    // Only what a visitor adds is announced.
    await expect(step.getByRole("status")).toHaveText("");
  });

  test("step 2: taking over in the middle of the tour stops it and keeps what it showed", async ({ page }) => {
    const step = page.locator("#step-paste");
    await step.locator(".mk-panel").evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    const input = step.getByRole("textbox", { name: "Paste or type a link" });
    // The tour puts its first link in the field...
    await expect(input).toHaveValue(/open\.spotify\.com/, { timeout: 10_000 });
    // ...and a visitor arriving now finds it selected: the same link pasted again still counts.
    await input.fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    await expect(step.getByText("Recognised: Music")).toBeVisible();
    await input.press("Enter");
    const blocks = step.getByRole("list").filter({ has: page.getByRole("button", { name: /^Remove / }) }).getByRole("listitem");
    await expect(blocks).toHaveCount(1);
    // The tour has stopped: nothing more arrives by itself.
    await page.waitForTimeout(3500);
    await expect(blocks).toHaveCount(1);
    await expect(step.getByRole("status")).toHaveText("Music added to your page");
  });

  test("step 4: sample figures for everyone, counted up for the eye", async ({ page }) => {
    const figures = page.locator("#analytics dd .sr-only");
    await expect(figures).toHaveText(["12,480", "3,912", "31%"]);
    await expect(page.locator("#analytics")).toContainText("Sample data");
    await expect(page.locator("#analytics").getByRole("listitem").filter({ hasText: "No cookies, no fingerprinting" })).toBeVisible();
  });

  test("pricing, questions, the last word and the footer", async ({ page }) => {
    const pricing = page.locator("#pricing");
    await expect(pricing.getByRole("heading", { level: 3 })).toHaveText(["Free", /Pro/]);
    await expect(pricing.getByRole("link", { name: "Sign up for free" })).toHaveAttribute("href", "/en/signup");
    // Pro is not for sale yet: no button.
    await expect(pricing.locator("article").last().getByRole("link")).toHaveCount(0);
    await expect(page.locator("#start").getByRole("textbox", { name: "Choose your page address" })).toBeVisible();
    const footer = page.locator("footer");
    await expect(footer.getByRole("navigation", { name: "Product" }).getByRole("link")).toHaveText(["Features", "Templates", "Pricing", "FAQ"]);
    await expect(footer).toContainText("Imprint");
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

test("no page sets a cookie, also for a visitor whose browser speaks another language", async ({ browser }) => {
  // A German page read with an English browser used to get a language cookie.
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  for (const path of ["/de", "/de/templates", "/de/p/messi", "/ar/p/taylor-swift"]) {
    await page.goto(path);
    expect(await context.cookies(), path).toEqual([]);
  }
  // The start address still leads to the browser's language.
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  expect(await context.cookies()).toEqual([]);
  await context.close();
});

test("phone menu: a full screen with the places, the language, sign-up, and logging in as a quiet line", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/en");
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.locator("#mk-menu");
  await expect(menu).toBeVisible();
  // It covers the screen, like a screen in an app.
  const box = await menu.boundingBox();
  expect(box && [Math.round(box.width), Math.round(box.height)]).toEqual([390, 844]);
  // Every place says what is there.
  await expect(menu.getByRole("link", { name: /Templates/ })).toContainText("Browse them and start with one");
  // The language, written out; the current one is marked.
  await expect(menu.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "true");
  await expect(menu.getByRole("link", { name: "العربية" })).toHaveAttribute("href", "/ar");
  // One action; logging in is there for people who already have an account.
  await expect(menu.getByRole("link", { name: "Sign up for free" })).toHaveAttribute("href", "/en/signup");
  await expect(menu.getByText("Already have an account?")).toBeVisible();
  await expect(menu.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/en/login");
  // Choosing a place closes the menu.
  await menu.getByRole("link", { name: /Pricing/ }).click();
  await expect(menu).toBeHidden();
  // So does the close button, which gives the focus back to the menu button.
  await page.getByRole("button", { name: "Menu" }).click();
  await menu.getByRole("button", { name: "Close menu" }).click();
  await expect(menu).toBeHidden();
  await context.close();
});

test("on phones a visitor first learns what Linkyo is and sees pages, then meets sign-up", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 750 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/de");
  // What it is, in words: the thing, the promise, one sentence.
  await expect(page.getByText("Deine Seite für den Link in der Bio")).toBeVisible();
  const top = (selector: string) => page.locator(selector).evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  // Then real pages, then the action.
  const [words, pages, action] = [await top("#hero-title"), await top("[data-deck]"), await top("#hero-cta")];
  expect(words).toBeLessThan(pages);
  expect(pages).toBeLessThan(action);
  // The first screen shows the words and the pages, without asking for anything yet.
  const header = page.locator("[data-header-signup]");
  await expect(header).toBeHidden();
  expect(pages).toBeLessThan(750);
  // Sign-up in the hero; the header's own sign-up stays away while it is in view...
  await page.locator("#hero-cta").scrollIntoViewIfNeeded();
  await expect(page.locator("#hero-cta").getByRole("button", { name: "Kostenlos registrieren" })).toBeVisible();
  await expect(header).toBeHidden();
  // ...and slides into the header once it has been passed.
  await page.evaluate(() => window.scrollBy(0, 900));
  await expect(header).toBeVisible();
  await expect(header).toHaveAttribute("href", "/de/signup");
  // Back at the top, it leaves again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).toBeHidden();
  await context.close();
});

test("on phones the step bar sits flush under the header during the tour, and leaves with it", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/de");
  await page.locator("#step-paste").evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
  const rail = page.locator("[data-step-rail]");
  const header = page.locator("header").first();
  await expect.poll(async () => {
    const [bar, top] = [await rail.boundingBox(), await header.boundingBox()];
    return bar && top ? Math.round(bar.y) - Math.round(top.y + top.height) : null;
  }).toBe(0);
  await expect(rail.getByRole("link", { name: /Einfügen/ })).toHaveAttribute("aria-current", "step");
  // After the last step it goes with the tour.
  await page.locator("#pricing").evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
  await expect.poll(async () => {
    const bar = await rail.boundingBox();
    return bar ? bar.y + bar.height <= 64 : true;
  }).toBe(true);
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
