import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * WP4.5 (D-15): the ⌘K / Ctrl+K palette on every dashboard screen (screens, a block type to add, a
 * block found by its title), its screen-reader contract (combobox and listbox, the count read out,
 * focus back where it was), right to left; the "?" shortcut list; the phone's search button; the Add
 * sheet's search in de, en and ar with its empty state; and none of it inside the iPhone app.
 */

const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;
const STORAGE_KEY = "linkyo.demo.v1";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SHOTS = process.env.WP45_SHOTS ?? "";

const APP_SCRIPT = `(() => {
  const mark = () => { document.documentElement.dataset.app = "ios"; };
  if (document.documentElement) mark();
  else new MutationObserver((_, observer) => { if (document.documentElement) { mark(); observer.disconnect(); } }).observe(document, { childList: true });
  window.linkyoApp = { platform: "ios", version: "1.0", bridge: 1 };
  window.webkit = { messageHandlers: { linkyo: { postMessage: () => undefined } } };
})();`;

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
const heading = (page: Page) => page.locator("#main h1").first();

async function signedIn(page: Page, locale: Locale = "en") {
  const name = `pl-${unique()}`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: MESSAGES[locale].app.welcome.skip }).click();
  await page.waitForURL(`**/${locale}/app`);
  await expect(heading(page)).toBeVisible();
  return MESSAGES[locale];
}

async function seed(page: Page) {
  await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { session: { accountId: string }; sites: Record<string, { page: { blocks: unknown[] } }> };
    const site = db.sites[db.session.accountId];
    if (!site) throw new Error("no site");
    const block = (id: string, extra: Record<string, unknown>) => ({ id, visible: true, highlight: false, ...extra });
    site.page.blocks = [
      block("l-tickets", { type: "link", title: "Tickets", url: "https://example.com/tickets" }),
      block("l-merch", { type: "link", title: "Merch store", url: "https://example.com/merch" }),
      block("t-about", { type: "text", text: "Songs and shows from Cologne." }),
    ];
    window.localStorage.setItem(key, JSON.stringify(db));
  }, STORAGE_KEY);
  await page.reload();
  await expect(heading(page)).toBeVisible();
}

const palette = (page: Page) => page.getByRole("dialog", { name: MESSAGES.en.app.palette.label });
const combobox = (page: Page, locale: Locale = "en") => page.getByRole("combobox", { name: MESSAGES[locale].app.palette.label });

