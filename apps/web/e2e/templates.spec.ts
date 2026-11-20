import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { enterDemoCode } from "./auth";

/** The template gallery (/templates) and its example pages. */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("template gallery", () => {
  test("shows about forty examples, filters by category and is accessible", async ({ page }) => {
    await page.goto("/en/templates");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("70+ examples");
    const cards = page.getByRole("button", { name: /^Preview: / });
    // The grid shows the first twelve; the line under it counts them all.
    const total = Number((await page.getByText(/^12 of \d+ examples$/).textContent())?.match(/of (\d+)/)?.[1]);
    expect(total).toBeGreaterThanOrEqual(40);
    await page.getByRole("button", { name: /^Local businesses/ }).click();
    await expect(page.getByRole("button", { name: /^Local businesses/ })).toHaveAttribute("aria-pressed", "true");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeLessThan(20);
    await expect(page.getByRole("button", { name: "Preview: Bäckerei Sonnenkorn" }).last()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("search, language and category narrow the grid; nothing found offers a reset", async ({ page }) => {
    await page.goto("/en/templates");
    const cards = page.getByRole("button", { name: /^Preview: / });
    const all = await cards.count();
    const search = page.getByRole("searchbox", { name: "Search examples" });
    await search.fill("backerei");
    await expect(page.getByRole("button", { name: "Preview: Bäckerei Sonnenkorn" })).toBeVisible();
    expect(await cards.count()).toBeLessThan(5);
    await search.fill("");
    await expect(cards).toHaveCount(all);

    await page.getByRole("radiogroup", { name: "Page language" }).getByRole("radio", { name: "Arabic" }).click();
    await expect(page.getByRole("button", { name: "Preview: آدم نور" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview: Bäckerei Sonnenkorn" })).toHaveCount(0);
    // The category chips count what the other filters leave.
    await expect(page.getByRole("button", { name: /^Local businesses/ })).toContainText(/\d/);

    await search.fill("zzzz nothing");
    await expect(page.getByText("Nothing found")).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(cards).toHaveCount(all);
    await expect(search).toHaveValue("");
  });

  test("the grid shows twelve, then twelve more on demand; focus moves to the first new card; a filter starts over", async ({ page }) => {
    await page.goto("/en/templates");
    const grid = page.locator("#gallery ul").first();
    const cards = grid.getByRole("button", { name: /^Preview: / });
    await expect(cards).toHaveCount(12);
    const progress = page.getByText(/^12 of \d+ examples$/);
    await expect(progress).toBeVisible();
    const total = Number((await progress.textContent())?.match(/of (\d+)/)?.[1]);
    expect(total).toBeGreaterThan(24);
    await page.getByRole("button", { name: "Show 12 more" }).click();
    await expect(cards).toHaveCount(24);
    await expect(page.getByText(`24 of ${total} examples`)).toBeVisible();
    // Keyboards carry on at the first new card.
    await expect(cards.nth(12)).toBeFocused();
    // A filter starts over at twelve (or fewer).
    await page.getByRole("radiogroup", { name: "Page language" }).getByRole("radio", { name: "German" }).click();
    expect(await cards.count()).toBeLessThanOrEqual(12);
    // To the end: no button once everything is shown.
    await page.getByRole("radiogroup", { name: "Page language" }).getByRole("radio", { name: "All" }).click();
    for (let shown = 12; shown < total; shown += 12) await page.getByRole("button", { name: /^Show \d+ more$/ }).click();
    await expect(cards).toHaveCount(total);
    await expect(page.getByRole("button", { name: /^Show \d+ more$/ })).toHaveCount(0);
  });

  test("the preview flips through the examples and closes with Escape", async ({ page }) => {
    await page.goto("/en/templates");
    await page.getByRole("button", { name: /^Local businesses/ }).click();
    await page.getByRole("button", { name: "Preview: Bäckerei Sonnenkorn" }).click();
    const dialog = page.getByRole("dialog");
    const frame = dialog.locator("iframe");
    await expect(frame).toHaveAttribute("src", "/de/p/baeckerei-sonnenkorn");
    // Focus is on the dialog (not inside the page frame), so the keys work right away.
    await page.keyboard.press("ArrowRight");
    await expect(frame).not.toHaveAttribute("src", "/de/p/baeckerei-sonnenkorn");
    await page.keyboard.press("ArrowLeft");
    await expect(frame).toHaveAttribute("src", "/de/p/baeckerei-sonnenkorn");
    await dialog.getByRole("button", { name: "Next example" }).first().click();
    await expect(frame).not.toHaveAttribute("src", "/de/p/baeckerei-sonnenkorn");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the wall of pages is the sign-in screen's, standing still; nothing overflows", async ({ page }) => {
    await page.goto("/en/templates");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    // The same tilted wall of page captures as beside the sign-in form, but nothing in it moves.
    const wall = page.locator(".mk-wall").first();
    await expect(wall).toBeVisible();
    await expect(wall.locator("img").first()).toBeVisible();
    expect(await page.locator(".mk-marquee-y").count()).toBe(0);
    await expect(page.getByRole("button", { name: /^(Pause|Play) motion$/ })).toHaveCount(0);
  });

  test("well-known people are listed too, labelled as concepts, and start with their look", async ({ page }) => {
    await page.goto("/en/templates");
    await page.getByRole("button", { name: /^Well-known people/ }).click();
    const found = Number((await page.getByText(/^\d+ results$/).textContent())?.match(/\d+/)?.[0]);
    expect(found).toBeGreaterThanOrEqual(13);
    // Twelve at first, the rest one tap away.
    await page.getByRole("button", { name: /^Show \d+ more$/ }).click();
    await page.getByRole("button", { name: "Preview: Lionel Messi" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('iframe[title="Example page Lionel Messi"]')).toHaveAttribute("src", "/en/p/messi");
    await expect(dialog.getByText("Unofficial concept from public sources")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Use this template/ })).toHaveAttribute("href", "/en/signup?kind=other&look=messi");
  });

  test("preview a page, then start with exactly that template", async ({ page }) => {
    await page.goto("/en/templates");
    await page.getByRole("searchbox", { name: "Search examples" }).fill("Sonnenkorn");
    await page.getByRole("button", { name: "Preview: Bäckerei Sonnenkorn" }).last().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('iframe[title="Example page Bäckerei Sonnenkorn"]')).toHaveAttribute("src", "/de/p/baeckerei-sonnenkorn");
    const use = dialog.getByRole("link", { name: "Use this template" });
    await expect(use).toHaveAttribute("href", "/en/signup?kind=shop&look=baeckerei-sonnenkorn");
    await use.click();
    await page.waitForURL("**/en/signup?kind=shop&look=baeckerei-sonnenkorn");
    await page.waitForLoadState("networkidle");
    const name = `bake-${Date.now().toString(36)}`;
    await page.locator("#signup-email").fill(`${name}@example.com`);
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL("**/en/app/welcome");
    await expect(page.getByRole("radio", { name: /^Local shop/ })).toBeChecked();
  });

  test("example pages are labelled as examples and not indexed", async ({ page }) => {
    await page.goto("/de/p/baeckerei-sonnenkorn");
    await expect(page.getByText("Beispiel · Läden & Praxen").first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto("/ar/p/adam-nour");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("آدم نور");
  });

  test("the site menu leads to the gallery", async ({ page, isMobile }) => {
    test.skip(isMobile, "The desktop menu holds the link; the phone menu is covered by the marketing tests.");
    await page.goto("/en");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Templates" }).click();
    await page.waitForURL("**/en/templates");
  });

  test("scrolled down, the filters stick flush under the header on a solid band, with no card between them", async ({ page }) => {
    await page.goto("/en/templates");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: "instant" }));
    const filters = page.locator("[data-filters]");
    await expect(filters.getByRole("button", { name: /^All/ })).toBeVisible();
    const header = await page.getByRole("banner").boundingBox();
    const band = await filters.boundingBox();
    expect(header && band && Math.abs(band.y - (header.y + header.height))).toBeLessThanOrEqual(1);
    // Just under the header there is the filter band itself, not a card showing through a gap.
    const underHeader = await page.evaluate((y) => {
      const element = document.elementFromPoint(window.innerWidth / 2, y);
      return element?.closest("[data-filters]") !== null;
    }, (header?.y ?? 0) + (header?.height ?? 0) + 1);
    expect(underHeader).toBe(true);
    expect(await filters.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    // Flat: nothing on the page draws a shadow (ADR 0037).
    const shadowed = await page.evaluate(() =>
      [...document.querySelectorAll("body *")].filter((element) => getComputedStyle(element).boxShadow !== "none").length,
    );
    expect(shadowed).toBe(0);
  });
});

test.describe("moving pictures", () => {
  test("a hero clip loops silently over the photo and stays still for reduced motion", async ({ page }) => {
    await page.goto("/de/p/timo-lacht");
    const clip = page.locator("header video").first();
    await expect(clip).toHaveAttribute("src", "/media/motion/timo.mp4");
    await expect(clip).toHaveAttribute("aria-hidden", "true");
    expect(await clip.evaluate((video: HTMLVideoElement) => [video.muted, video.loop, video.playsInline])).toEqual([true, true, true]);
    // The photo stays underneath as poster and still version.
    await expect(page.locator("header img").first()).toBeVisible();
    const response = await page.request.get("/media/motion/timo.mp4");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("video/mp4");

    // It plays on its own, and the visitor can stop it (WCAG 2.2.2).
    const pause = page.getByRole("button", { name: "Bewegtes Bild anhalten" });
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(page.getByRole("button", { name: "Bewegtes Bild abspielen" })).toBeVisible();
    expect(await clip.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);

    // Reduced motion: the still photo first; the clip plays only when asked to.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const still = page.locator("header video").first();
    await expect(still).toHaveCSS("opacity", "0");
    expect(await still.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    await page.getByRole("button", { name: "Bewegtes Bild abspielen" }).click();
    await expect(page.getByRole("button", { name: "Bewegtes Bild anhalten" })).toBeVisible();
  });
});

test.describe("mono template", () => {
  test("Nela Voss: black-and-white portrait, bare social icons, titles in capitals", async ({ page }) => {
    await page.goto("/de/p/nela-voss");
    await expect(page.getByRole("heading", { level: 1, name: "Nela Voss" })).toBeVisible();
    // The portrait is shown in black and white, whatever the photo's colors.
    await expect(page.locator("header img").first()).toHaveCSS("filter", /grayscale/);
    // Social profiles are bare glyphs (no tile behind them) with a full touch target.
    const instagram = page.locator("header").getByRole("link", { name: "Instagram" });
    await expect(instagram).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const box = await instagram.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    // Sections titled in capitals; releases with their own covers; the two-up merch line.
    await expect(page.getByRole("heading", { level: 2, name: "Letzter Release" })).toHaveCSS("text-transform", "uppercase");
    await expect(page.getByText("Glas & Gold (Radio Edit)")).toBeVisible();
    await expect(page.getByRole("link", { name: /White Line Hoodie/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Black Line Hoodie/ })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
});

test.describe("link previews", () => {
  test("every page shares with its own preview card (photo, name, address)", async ({ page, request }) => {
    await page.goto("/en/p/mara-vale");
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toMatch(/\/en\/p\/mara-vale\/opengraph-image/);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    const response = await request.get(new URL(image ?? "", page.url()).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect((await response.body()).length).toBeGreaterThan(50_000);
    // The site itself has a card too.
    const home = await request.get("/de/opengraph-image");
    expect(home.headers()["content-type"]).toBe("image/png");
  });
});

test.describe("apps and skills on example pages", () => {
  test("an app explainer: one button opens the visitor's own store, codes copy in one tap, partner apps are ads", async ({ page, context }, info) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // Still frames for axe (sections fade in as they scroll into view).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/de/p/merve-aksoy");
    // The featured app shows the official badges: App Store first, then Google Play, each to its own store.
    const appStore = page.getByRole("link", { name: "Laden im App Store: Fokuskreis" });
    const googlePlay = page.getByRole("link", { name: "Jetzt bei Google Play: Fokuskreis" });
    await expect(appStore).toHaveAttribute("href", "https://example.com/merve-aksoy/apps/fokuskreis/appstore");
    await expect(googlePlay).toHaveAttribute("href", "https://example.com/merve-aksoy/apps/fokuskreis/googleplay");
    expect((await appStore.boundingBox())?.x ?? 1).toBeLessThan((await googlePlay.boundingBox())?.x ?? 0);
    // Apple allows one App Store badge per layout: the other apps get a "Get" button, and the marks are credited.
    await expect(page.getByRole("link", { name: /^Laden im App Store: / })).toHaveCount(1);
    await expect(page.getByText(/Apple, das Apple Logo und App Store sind Marken der Apple Inc\./)).toBeVisible();
    // The phone project is an Android phone: its button opens Google Play; a computer gets the first store.
    const android = info.project.name === "mobile";
    const [mine, other] = android ? ["Sprachfuchs bei Google Play laden", "Sprachfuchs im App Store laden"] : ["Sprachfuchs im App Store laden", "Sprachfuchs bei Google Play laden"];
    await expect(page.getByRole("link", { name: mine })).toHaveAttribute("href", `https://example.com/merve-aksoy/apps/sprachfuchs/${android ? "googleplay" : "appstore"}`);
    // The other store stays one tap away; an app only in the App Store opens there for everyone.
    await expect(page.getByRole("link", { name: other })).toBeVisible();
    await expect(page.getByRole("link", { name: "Schlafwelle im App Store laden" })).toBeVisible();
    // Partner codes are advertising, labelled right by the app's name (and read out with it).
    await expect(page.getByText("Anzeige", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Bewertung 4,8 von 5")).toBeAttached();
    await page.getByRole("button", { name: "Code MERVE30 für Fokuskreis kopieren" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("MERVE30");
    // Screen readers hear it too (a polite live region in the button).
    await expect(page.getByText("Kopiert", { exact: true }).first()).toBeAttached();
    // From the top: the compact bar fades in with the scroll, half-faded text is not a resting state.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("a skills author: install commands copy in one tap; stars, language and license are readable", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en/p/arjun-mehta");
    const card = page.getByRole("article").filter({ hasText: "Brand voice" });
    await expect(card.getByText("Skill", { exact: true })).toBeVisible();
    await expect(card.getByText("2,140 stars on GitHub")).toBeAttached();
    await expect(card.getByText("arjun-mehta/brand-voice", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Copy the install command for Brand voice" }).click();
    // Fictional pages hand out example.com commands only: nobody installs a stranger's code from a demo.
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("npx skills add https://example.com/arjun-mehta/brand-voice");
    await expect(card.getByRole("link", { name: "View on GitHub" })).toHaveAttribute("href", "https://example.com/arjun-mehta/brand-voice");
    // A collection is a repository, not a skill.
    await expect(page.getByRole("article").filter({ hasText: "Agent skills" }).getByText("Skill", { exact: true })).toHaveCount(0);
    // From the top: the compact bar fades in with the scroll, half-faded text is not a resting state.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
});
