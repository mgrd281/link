import { tokens } from "@linkyo/tokens";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * The dashboard shell's navigation: "‹ back" and the browser's history stay in step, tabs remember
 * their scroll only until it is used, focus is never dropped on a move, unsaved edits are guarded
 * on every screen, and the desk layout switches in script and style at the same width.
 * Runs on desktop and on a phone (demo mode: everything lives in this browser's storage).
 */

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signedIn(page: Page, locale = "en") {
  const name = `nav-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL(`**/${locale}/app`);
  await expect(heading(page)).toBeVisible();
}

/** The visible link to a place: the sidebar on wide screens, the tab bar on phones. */
const place = (page: Page, name: string) => page.getByRole("link", { name, exact: true }).locator("visible=true").first();
/** The visible "‹ back" link: the phone top bar, or a pane's toolbar on wide screens. */
const back = (page: Page, to: string) => page.getByRole("link", { name: `Back: ${to}`, exact: true }).locator("visible=true").first();
/** The screen's own title (the live preview beside it holds the creator page's h1 too). */
const heading = (page: Page) => page.locator("#main h1").first();
const settingsEntry = (page: Page, isMobile: boolean) =>
  isMobile ? page.getByRole("link", { name: /^Settings and account/ }) : place(page, "Settings");
const unsavedLegal = (page: Page) => page.getByRole("link", { name: "Legal notice not saved" }).locator("visible=true").first();

const at = (page: Page, path: string) => page.waitForURL(new RegExp(`/en${path.replaceAll("/", "\\/")}$`));
const historyLength = (page: Page) => page.evaluate(() => window.history.length);

test.describe("dashboard navigation", () => {
  test("after a Back, the next back link still steps back through history", async ({ page, isMobile }) => {
    await signedIn(page);
    await settingsEntry(page, isMobile).click();
    await at(page, "/app/settings");
    await page.locator("#main").getByRole("link", { name: /^Legal notice/ }).click();
    await at(page, "/app/settings/legal");
    await back(page, "Settings").click();
    await at(page, "/app/settings");
    // A new page after that Back drops the entry ahead and adds one: the history keeps its length.
    await page.locator("#main").getByRole("link", { name: /^Account/ }).click();
    await at(page, "/app/settings/account");
    const length = await historyLength(page);
    await back(page, "Settings").click();
    await at(page, "/app/settings");
    expect(await historyLength(page), "‹ Settings should step back, not add a page").toBe(length);
    // So the browser's Back (Safari's edge swipe) goes where the user came from, not to Account.
    await page.goBack();
    await at(page, "/app");
  });

  test("a back link opens its screen when history holds another one before it", async ({ page, isMobile }) => {
    await signedIn(page);
    await settingsEntry(page, isMobile).click();
    await page.locator("#main").getByRole("link", { name: /^Legal notice/ }).click();
    await at(page, "/app/settings/legal");
    await page.getByLabel("Full name or company").fill("Mila Aurel");
    // Settings is visited with nothing ahead of it, then Home, Page and Back to Home.
    await place(page, "Home").click();
    await at(page, "/app");
    await settingsEntry(page, isMobile).click();
    await at(page, "/app/settings");
    await place(page, "Home").click();
    await at(page, "/app");
    await place(page, "Page").click();
    await at(page, "/app/editor");
    await page.goBack();
    await at(page, "/app");
    // The unsaved notice links to its pane. The page before it is Home, so "‹ Settings" must not go back.
    await unsavedLegal(page).click();
    await at(page, "/app/settings/legal");
    await back(page, "Settings").click();
    await at(page, "/app/settings");
    await expect(heading(page)).toHaveText("Settings");
  });

  test("two Backs, then a back link: it steps back only when its parent is the page before", async ({ page, isMobile }) => {
    test.skip(isMobile, "the sidebar links to Settings from a pane on wide screens only");
    await signedIn(page);
    await place(page, "Settings").click();
    await page.locator("#main").getByRole("link", { name: /^Legal notice/ }).click();
    await at(page, "/app/settings/legal");
    await page.getByLabel("Full name or company").fill("Mila Aurel");
    await place(page, "Home").click();
    await at(page, "/app");
    // Home → the notice → Settings → Home, then Back twice: the notice, with Home before it.
    await unsavedLegal(page).click();
    await at(page, "/app/settings/legal");
    await place(page, "Settings").click();
    await at(page, "/app/settings");
    await place(page, "Home").click();
    await at(page, "/app");
    await page.goBack();
    await at(page, "/app/settings");
    await page.goBack();
    await at(page, "/app/settings/legal");
    await back(page, "Settings").click();
    await at(page, "/app/settings");
    await expect(heading(page)).toHaveText("Settings");
  });

  test("a Back right after a tap is a move through history: the pane does not slide in or take focus again", async ({ page, isMobile }) => {
    await signedIn(page);
    await settingsEntry(page, isMobile).click();
    await page.locator("#main").getByRole("link", { name: /^Account/ }).click();
    await at(page, "/app/settings/account");
    const slide = page.locator('[class*="animate-page-in"]');
    await expect(slide, "a pane opened in the app slides in").toHaveCount(1);
    await place(page, "Home").click();
    await at(page, "/app");
    await page.goBack();
    await at(page, "/app/settings/account");
    await expect(heading(page)).toHaveText("Account");
    await expect(slide).toHaveCount(0);
    await expect(heading(page)).not.toBeFocused();
  });

  test("a tab's saved scroll position is restored once, not again on a later Back", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the tab bar (and its scroll memory) is on phones");
    await signedIn(page);
    // The browser's own restoration is off for the pages that follow (new entries take the mode of
    // the one they come from), so what is measured is what the shell does by itself.
    await page.evaluate(() => {
      window.history.scrollRestoration = "manual";
    });
    // An unsaved notice gives the top bar a plain link out of a tab (not a tab tap).
    await settingsEntry(page, true).click();
    await page.locator("#main").getByRole("link", { name: /^Legal notice/ }).click();
    await page.getByLabel("Full name or company").fill("Mila Aurel");
    await place(page, "Design").click();
    await at(page, "/app/design");
    const room = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(room, "Design scrolls far enough for this test").toBeGreaterThan(620);
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
    const scrollTo = async (y: number) => {
      await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
      await expect.poll(scrollY).toBe(y);
    };
    const settled = async () => {
      await expect(heading(page)).toHaveText("Design");
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      return scrollY();
    };

    // A tab tap saves the position and Back brings it back.
    await scrollTo(250);
    await place(page, "Home").click();
    await at(page, "/app");
    await page.goBack();
    await at(page, "/app/design");
    expect(await settled()).toBe(250);
    // Used once: after scrolling on and moving away, the next Back leaves the position alone.
    await scrollTo(600);
    await page.goForward();
    await at(page, "/app");
    await scrollTo(0);
    await page.goBack();
    await at(page, "/app/design");
    expect(await settled(), "not the position used before (250)").toBe(0);

    // The same when the tab bar brought it back and a plain link led out.
    await scrollTo(250);
    await place(page, "Home").click();
    await at(page, "/app");
    await place(page, "Design").click();
    await at(page, "/app/design");
    expect(await settled()).toBe(250);
    await scrollTo(600);
    await unsavedLegal(page).click();
    await at(page, "/app/settings/legal");
    await scrollTo(0);
    await page.goBack();
    await at(page, "/app/design");
    expect(await settled(), "not the position used before (250)").toBe(0);
  });

  test("a move that removes the focused link puts focus on the new screen's title", async ({ page, isMobile }) => {
    await signedIn(page);
    if (isMobile) {
      // The avatar becomes "‹ Home" in the same place: focus goes to the Settings title.
      await settingsEntry(page, true).focus();
      await page.keyboard.press("Enter");
      await at(page, "/app/settings");
      await expect(heading(page)).toHaveText("Settings");
      await expect(heading(page)).toBeFocused();
      await back(page, "Home").focus();
      await page.keyboard.press("Enter");
      await at(page, "/app");
      await expect(heading(page)).toBeFocused();
    } else {
      // A pane's "‹ Settings" leaves with the pane.
      await page.goto("/en/app/settings/legal");
      await back(page, "Settings").focus();
      await page.keyboard.press("Enter");
      await at(page, "/app/settings");
      await expect(heading(page)).toHaveText("Settings");
      await expect(heading(page)).toBeFocused();
    }
    // A tab or sidebar row stays where it is, and so does focus.
    const tab = place(page, "Page");
    await tab.focus();
    await page.keyboard.press("Enter");
    await at(page, "/app/editor");
    await expect(tab).toBeFocused();
  });

  test("an unsaved legal notice asks before the tab closes, from any screen", async ({ page }) => {
    await signedIn(page);
    const guarded = () =>
      page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
    await page.goto("/en/app/settings/legal");
    expect(await guarded(), "nothing typed yet").toBe(false);
    await page.getByLabel("Full name or company").fill("Mila Aurel");
    expect(await guarded(), "on the legal pane").toBe(true);
    await place(page, "Home").click();
    await at(page, "/app");
    await expect(unsavedLegal(page)).toBeVisible();
    expect(await guarded(), "on Home").toBe(true);
    // The real thing: the browser's "Leave site?" question.
    const dialog = page.waitForEvent("dialog", { timeout: 10_000 });
    await page.close({ runBeforeUnload: true });
    const question = await dialog;
    expect(question.type()).toBe("beforeunload");
    await question.accept();
  });

  test("the live preview column and the desk layout switch at the same width", async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone is narrower than the desk breakpoint");
    const { lg, desk } = tokens.breakpoint;
    await signedIn(page);
    await page.goto("/en/app/design");
    const aside = page.locator("[data-preview-aside]");
    const inline = page.locator("[data-sticky-preview]");
    const button = page.locator("#main").getByRole("button", { name: "Preview", exact: true });
    // Phones and tablets: the Design screen keeps its own copy of the page under the bar.
    await page.setViewportSize({ width: lg - 1, height: 900 });
    await expect(inline).toBeVisible();
    await expect(aside).toHaveCount(0);
    // Laptops below desk (dashboard on laptops): no copy over the template grid; the toolbar's button
    // opens the page. Script and style switch at the same width.
    await page.setViewportSize({ width: lg, height: 900 });
    await expect(inline).toHaveCount(0);
    await expect(aside).toHaveCount(0);
    await expect(button).toBeVisible();
    await page.setViewportSize({ width: desk - 1, height: 900 });
    await expect(inline).toHaveCount(0);
    await expect(button).toBeVisible();
    // From desk the column shows.
    await page.setViewportSize({ width: desk, height: 900 });
    await expect(aside).toBeVisible();
    await expect(inline).toHaveCount(0);
    await expect(button).toBeHidden();
  });
});