async function axe(page: Page) {
  // A colour scheme just switched starts colour transitions: axe waits until they ran (LEFTOVERS 23).
  await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation instanceof CSSTransition).map((animation) => animation.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

/** Opens the palette with the keyboard: the phone project too has a keyboard in Playwright. */
async function openWithKeys(page: Page, locale: Locale = "en") {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(combobox(page, locale)).toBeFocused();
}

test.describe("the ⌘K palette (D-15)", () => {
  test("opens on Ctrl/⌘K on every dashboard screen and closes on a second press or Escape, focus back where it was", async ({ page }) => {
    await signedIn(page);
    for (const screen of ["/en/app", "/en/app/editor", "/en/app/design", "/en/app/analytics", "/en/app/settings", "/en/app/settings/visibility", "/en/app/invite"]) {
      await page.goto(screen);
      await expect(heading(page)).toBeVisible();
      await openWithKeys(page);
      await page.keyboard.press("ControlOrMeta+k");
      await expect(palette(page), screen).toHaveCount(0);
    }
    // Focus returns to what had it: here the screen's title, focused by hand first.
    await page.goto("/en/app/settings");
    await heading(page).focus();
    await openWithKeys(page);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
    await expect(heading(page)).toBeFocused();
  });

  test("a screen reader hears a combobox over a listbox, the active row and how many results there are", async ({ page }) => {
    const m = await signedIn(page);
    await seed(page);
    await openWithKeys(page);
    const box = combobox(page);
    const list = page.getByRole("listbox", { name: m.app.palette.label });
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await expect(box).toHaveAttribute("aria-controls", (await list.getAttribute("id")) ?? "missing");
    const first = await box.getAttribute("aria-activedescendant");
    await page.keyboard.press("ArrowDown");
    const second = await box.getAttribute("aria-activedescendant");
    expect(second).not.toBe(first);
    await expect(page.locator(`#${second ?? "missing"}`)).toHaveAttribute("aria-selected", "true");
    // The count is read out (a polite live region) and follows the query.
    // "merch" alone also finds the Product type (its search words); with "store" only the block.
    await box.fill("merch store");
    await expect(palette(page).locator("[aria-live=polite]")).toHaveText("1 result");
    await expect(page.getByRole("option")).toHaveCount(1);
    await box.fill("zzzzqqq");
    await expect(palette(page).locator("[aria-live=polite]")).toHaveText("No results");
    await expect(palette(page).getByText(m.app.palette.empty)).toBeVisible();
    await expect(box).toHaveAttribute("aria-expanded", "false");
    expect(await axe(page)).toEqual([]);
  });

  test("goes to a screen", async ({ page }) => {
    await signedIn(page);
    await openWithKeys(page);
    await combobox(page).fill("visibility");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/en/app/settings/visibility");
    await expect(heading(page)).toHaveText(en.app.visibility.title);
    await openWithKeys(page);
    await combobox(page).fill("stats");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/en/app/analytics");
  });

  test("adds a block type: the Add sheet opens at that type's form", async ({ page }) => {
    const m = await signedIn(page);
    await page.goto("/en/app/design");
    await expect(heading(page)).toBeVisible();
    await openWithKeys(page);
    await combobox(page).fill("testimonials");
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: m.app.edit.addTitle.replace("{type}", m.dashboard.types.quotes) });
    await expect(sheet).toBeVisible();
  });

  test("finds a block on the page by its title and opens it", async ({ page }) => {
    const m = await signedIn(page);
    await seed(page);
    await openWithKeys(page);
    await combobox(page).fill("merch store");
    await expect(page.getByRole("option", { name: "Merch store" })).toBeVisible();
    await page.getByRole("option", { name: "Merch store" }).click();
    const sheet = page.getByRole("dialog").filter({ has: page.getByRole("textbox", { name: m.app.fields.title }) });
    await expect(sheet.getByRole("textbox", { name: m.app.fields.title })).toHaveValue("Merch store");
  });

  test("ar: right to left, Arabic search, and an Arabic type added", async ({ page }) => {
    const m = await signedIn(page, "ar");
    await openWithKeys(page, "ar");
    const box = combobox(page, "ar");
    expect(await box.evaluate((input) => getComputedStyle(input).direction)).toBe("rtl");
    await box.fill("فيديو");
    await expect(page.getByRole("option", { name: m.dashboard.types.video, exact: true })).toBeVisible();
    // Written as people type it: ه for ة.
    await box.fill("صوره");
    await expect(page.getByRole("option", { name: m.dashboard.types.image, exact: true })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/palette-ar-${test.info().project.name}.png` });
  });

  test("on phones the top bar's search button opens it", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the phone's top bar");
    const m = await signedIn(page, "de");
    const button = page.locator("header").getByRole("button", { name: m.app.palette.open, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await button.click();
    await expect(combobox(page, "de")).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/palette-de-${test.info().project.name}.png` });
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
  });

  test("on laptops the rail's search button opens it, with its shortcut in the tooltip", async ({ page, isMobile }) => {
    test.skip(isMobile, "the rail");
    const m = await signedIn(page);
    const button = page.locator("[data-nav]").getByRole("button", { name: m.app.palette.open, exact: true });
    await button.hover();
    // Chromium here runs on Linux: Ctrl, not ⌘.
    await expect(page.getByRole("tooltip")).toContainText("Ctrl+K");
    await button.click();
    await expect(combobox(page)).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/palette-en-${test.info().project.name}.png` });
  });
});

test.describe("the ? shortcut list (D-15)", () => {
  test("lists the shortcuts with Ctrl on this platform, and not while typing", async ({ page }) => {
    const m = await signedIn(page);
    const s = m.app.shortcuts;
    await page.keyboard.press("?");
    const sheet = page.getByRole("dialog", { name: s.title });
    await expect(sheet).toBeVisible();
    for (const id of ["palette", "shortcuts", "undo", "redo", "moveUp", "moveDown", "close"] as const) await expect(sheet.getByText(s.items[id], { exact: true })).toBeVisible();
    await expect(sheet.locator("kbd", { hasText: "Ctrl" }).first()).toBeVisible();
    await expect(sheet.locator("kbd", { hasText: "⌘" })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);

    // Typing a question mark in a field is typing.
    await page.goto("/en/app/settings/visibility");
    await page.getByRole("textbox", { name: m.app.visibility.titleLabel }).fill("Why?");
    await expect(page.getByRole("dialog", { name: s.title })).toHaveCount(0);
  });

  test("the palette offers the list only where there is a fine pointer", async ({ page, isMobile }) => {
    const m = await signedIn(page);
    await openWithKeys(page);
    await combobox(page).fill(m.app.palette.shortcuts);
    await expect(page.getByRole("option", { name: m.app.palette.shortcuts })).toHaveCount(isMobile ? 0 : 1);
  });
});

test.describe("the Add sheet's search (D-15)", () => {
  for (const [locale, query, type, nothing] of [
    ["de", "tickets", "events", "xylophonbaustelle"],
    ["en", "spotify", "music", "xylophone"],
    ["ar", "تذاكر", "events", "زززز"],
  ] as const) {
    test(`${locale}: filters the entries by name and search words, with an empty state`, async ({ page }) => {
      const m = await signedIn(page, locale);
      const a = m.app.add;
      await page.goto(`/${locale}/app/editor`);
      await expect(heading(page)).toBeVisible();
      // The phone's tab bar or the rail: Add.
      await page.getByRole("button", { name: m.app.nav.add, exact: true }).locator("visible=true").first().click();
      const sheet = page.getByRole("dialog", { name: a.title });
      await expect(sheet).toBeVisible();
      const cards = sheet.locator("button[data-type], button[data-preset]");
      // The demo offers every entry: 24 types and the Clients preset.
      await expect(cards).toHaveCount(25);
      const field = sheet.getByRole("searchbox", { name: a.searchLabel });
      await field.fill(query);
      await expect(sheet.locator(`button[data-type="${type}"]`)).toBeVisible();
      expect(await cards.count()).toBeLessThan(25);
      await field.fill(nothing);
      await expect(cards).toHaveCount(0);
      await expect(sheet.locator("[data-add-empty]")).toContainText(nothing);
      expect(await axe(page)).toEqual([]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/add-search-${locale}-${test.info().project.name}.png` });
      // Emptied, every entry is back.
      await field.fill("");
      await expect(cards).toHaveCount(25);
    });
  }
});

test("inside the iPhone app: no palette, no search button, no ? list (ADR 0087)", async ({ page }) => {
  await page.addInitScript(APP_SCRIPT);
  const m = await signedIn(page, "de");
  await expect(page.getByRole("button", { name: m.app.palette.open, exact: true })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.press("?");
  await page.waitForTimeout(500);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
