import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Laufbahn (ADR 0069), the template for applications and CVs: the section index works with the
 * keyboard and keeps each section clear of the compact bar, reduced motion stills every animation,
 * phone and desktop pass axe, and Arabic pages are mirrored. Runs in the desktop project; phone checks
 * open their own phone-sized context.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SEVAG = "/de/p/sevag-ghazarian-2131af";
/** The portfolio sample on Laufbahn: a contact block, projects, quotes, clients, skills and experience. */
const SAMPLE = (locale: "en" | "ar") => `/${locale}/directions/poster?chrome=0&template=laufbahn&page=portfolio`;
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function phone(browser: Browser, options: { reducedMotion?: "reduce" | "no-preference" } = {}): Promise<Page> {
  const context = await browser.newContext({ ...PHONE, ...options });
  await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
  return context.newPage();
}

const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`);

test.describe("Laufbahn", () => {
  test("the section index leads to each section by keyboard, clear of the compact bar", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const index = page.getByRole("navigation", { name: "Abschnitte" });
    await expect(index.getByRole("link")).toHaveText(["AÜber mich", "BWas ich mitbringe", "CWerdegang", "DNeu für mich: das Tönen", "EAnschreiben"]);
    // Tab walks the index in order; Enter follows a link.
    await index.getByRole("link", { name: "Über mich" }).focus();
    await page.keyboard.press("Tab");
    await expect(index.getByRole("link", { name: "Was ich mitbringe" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(index.getByRole("link", { name: "Werdegang" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#section-path$/);
    const title = page.getByRole("heading", { level: 2, name: "Werdegang" });
    await expect(title).toBeInViewport();
    // The section stops below the compact bar (scroll margin), never under it.
    const bar = await page.locator(".poster-bar").boundingBox();
    const box = await title.boundingBox();
    expect(box && bar && box.y >= bar.y + bar.height).toBe(true);
    // On the wide canvas the index stays in view beside the sections and marks the one being read.
    await expect(index.getByRole("list")).toBeInViewport();
    const here = (name: string) => index.getByRole("link", { name }).evaluate((link) => getComputedStyle(link).getPropertyValue("--lb-here").trim());
    expect(await here("Werdegang")).toBe("1");
    expect(await here("Über mich")).toBe("0");
    // "Weiterlesen" in the hero leads to the first section.
    await page.goto(SEVAG);
    await page.getByRole("link", { name: "Weiterlesen: Über mich" }).press("Enter");
    await expect(page).toHaveURL(/#section-about$/);
    await expect(page.getByRole("heading", { level: 2, name: "Über mich" })).toBeInViewport();
  });

  test("phones: the picture runs edge to edge, the index is a row of chips under the hero, the Linkyo bar still comes in", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SEVAG);
    const plate = await page.locator("[data-hero-plate]").boundingBox();
    expect(plate?.x).toBe(0);
    expect(plate?.width).toBe(390);
    // About three quarters of the screen, and the name stands on it.
    expect(plate && plate.height > 844 * 0.6 && plate.height < 844 * 0.8).toBe(true);
    const name = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(name && plate && name.y + name.height <= plate.y + plate.height).toBe(true);
    // The chips scroll sideways, the page itself never does.
    const chips = page.getByRole("navigation", { name: "Abschnitte" }).getByRole("list");
    expect(await chips.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    const link = page.getByRole("navigation", { name: "Abschnitte" }).getByRole("link", { name: "Anschreiben" });
    await link.focus();
    await expect(link).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Anschreiben" })).toBeInViewport();
    await expect(page.locator("[data-shown]")).toHaveCount(1);
    expect(await axe(page)).toEqual([]);
    await page.context().close();
  });

  test("with reduced motion nothing moves; without it the sections, the picture and the rail are animated", async ({ browser }) => {
    const names = (page: Page) =>
      page.evaluate(() => ({
        reveal: getComputedStyle(document.querySelector(".lb-reveal") ?? document.body).animationName,
        rise: getComputedStyle(document.querySelector(".poster-rise") ?? document.body).animationName,
        zoom: getComputedStyle(document.querySelector(".lb-zoom") ?? document.body).animationName,
        rail: getComputedStyle(document.querySelector(".lb-step") ?? document.body, "::after").animationName,
        running: document
          .getAnimations()
          .filter((animation) => animation.playState === "running" && animation.timeline === document.timeline)
          .map((animation) => (animation instanceof CSSAnimation ? animation.animationName : "other")),
      }));
    const still = await phone(browser, { reducedMotion: "reduce" });
    await still.goto(SEVAG);
    expect(await names(still)).toEqual({ reveal: "none", rise: "none", zoom: "none", rail: "none", running: [] });
    // The rail is drawn in full without its animation.
    expect(await still.locator(".lb-step").first().evaluate((step) => getComputedStyle(step, "::after").scale)).toBe("none");
    await still.context().close();
    const moving = await phone(browser, { reducedMotion: "no-preference" });
    await moving.goto(SEVAG);
    const live = await names(moving);
    expect([live.reveal, live.rise, live.zoom, live.rail]).toEqual(["poster-rise", "poster-rise", "lb-zoom", "lb-fill"]);
    await moving.context().close();
  });

  test("axe finds nothing on phone and desktop, with and without a contact block", async ({ page, browser }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const url of [SEVAG, SAMPLE("en"), SAMPLE("ar")]) {
      await page.goto(url);
      expect(await axe(page), url).toEqual([]);
    }
    const small = await phone(browser, { reducedMotion: "reduce" });
    for (const url of [SAMPLE("en"), SAMPLE("ar")]) {
      await small.goto(url);
      expect(await axe(small), url).toEqual([]);
    }
    // With a contact block the hero leads with its action, "Read on" beside it as the quiet partner.
    await small.goto(SAMPLE("en"));
    const actions = small.locator("[data-hero-actions]");
    await expect(actions.getByRole("link", { name: "Ask about a project" })).toBeVisible();
    await expect(small.getByRole("link", { name: /^Read on: / })).toBeVisible();
    await small.context().close();
  });

  test("Arabic pages are mirrored: the name, the index, the signposts and the timeline start on the right", async ({ browser }) => {
    const page = await phone(browser, { reducedMotion: "reduce" });
    await page.goto(SAMPLE("ar"));
    await expect(page.locator("[lang='ar']").first()).toHaveAttribute("dir", "rtl");
    const name = await page.getByRole("heading", { level: 1 }).boundingBox();
    // The name's lines end at the right gutter.
    const right = await page.getByRole("heading", { level: 1 }).evaluate((h1) => Math.max(...[...h1.querySelectorAll("bdi")].map((bdi) => bdi.getBoundingClientRect().right)));
    expect(name && right > 390 - 40).toBe(true);
    const links = page.getByRole("navigation", { name: "الأقسام" }).getByRole("link");
    const [first, second] = [await links.nth(0).boundingBox(), await links.nth(1).boundingBox()];
    expect(first && second && first.x > second.x).toBe(true);
    await expect(links.first()).toContainText("أ");
    // A timeline's nodes stand at the right edge of its steps.
    const step = page.locator(".lb-step").first();
    const [stepBox, nodeBox] = [await step.boundingBox(), await step.locator("span[aria-hidden]").first().boundingBox()];
    expect(stepBox && nodeBox && nodeBox.x + nodeBox.width >= stepBox.x + stepBox.width - 1).toBe(true);
    await page.context().close();
  });
});
