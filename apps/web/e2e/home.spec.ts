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

  test("try it: an App Store link becomes an app card, a GitHub skill a card with its install command", async ({ page }) => {
    const playground = page.locator("#try");
    await page.route("**/api/link-metadata?**", (route) => {
      const asked = new URL(route.request().url()).searchParams.get("url") ?? "";
      return route.fulfill({ json: asked.includes("apps.apple.com") ? { title: "Fokus Timer", author: "Kreisel Labs", rating: 4.8 } : { title: "brand-voice", stars: 2140, kind: "skill" } });
    });
    await playground.getByRole("tab", { name: /Links/ }).click();
    const input = playground.getByRole("textbox", { name: "Paste or type a link" });
    const preview = playground.locator("[data-try-preview]");
    await input.fill("https://apps.apple.com/de/app/fokus-timer/id1234567890");
    await expect(playground.getByText("Recognised: App")).toBeVisible();
    await input.press("Enter");
    await expect(preview).toContainText("Fokus Timer", { timeout: 15_000 });
    // The phone is a picture of the page (not in the tab order): its button leads to the App Store.
    await expect(preview.locator('a[href="https://apps.apple.com/de/app/fokus-timer/id1234567890"]').first()).toBeVisible();
    await input.fill("https://github.com/example-org/agent-skills/tree/main/skills/brand-voice");
    await expect(playground.getByText("Recognised: GitHub skill")).toBeVisible();
    await input.press("Enter");
    await expect(preview).toContainText("npx skills add example-org/agent-skills --skill brand-voice");
    // The list says what each one is: the app's maker, the skill's place on GitHub.
    const added = playground.getByRole("list", { name: "On your page" }).getByRole("listitem");
    await expect(added.filter({ hasText: "Fokus Timer" })).toContainText("Kreisel Labs");
    await expect(added.filter({ hasText: "brand-voice" })).toContainText("example-org/agent-skills/skills/brand-voice");
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
    await expect(preview).toContainText("Gala night: the look");
    // Each row says what the block shows: the release's real title (and its artist).
    await expect(added.first()).toContainText("Golden Hour");
    await playground.getByRole("button", { name: "Remove Golden Hour" }).click();
    await expect(added).toHaveCount(1);
    await expect(preview).not.toContainText("Golden Hour");
    // A profile becomes an icon under the name, not a block.
    await playground.getByRole("button", { name: "Instagram", exact: true }).click();
    await expect(playground.getByRole("status")).toHaveText("Instagram added to your page");
    await expect(preview.locator("header a[aria-label='Instagram']")).toHaveCount(1);
    // Six links are enough to try it.
    for (const example of ["Shop", "TikTok", "Shop", "YouTube"]) await playground.getByRole("button", { name: example, exact: true }).click();
    await expect(added).toHaveCount(6);
    await playground.getByRole("button", { name: "Shop", exact: true }).click();
    await expect(added).toHaveCount(6);
    await expect(playground.getByText("Six links are enough to try it.")).toBeVisible();
    await expect(playground.getByText("6 of 6")).toBeVisible();
    // A piece from the shop: its picture, title and price, in the phone and in its row.
    await expect(preview).toContainText("“Soleil” necklace · gold");
    await expect(added.filter({ hasText: "“Soleil” necklace · gold" }).first()).toContainText("€2,450");
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
    // concept pages: the chip shows the address with a "Concept" tag, and a note below says so too.
    const front = deck.getByRole("link", { name: /View page, Taylor Swift/ });
    await expect(front).toHaveAttribute("href", "/en/p/taylor-swift");
    await expect(front).toContainText("linkyo.app/taylor-swift");
    await expect(front).toContainText("Concept");
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
    await expect(deck.getByRole("link", { name: /View page, / })).toContainText("linkyo.app/elon-musk");
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

  test("try it shows once how a page is made: photo, name, line, Instagram, two pieces from the shop, a look, live", async ({ page }) => {
    const playground = page.locator("#try");
    await playground.evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    const preview = playground.locator("[data-try-preview]");
    // Nothing on the website moves while it plays: the card keeps its height and the page stays put.
    const card = playground.getByRole("tablist").locator("xpath=../..");
    await expect(preview).toBeVisible({ timeout: 15_000 });
    const scrolled = await page.evaluate(() => window.scrollY);
    const height = (await card.boundingBox())?.height;
    await expect(preview).toContainText("“Ambre” eau de parfum", { timeout: 20_000 });
    await expect(preview.getByRole("heading", { level: 1, includeHidden: true })).toHaveText("Lou Ferreira");
    await expect(preview).toContainText("Silk · Jewellery · Fragrance");
    await expect(preview).toContainText("linkyo.app/lou-ferreira");
    await expect(preview).toContainText("“Soleil” necklace · gold");
    await expect(preview.locator("header a[aria-label='Instagram']")).toHaveCount(1);
    // The portrait in the page's hero, and in the photo button (still "Add a photo": it is not the visitor's).
    await expect(preview.locator("header img").first()).toBeAttached();
    await expect(playground.locator("button[aria-label='Add a photo'] img")).toBeAttached();
    // Her own look: Nocturne, black and gold.
    await expect(playground.getByRole("radio", { name: "Nocturne" })).toHaveAttribute("aria-checked", "true", { timeout: 5_000 });
    await expect(playground.getByRole("tab", { name: "Look" })).toHaveAttribute("aria-selected", "true");
    // The phone says it is the visitor's turn (nothing is online yet); one quiet button plays it again.
    await expect(preview).toContainText("Done. Your turn!", { timeout: 8_000 });
    await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible({ timeout: 8_000 });
    await expect(playground.getByRole("button", { name: /Start empty|Clear/ })).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    expect((await card.boundingBox())?.height).toBe(height);
    // Only what a visitor does is announced.
    await expect(playground.getByRole("status")).toHaveText("");
  });

  test("try it: watch the demo on demand and stop it with a touch", async ({ page }) => {
    const playground = page.locator("#try");
    await playground.getByLabel("Your name").fill("Lea");
    await playground.getByRole("button", { name: "Watch", exact: true }).click();
    // It starts from an empty page; while it plays, the same button stops it (WCAG 2.2.2).
    await expect(playground.getByLabel("Your name")).toHaveValue("");
    await expect(playground.getByRole("button", { name: /^Watch/ })).toHaveCount(0);
    await expect(playground.getByRole("button", { name: "Stop demo" })).toBeVisible();
    await expect(playground.getByLabel("Your name")).toHaveValue("Lou Ferreira", { timeout: 8_000 });
    // A touch stops it where it is, and it can be watched again.
    await playground.getByRole("tab", { name: "Look" }).click();
    await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(playground.getByRole("tab", { name: "Look" })).toHaveAttribute("aria-selected", "true");
  });

  test("try it: the phone shows the real page, scaled from a real phone's width; it never takes the website's scroll and cannot be clicked", async ({ page }) => {
    const playground = page.locator("#try");
    const screen = playground.getByRole("region", { name: "Your page on a phone" });
    await playground.getByRole("tab", { name: /Links/ }).click();
    for (const example of ["YouTube", "Shop", "YouTube"]) await playground.getByRole("button", { name: example, exact: true }).click();
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
    // The wheel over the phone scrolls the website, as anywhere else on it, and leaves the phone's page alone.
    await screen.scrollIntoViewIfNeeded();
    const frame = await screen.boundingBox();
    if (!frame) throw new Error("The phone has no box");
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.mouse.wheel(0, 240);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    expect(await screen.evaluate((element) => element.scrollTop)).toBe(0);
    // A mouse can drag the page in the phone, as a finger would on a phone.
    const moved = await screen.boundingBox();
    if (!moved) throw new Error("The phone has no box");
    const x = moved.x + moved.width / 2;
    const y = moved.y + moved.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 120, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
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
    await expect(looks.getByRole("radio", { name: "Mono" })).toHaveAttribute("aria-checked", "true");
    await looks.getByRole("radio", { name: "Aura" }).click();
    await expect(looks.getByRole("radio", { name: "Aura" })).toHaveAttribute("aria-checked", "true");
    expect(await preview.evaluate((element) => getComputedStyle(element).getPropertyValue("--creator-bg"))).not.toBe(before);
    await looks.getByRole("radio", { name: "Aura" }).press("ArrowRight");
    await expect(looks.getByRole("radio", { name: "Bloom" })).toBeFocused();
    // Any color: the theme engine makes a whole, readable page of it.
    await playground.getByLabel("Your color").fill("#ff7a00");
    await expect(playground.getByRole("tabpanel", { name: "Look" }).locator("p", { hasText: "Your color" })).toContainText("Your color");
    // Your color goes onto the look that was showing (Bloom, picked with the arrow key), not onto another.
    await expect(playground.getByRole("link", { name: "Keep this page" })).toHaveAttribute("href", /template=bloom&accent=ff7a00$/);
    await expect(looks.getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("try it: taking over mid-demo stops it and keeps what it typed, selected", async ({ page }) => {
    const playground = page.locator("#try");
    await playground.evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    const name = playground.getByLabel("Your name");
    // The demo types the name about five seconds in; a busy test machine can take longer.
    await expect(name).toHaveValue("Lou Ferreira", { timeout: 15_000 });
    await name.click();
    await page.keyboard.type("Mila Aurel");
    await expect(name).toHaveValue("Mila Aurel");
    // The demo has stopped: no links arrive by themselves.
    await page.waitForTimeout(4000);
    await expect(playground.locator("[data-try-preview]")).not.toContainText("Soleil");
    await expect(playground.getByRole("tab", { name: "Links" })).toHaveAttribute("aria-selected", "false");
    await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible();
  });

  test("sharing shows the real thing: the page's own link preview in a chat, and its story picture", async ({ page }) => {
    const tile = page.locator("article").filter({ has: page.getByRole("heading", { level: 3, name: "Share like a pro" }) });
    await tile.scrollIntoViewIfNeeded();
    // The very card a messenger fetches for the example page, in the visitor's language.
    const card = tile.locator("img");
    await expect(card).toHaveCount(1);
    // Through the image optimizer (locally a small modern format; Vercel passes generated images through), still our own card.
    await expect(card).toHaveAttribute("src", /(\/|%2F)en(\/|%2F)p(\/|%2F)journalist(\/|%2F)opengraph-image/);
    await expect.poll(() => card.evaluate((image: HTMLImageElement) => image.naturalWidth), { timeout: 15_000 }).toBeGreaterThan(0);
    // Under it, the words the messengers print: the page's name first.
    await expect(tile).toContainText("Lea Hartmann · Example page for Journalist");
    // The story picture, drawn by the dashboard's own code once it comes near the screen.
    const story = tile.locator("canvas");
    await expect(story).toHaveCount(1);
    await expect(story).toHaveAttribute("data-drawn", "", { timeout: 15_000 });
  });

  test("step 4: sample figures for everyone, counted up for the eye", async ({ page }) => {
    const figures = page.locator("#analytics dd .sr-only");
    await expect(figures).toHaveText(["12,480", "3,912", "31%"]);
    await expect(page.locator("#analytics")).toContainText("Sample data");
    await expect(page.locator("#analytics").getByRole("listitem").filter({ hasText: "No cookies, no fingerprinting" })).toBeVisible();
  });

  /**
   * The sample tile's three figures sit side by side in a card that is only about 290 px wide at
   * laptop width. "Click rate" was cut to "Click ra…" (the label was truncated), and "12,480" stuck out of
   * its cell. Every label and figure must lie whole inside its own cell, in every language and width, and
   * the cells must not overlap.
   */
  test("step 4: no label or figure of the sample tile is cut or sticks out of its cell", async ({ page }) => {
    test.setTimeout(150_000);
    // No count-up and no entrance animation: the figures are measured as they rest.
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [360, 740],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "de", "ar"] as const) {
        await page.goto(`/${locale}`);
        await page.locator("#analytics").scrollIntoViewIfNeeded();
        const cells = await page.evaluate(() =>
          [...document.querySelectorAll("#analytics dl > div")].map((cell) => {
            const box = cell.getBoundingClientRect();
            const inside = (element: Element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              const text = range.getBoundingClientRect();
              return text.left >= box.left - 0.5 && text.right <= box.right + 0.5;
            };
            const label = cell.querySelector("dt");
            const figure = cell.querySelector("dd [aria-hidden]");
            return {
              label: label?.textContent ?? "",
              cut: label ? label.scrollWidth > label.clientWidth : true,
              labelInside: label ? inside(label) : false,
              figureInside: figure ? inside(figure) : false,
              box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
            };
          }),
        );
        const where = `${locale} at ${String(width)} px`;
        expect(cells.length, where).toBe(3);
        for (const cell of cells) {
          expect.soft(cell.cut, `${where}: the label "${cell.label}" is cut`).toBe(false);
          expect.soft(cell.labelInside, `${where}: the label "${cell.label}" sticks out of its cell`).toBe(true);
          expect.soft(cell.figureInside, `${where}: the figure under "${cell.label}" sticks out of its cell`).toBe(true);
        }
        for (const [index, a] of cells.entries()) {
          for (const b of cells.slice(index + 1)) {
            const apart = a.box.right <= b.box.left + 0.5 || b.box.right <= a.box.left + 0.5 || a.box.bottom <= b.box.top + 0.5 || b.box.bottom <= a.box.top + 0.5;
            expect.soft(apart, `${where}: the cells "${a.label}" and "${b.label}" overlap`).toBe(true);
          }
        }
      }
    }
  });

  test("pricing, questions, the last word and the footer", async ({ page }) => {
    const pricing = page.locator("#pricing");
    await expect(pricing.locator("[data-plan]").getByRole("heading", { level: 3 })).toHaveText(["Free", "Pro", "Page service"]);
    // The Free plan lists what exists today: the app that is still being built is no included feature.
    const free = pricing.locator('[data-plan="free"]');
    await expect(free.getByRole("listitem")).toHaveCount(5);
    await expect(free).not.toContainText(/iOS|coming|soon|in the works/i);
    await expect(pricing.getByRole("link", { name: "Sign up for free" })).toHaveAttribute("href", "/en/signup");
    // Pro and the page service are not for sale yet: no button.
    await expect(pricing.locator('[data-plan="pro"]').getByRole("link")).toHaveCount(0);
    await expect(pricing.locator('[data-plan="service"]').getByRole("link")).toHaveCount(0);
    await expect(page.locator("#start").getByRole("textbox", { name: "Choose your page address" })).toBeVisible();
    // The site's footer (the page in the playground's phone has its own).
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("navigation", { name: "Product" }).getByRole("link")).toHaveText(["Features", "Templates", "Portfolio", "Pricing", "Changelog"]);
    await expect(footer.getByRole("navigation", { name: "Product" }).getByRole("link", { name: "Portfolio" })).toHaveAttribute("href", "/en/portfolio");
    await expect(footer.getByRole("navigation", { name: "Product" }).getByRole("link", { name: "Features" })).toHaveAttribute("href", "/en/funktionen");
    // Help and contact lead to the real product only: the help pages, the questions, the editor to try, the contact.
    const resources = footer.getByRole("navigation", { name: "Help & contact" }).getByRole("link");
    await expect(resources).toHaveText(["Help", "FAQ", "Try the editor", "Contact"]);
    await expect(resources.first()).toHaveAttribute("href", "/en/hilfe");
    await expect(resources.nth(2)).toHaveAttribute("href", "/en#try");
    await expect(footer.getByRole("navigation", { name: "About Linkyo" }).getByRole("link")).toHaveText(["About", "Security & privacy"]);
    // The design system and the prototypes stay reachable by address, but nothing here leads there.
    await expect(footer.locator('a[href*="/directions"], a[href$="/design"]')).toHaveCount(0);
    await expect(footer).not.toContainText(/prototype/i);
    await expect(footer).toContainText("Imprint");
  });

  test("the promise breaks only before its last word beside the pages, and the sentence under it takes two lines at most", async ({ page }) => {
    const lines = (selector: string) =>
      page.locator(selector).evaluate((element) => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
    // At 72 px beside the pages (W-11) the second line may take two, broken before "create." only.
    expect(await lines("#hero-title")).toBeLessThanOrEqual(3);
    await expect(page.locator("#hero-title .whitespace-nowrap")).toHaveText("Everything you");
    expect(await lines("#hero-title .whitespace-nowrap")).toBe(1);
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
  // Every place says what is there; Portfolio sits between the templates and the prices.
  await expect(menu.getByRole("link", { name: /Templates/ })).toContainText("Browse them and start with one");
  await expect(menu.getByRole("navigation", { name: "Menu" }).getByRole("link")).toHaveText([/^Features/, /^Templates/, /^Portfolio/, /^Pricing/, /^Help/]);
  await expect(menu.getByRole("link", { name: /^Help/ })).toHaveAttribute("href", "/en/hilfe");
  await expect(menu.getByRole("link", { name: /Portfolio/ })).toHaveAttribute("href", "/en/portfolio");
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

test("the header names Portfolio between the templates and the prices, in every language", async ({ page }) => {
  const names = {
    de: ["Funktionen", "Vorlagen", "Portfolio", "Preise", "Hilfe"],
    en: ["Features", "Templates", "Portfolio", "Pricing", "Help"],
    ar: ["المزايا", "القوالب", "معرض الأعمال", "الأسعار", "المساعدة"],
  } as const;
  for (const locale of ["de", "en", "ar"] as const) {
    await page.goto(`/${locale}/templates`);
    const nav = page.getByRole("banner").getByRole("navigation").first();
    await expect(nav.getByRole("link")).toHaveText([...names[locale]]);
    await expect(nav.getByRole("link", { name: names[locale][2] })).toHaveAttribute("href", `/${locale}/portfolio`);
    // The page you are on is marked.
    await expect(nav.getByRole("link", { name: names[locale][1] })).toHaveAttribute("aria-current", "page");
  }
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
  // The page first, then the controls and the button (the phone loads as it comes near).
  await expect(playground.locator("[data-try-preview]")).toBeVisible({ timeout: 15_000 });
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
  await playground.getByRole("button", { name: "YouTube", exact: true }).click();
  await playground.getByRole("tab", { name: "Look" }).click();
  await playground.getByRole("radio", { name: "Studio" }).click();
  await playground.getByRole("link", { name: "Keep this page" }).click();
  await page.waitForURL(new RegExp(`/en/signup\\?name=lea-${id}&display=Lea\\+${id}&template=studio$`));
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
