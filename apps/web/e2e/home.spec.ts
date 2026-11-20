import { expect, test } from "@playwright/test";

import { enterDemoCode } from "./auth";

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

  test("try it: a pasted link becomes the real block with its real title; examples are samples", async ({ page }) => {
    const playground = page.locator("#try");
    // What our server finds for a pasted song (stubbed here: the test must not depend on Spotify).
    await page.route("**/api/link-metadata?**", (route) => route.fulfill({ json: { title: "Golden Hour", author: "Sample Artist - Topic" } }));
    // Taking over first stops the self-demo, so only what this test does counts.
    await playground.getByRole("tab", { name: /Links/ }).click();
    const input = playground.getByRole("textbox", { name: "Paste or type a link" });
    await input.fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    await expect(playground.getByText("Recognised: Music")).toBeVisible();
    await input.press("Enter");
    const added = playground.getByRole("list", { name: "On your page" }).getByRole("listitem");
    const preview = playground.locator("[data-try-preview]");
    await expect(added).toHaveCount(1);
    // The real page shows the release under its real title and artist (the phone loads on its own).
    await expect(preview).toContainText("Golden Hour", { timeout: 15_000 });
    await expect(preview).toContainText("Sample Artist");
    await expect(playground.getByRole("status")).toHaveText("Music added to your page");
    // An example: a sample with Linkyo's own picture and title.
    await playground.getByRole("button", { name: "YouTube", exact: true }).click();
    await expect(added).toHaveCount(2);
    await expect(preview).toContainText("Rooftop set · Afterglow live");
    await playground.getByRole("button", { name: "Remove Music" }).click();
    await expect(added).toHaveCount(1);
    await expect(preview).not.toContainText("Golden Hour");
    // A profile becomes an icon under the name, not a block.
    await playground.getByRole("button", { name: "Instagram", exact: true }).click();
    await expect(playground.getByRole("status")).toHaveText("Instagram added to your page");
    await expect(preview.locator("header a[aria-label='Instagram']")).toHaveCount(1);
    // Six links are enough to try it.
    for (const example of ["Spotify", "Twitch", "Shop", "YouTube"]) await playground.getByRole("button", { name: example, exact: true }).click();
    await expect(added).toHaveCount(6);
    await playground.getByRole("button", { name: "Spotify", exact: true }).click();
    await expect(added).toHaveCount(6);
    await expect(playground.getByText("Six links are enough to try it.")).toBeVisible();
    await expect(preview).toContainText("Afterglow · vinyl");
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
    // Further down: the playground, then the feature tiles.
    await expect(page.getByRole("heading", { level: 2, name: "Try it. Your page, live." })).toBeAttached();
    await expect(page.getByRole("heading", { level: 3, name: "Share like a pro" })).toBeAttached();
  });

  test("try it shows once how a page is made, step by step: photo, name, line, Instagram, a single, a live set, a look, live", async ({ page }) => {
    const playground = page.locator("#try");
    await playground.evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    const preview = playground.locator("[data-try-preview]");
    await expect(preview).toContainText("Rooftop set · Afterglow live", { timeout: 20_000 });
    await expect(preview.getByRole("heading", { level: 1, includeHidden: true })).toHaveText("Juno Kade");
    await expect(preview).toContainText("DJ · Producer · House & Disco");
    await expect(preview).toContainText("linkyo.app/juno-kade");
    await expect(preview).toContainText("Afterglow");
    await expect(preview.locator("header a[aria-label='Instagram']")).toHaveCount(1);
    // The portrait in the page's hero, and in the photo button (still "Add a photo": it is not the visitor's).
    await expect(preview.locator("header img").first()).toBeAttached();
    await expect(playground.locator("button[aria-label='Add a photo'] img")).toBeAttached();
    await expect(playground.getByRole("radio", { name: "Nocturne" })).toHaveAttribute("aria-checked", "true", { timeout: 5_000 });
    await expect(playground.getByRole("tab", { name: "Look" })).toHaveAttribute("aria-selected", "true");
    // The phone says the page is live, then it is the visitor's turn.
    await expect(preview).toContainText("Your page is live", { timeout: 8_000 });
    await expect(playground.locator("[data-demo-caption]")).toHaveText("Your turn – just start", { timeout: 8_000 });
    await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible();
    // Only what a visitor does is announced.
    await expect(playground.getByRole("status")).toHaveText("");
  });

  test("try it: watch the demo on demand, stop it with a touch, then start from an empty page", async ({ page }) => {
    const playground = page.locator("#try");
    await expect(playground.locator("[data-demo-caption]")).toHaveText("How a page is made");
    await playground.getByLabel("Your name").fill("Lea");
    await playground.getByRole("button", { name: "Watch", exact: true }).click();
    // It starts from an empty page and shows each step by name.
    await expect(playground.getByLabel("Your name")).toHaveValue("");
    await expect(playground.locator("[data-demo-caption]")).toHaveText("Add a photo");
    await expect(playground.locator("[data-demo-caption]")).toHaveText("Your name and a line", { timeout: 5_000 });
    await expect(playground.getByLabel("Your name")).toHaveValue("Juno Kade", { timeout: 5_000 });
    // A touch stops it where it is.
    await playground.getByRole("tab", { name: "Look" }).click();
    await expect(playground.locator("[data-demo-caption]")).toHaveText("Your turn – just start");
    await page.waitForTimeout(1500);
    await expect(playground.getByRole("tab", { name: "Look" })).toHaveAttribute("aria-selected", "true");
    // Start empty: no photo, no name, no links, the first look.
    await playground.getByRole("button", { name: "Start empty" }).click();
    await expect(playground.getByRole("status")).toHaveText("Empty page. Start with your photo and name.");
    await expect(playground.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    await expect(playground.getByLabel("Your name")).toHaveValue("");
    await expect(playground.locator("[data-try-preview] img")).toHaveCount(0);
    // (The looks sit behind the Look tab, so they are found directly.)
    await expect(playground.locator("[role=radio][aria-label=Daylight]")).toHaveAttribute("aria-checked", "true");
  });

  test("try it: the phone shows the real page, scaled from a real phone's width, scrollable but not clickable", async ({ page }) => {
    const playground = page.locator("#try");
    const screen = playground.getByRole("region", { name: "Your page on a phone" });
    await playground.getByRole("tab", { name: /Links/ }).click();
    for (const example of ["Spotify", "YouTube", "Shop"]) await playground.getByRole("button", { name: example, exact: true }).click();
    // Laid out 390 px wide, like a phone, and scaled down into the frame.
    const width = await screen.evaluate((element) => (element as HTMLElement).offsetWidth);
    expect(width).toBe(390);
    const box = await screen.boundingBox();
    expect(box && box.width < 390).toBe(true);
    // It scrolled to the newest block by itself, and can be scrolled back with the keyboard.
    await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await screen.focus();
    await page.keyboard.press("Home");
    await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBe(0);
    // Its links are there to see, not to follow.
    await expect(screen.locator("[inert] a").first()).toBeAttached();
    expect(await screen.locator("a").evaluateAll((links) => links.every((link) => link.closest("[inert]") !== null))).toBe(true);
  });

  test("try it: a photo goes onto the page at once, and can be taken off again", async ({ page }) => {
    const playground = page.locator("#try");
    await playground.getByRole("tab", { name: "Profile" }).click();
    const preview = playground.locator("[data-try-preview]");
    await expect(preview.locator("img")).toHaveCount(0);
    const chooser = page.waitForEvent("filechooser");
    await playground.getByRole("button", { name: "Add a photo" }).click();
    await (await chooser).setFiles("src/assets/samples/mila-avatar.jpg");
    // Resized in the browser: the page shows it as a data picture, nothing was uploaded.
    await expect(preview.locator("img[src^='data:image/']").first()).toBeAttached();
    await expect(playground.getByRole("button", { name: "Change photo" })).toBeVisible();
    await playground.getByRole("button", { name: "Remove photo" }).click();
    await expect(preview.locator("img")).toHaveCount(0);
    await expect(playground.getByRole("button", { name: "Add a photo" })).toBeVisible();
  });

  test("try it: a name gives the page its title and address; looks and any color dress it; tabs work with arrow keys", async ({ page }) => {
    const playground = page.locator("#try");
    const tabs = playground.getByRole("tablist", { name: "Edit your page" });
    await tabs.getByRole("tab", { name: "Profile" }).click();
    await playground.getByLabel("Your name").fill("Lea Hartmann");
    const preview = playground.locator("[data-try-preview]");
    await expect(preview.getByRole("heading", { level: 1, includeHidden: true })).toHaveText("Lea Hartmann");
    await expect(preview).toContainText("linkyo.app/lea-hartmann");
    await expect(playground.getByText("Your address: linkyo.app/lea-hartmann")).toBeVisible();
    // Tabs: arrow keys move between them.
    await tabs.getByRole("tab", { name: "Profile" }).press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: /Links/ })).toBeFocused();
    await tabs.getByRole("tab", { name: /Links/ }).press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Look" })).toHaveAttribute("aria-selected", "true");
    // Looks: the page changes at once; a radio group with arrow keys.
    const looks = playground.getByRole("radiogroup", { name: "Choose a look" });
    const before = await preview.evaluate((element) => getComputedStyle(element).getPropertyValue("--creator-bg"));
    await expect(looks.getByRole("radio", { name: "Daylight" })).toHaveAttribute("aria-checked", "true");
    await looks.getByRole("radio", { name: "Pulse" }).click();
    await expect(looks.getByRole("radio", { name: "Pulse" })).toHaveAttribute("aria-checked", "true");
    expect(await preview.evaluate((element) => getComputedStyle(element).getPropertyValue("--creator-bg"))).not.toBe(before);
    await looks.getByRole("radio", { name: "Pulse" }).press("ArrowRight");
    await expect(looks.getByRole("radio", { name: "Atelier" })).toBeFocused();
    // Any color: the theme engine makes a whole, readable page of it.
    await playground.getByLabel("Your color").fill("#ff7a00");
    await expect(playground.locator("[aria-live]")).toContainText("Your color");
    // Your color goes onto the look that was showing (Atelier, picked with the arrow key), not onto another.
    await expect(playground.getByRole("link", { name: "Keep this page" })).toHaveAttribute("href", /template=atelier&accent=ff7a00$/);
    await expect(looks.getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("try it: taking over mid-demo stops it and keeps what it typed, selected", async ({ page }) => {
    const playground = page.locator("#try");
    await playground.evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    const name = playground.getByLabel("Your name");
    // The demo types the name about five seconds in; a busy test machine can take longer.
    await expect(name).toHaveValue("Juno Kade", { timeout: 15_000 });
    await name.click();
    await page.keyboard.type("Mila Aurel");
    await expect(name).toHaveValue("Mila Aurel");
    // The demo has stopped: no links arrive by themselves.
    await page.waitForTimeout(4000);
    await expect(playground.locator("[data-try-preview]")).not.toContainText("Afterglow");
    await expect(playground.getByRole("tab", { name: "Links" })).toHaveAttribute("aria-selected", "false");
    await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible();
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
    // The site's footer (the page in the playground's phone has its own).
    const footer = page.getByRole("contentinfo");
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

test("on phones the page sits above its controls; keeping it carries the visitor's own name, photo, look and links into the welcome flow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.route("**/api/link-metadata?**", (route) => route.fulfill({ json: {} }));
  await page.goto("/en");
  const playground = page.locator("#try");
  await playground.getByRole("tab", { name: "Profile" }).click();
  // The page first, then the controls and the button.
  const preview = await playground.locator("[data-try-preview]").boundingBox();
  const tablist = await playground.getByRole("tablist").boundingBox();
  expect(preview && tablist && preview.y < tablist.y).toBe(true);
  const id = Date.now().toString(36);
  await playground.getByLabel("Your name").fill(`Lea ${id}`);
  await playground.getByLabel("One line about you").fill("Singer · Manchester");
  const chooser = page.waitForEvent("filechooser");
  await playground.getByRole("button", { name: "Add a photo" }).click();
  await (await chooser).setFiles("src/assets/samples/mila-avatar.jpg");
  await expect(playground.getByRole("button", { name: "Change photo" })).toBeVisible();
  await playground.getByRole("tab", { name: /Links/ }).click();
  await playground.getByRole("textbox", { name: "Paste or type a link" }).fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
  await playground.getByRole("button", { name: "Add", exact: true }).click();
  // An example stays an example: it is not carried into the real page.
  await playground.getByRole("button", { name: "Twitch", exact: true }).click();
  await playground.getByRole("tab", { name: "Look" }).click();
  await playground.getByRole("radio", { name: "Daylight" }).click();
  await playground.getByRole("link", { name: "Keep this page" }).click();
  await page.waitForURL(new RegExp(`/en/signup\\?name=lea-${id}&display=Lea\\+${id}&template=daylight&accent=[0-9a-f]{6}$`));
  await page.locator("#signup-email").fill(`try-${id}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL("**/en/app/welcome");
  // The welcome flow continues from the playground: the name and photo are there, the links wait in their step.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(`Lea ${id}`);
  await expect(page.getByLabel("Your address")).toHaveValue(`lea-${id}`);
  await expect(page.locator("img[src^='data:image/']").first()).toBeAttached();
  // The line under the name and the whole look came along too.
  await expect(page.getByText("Singer · Manchester").first()).toBeAttached();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("textarea")).toHaveValue("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
  // Used once: the draft is gone from the tab.
  expect(await page.evaluate(() => sessionStorage.getItem("linkyo.try"))).toBeNull();
  await context.close();
});

test("search engines may index the public pages, in three languages; sign-in and internal pages stay out", async ({ page, request }) => {
  await page.goto("/de");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/de$/);
  for (const code of ["de", "en", "ar", "x-default"]) await expect(page.locator(`link[rel="alternate"][hreflang="${code}"]`)).toHaveCount(1);
  for (const path of ["/en/login", "/en/design", "/en/directions"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/de", "/en/templates", "/ar/signup"]) expect(sitemap).toContain(`${path}</loc>`);
  // Example and concept pages are not in it.
  expect(sitemap).not.toContain("/p/");
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
