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
    expect(await cards.count()).toBeGreaterThanOrEqual(40);
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

  test("the moving wall makes one pass and rests, holds under the mouse, stays still for reduced motion; nothing overflows", async ({ page, isMobile }) => {
    await page.goto("/en/templates");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    // No pause button (WCAG 2.2.2 is met by the motion itself): one pass on wide screens, a row to
    // swipe on phones.
    await expect(page.getByRole("button", { name: /^(Pause|Play) motion$/ })).toHaveCount(0);
    if (!isMobile) {
      const lane = page.locator(".mk-marquee-y").first();
      await expect(lane).toHaveCSS("animation-iteration-count", "1");
      // The lane itself never stands still long enough to be "stable"; hover its frame.
      await page.locator("[data-marquee]").first().hover();
      await expect(lane).toHaveCSS("animation-play-state", "paused");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload();
      await expect(page.locator(".mk-marquee-y").first()).toHaveCSS("animation-name", "none");
    }
  });

  test("well-known people are listed too, labelled as concepts, and start with their look", async ({ page }) => {
    await page.goto("/en/templates");
    await page.getByRole("button", { name: /^Well-known people/ }).click();
    const cards = page.getByRole("button", { name: /^Preview: / });
    expect(await cards.count()).toBeGreaterThanOrEqual(13);
    await page.getByRole("button", { name: "Preview: Lionel Messi" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('iframe[title="Example page Lionel Messi"]')).toHaveAttribute("src", "/en/p/messi");
    await expect(dialog.getByText("Unofficial concept from public sources")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Use this template/ })).toHaveAttribute("href", "/en/signup?kind=other&look=messi");
  });

  test("preview a page, then start with exactly that template", async ({ page }) => {
    await page.goto("/en/templates");
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
