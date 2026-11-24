import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createTranslator } from "next-intl";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * Dashboard correctness (demo build), on a phone and on a laptop: a pasted ticket link never
 * publishes a made-up show; a toast never stays over a sheet or after its change was undone; a page
 * that shows work has exactly one next step on Home, and the progress is said once; Settings marks
 * no tab; a page with nothing to tap counts no clicks; a short page fills the preview's screen.
 */

const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;
type Messages = (typeof MESSAGES)[Locale];

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const TICKET = "https://www.eventbrite.de/e/release-night-tickets-123456789";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
const plural = (locale: Locale, key: "ticketNotice", count: number) => createTranslator({ locale, messages: MESSAGES[locale], namespace: "app.add" })(key, { count });
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A progress message ("{done} von {total}") with any count of done steps out of six. */
const counted = (message: string) => new RegExp(`^${escape(message).replace("\\{done\\}", "\\d+").replace("\\{total\\}", "6")}$`);
/** The toasts on screen. A modal sheet hides the page from screen readers, so they are found by markup. */
const toasts = (page: Page) => page.locator("[role=region][aria-label$='(F8)'] li[data-state=open]");

/** Sign up and leave the welcome flow at once (with `kind`, after choosing what the page is for). */
async function signedIn(page: Page, locale: Locale = "en", kind?: string) {
  const m = MESSAGES[locale];
  const name = `mila-${unique()}`;
  // Sheets and steps slide in; checks look at the settled screen.
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Pasted links ask our server for a title; these tests need none (and no request leaves the machine).
  await page.route("**/api/link-metadata**", (route) => route.fulfill({ json: {} }));
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  if (kind) await page.locator(`label:has(input[name=kind][value=${kind}])`).click();
  await page.getByRole("button", { name: m.app.welcome.skip }).click();
  await page.waitForURL(`**/${locale}/app`);
  return { m, name };
}

async function openAdd(page: Page, m: Messages) {
  await page.getByRole("button", { name: m.app.nav.add, exact: true }).locator("visible=true").first().click();
  const sheet = page.getByRole("dialog", { name: m.app.add.title });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function paste(sheet: Locator, m: Messages, text: string) {
  await sheet.getByLabel(m.app.add.pasteLabel).fill(text);
  await sheet.getByRole("button", { name: m.app.add.addButton, exact: true }).click();
}

/** "Add to page": the footer button on wide screens, the navigation row's on phones. */
const confirm = (dialog: Locator, m: Messages) => dialog.getByRole("button", { name: m.app.edit.add, exact: true }).locator("visible=true").first();
const eventsForm = (page: Page, m: Messages) => page.getByRole("dialog", { name: fill(m.app.edit.addTitle, { type: m.dashboard.types.events }) });

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
}

test.describe("a pasted ticket link", () => {
  test("opens the Events form: the address filled in, date and city empty and required, nothing shown until it has a date", async ({ page, isMobile }) => {
    const { m } = await signedIn(page);
    const sheet = await openAdd(page, m);
    await paste(sheet, m, TICKET);

    const form = eventsForm(page, m);
    await expect(form).toBeVisible();
    await expect(form.getByRole("status")).toHaveText(plural("en", "ticketNotice", 1));
    await expect(form.getByLabel(m.app.fields.tickets)).toHaveValue(TICKET);
    const date = form.getByLabel(m.app.fields.date, { exact: true });
    const city = form.getByLabel(m.app.fields.city, { exact: true });
    await expect(date).toHaveValue("");
    await expect(city).toHaveValue("");
    await expect(form.getByLabel(m.app.fields.venue, { exact: true })).toHaveValue("");
    // No title either: the page names the section itself.
    await expect(form.getByLabel(m.app.fields.titleOptional)).toHaveValue("");
    // No invented show anywhere on screen (the old default was "20 MAR · Berlin").
    await expect(page.getByText("Berlin")).toHaveCount(0);
    expect(await axe(page)).toEqual([]);

    // Adding asks for both, and adds nothing yet.
    await confirm(form, m).click();
    await expect(date).toHaveAttribute("aria-invalid", "true");
    await expect(city).toHaveAttribute("aria-invalid", "true");
    await expect(form).toBeVisible();

    const preview = page.locator("[data-preview-aside] [role=region]");
    await city.fill("Leipzig");
    if (!isMobile) {
      // The page beside the form leaves the show out while it has no date.
      await expect(preview).toBeVisible();
      await expect(preview).not.toContainText("Leipzig");
    }
    await date.fill("2027-05-01");
    if (!isMobile) await expect(preview).toContainText("Leipzig");
    await expect(city).not.toHaveAttribute("aria-invalid", "true");

    await confirm(form, m).click();
    await expect(form).toBeHidden();
    // On the page now, with the owner's date and city.
    await page.getByRole("link", { name: m.app.nav.page, exact: true }).locator("visible=true").first().click();
    await page.waitForURL("**/en/app/editor");
    await expect(page.locator("main").getByText(m.dashboard.types.events, { exact: true }).first()).toBeVisible();
    if (!isMobile) await expect(preview).toContainText("Leipzig");
  });

  test("among other links: those are added at once, and the toast stays clear of the sheet", async ({ page, isMobile }) => {
    const { m } = await signedIn(page);
    const sheet = await openAdd(page, m);
    await paste(sheet, m, `https://example.com/press ${TICKET} https://www.ticketmaster.de/event/release-night/555`);

    const form = eventsForm(page, m);
    await expect(form).toBeVisible();
    // One show per ticket link, each with its address and nothing else.
    await expect(form.getByRole("status")).toHaveText(plural("en", "ticketNotice", 2));
    await expect(form.getByLabel(m.app.fields.tickets)).toHaveCount(2);
    await expect(form.getByLabel(m.app.fields.tickets).nth(1)).toHaveValue("https://www.ticketmaster.de/event/release-night/555");

    // The other link was added, and its toast does not cover the sheet's controls.
    const toast = toasts(page);
    await expect(toast).toHaveCount(1);
    // It offers no "Edit": that would leave the Events form still being filled in.
    await expect(toast.locator("button", { hasText: m.app.added.edit })).toHaveCount(0);
    const box = await toast.boundingBox();
    const panel = await form.boundingBox();
    expect(box && panel).toBeTruthy();
    if (box && panel) {
      if (isMobile) expect(box.y + box.height).toBeLessThanOrEqual(panel.y + 1);
      else expect(box.x + box.width).toBeLessThanOrEqual(panel.x + 1);
    }
  });
});

test.describe("a toast beside the Events form on a 1280 px laptop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("has room for its words and its Undo, and covers no part of the panel", async ({ page, isMobile }) => {
    test.skip(isMobile, "The panel beside the preview is a laptop layout.");
    const { m } = await signedIn(page);
    const sheet = await openAdd(page, m);
    await paste(sheet, m, `https://example.com/press https://example.org/shop ${TICKET}`);
    const form = eventsForm(page, m);
    await expect(form).toBeVisible();
    const toast = toasts(page);
    await expect(toast).toHaveCount(1);
    // Found by markup: the modal sheet hides the page (and the toast) from the accessibility tree.
    await expect(toast.locator("button", { hasText: m.app.undo })).toBeVisible();
    const box = await toast.boundingBox();
    const panel = await form.boundingBox();
    // The words' box (the one that grows): it shrank to nothing when the space before the panel was ~180 px.
    const title = await toast.locator("div.flex-1").first().boundingBox();
    expect(box && panel && title).toBeTruthy();
    if (box && panel && title) {
      // Wide enough for a toast with an action (layout.toast, less the viewport's padding) ...
      expect(box.width).toBeGreaterThanOrEqual(280);
      expect(title.width).toBeGreaterThan(40);
      // ... and beside the panel, before or after it.
      expect(box.x + box.width <= panel.x + 1 || box.x >= panel.x + panel.width - 1).toBe(true);
    }
  });
});

test.describe("toasts", () => {
  test("close when a sheet opens, and when their change is undone", async ({ page }) => {
    const { m } = await signedIn(page);
    await page.getByRole("link", { name: m.app.nav.page, exact: true }).locator("visible=true").first().click();
    await page.waitForURL("**/en/app/editor");

    let sheet = await openAdd(page, m);
    await paste(sheet, m, "https://example.com/press");
    await expect(sheet).toBeHidden();
    const rows = page.locator("main").getByText("example.com", { exact: true });
    await expect(rows.first()).toBeVisible();
    await expect(toasts(page)).toHaveCount(1);

    // A sheet opens: the toast goes, so it never covers the sheet's controls.
    sheet = await openAdd(page, m);
    await expect(toasts(page)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // A change undone with Ctrl+Z takes its toast ("… added · Edit") with it.
    sheet = await openAdd(page, m);
    await paste(sheet, m, "https://example.org/shop");
    await expect(sheet).toBeHidden();
    await expect(toasts(page)).toHaveCount(1);
    await page.locator("main").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("Control+z");
    await expect(toasts(page)).toHaveCount(0);
    await expect(page.locator("main").getByText("example.org", { exact: true })).toHaveCount(0);
    // Redo brings the change back without its old toast.
    await page.keyboard.press("Control+y");
    await expect(page.locator("main").getByText("example.org", { exact: true }).first()).toBeVisible();
    await expect(toasts(page)).toHaveCount(0);
  });

  test("a template's toast goes with Ctrl+Z, and its Undo never takes back a later change", async ({ page }) => {
    const { m } = await signedIn(page);
    await page.goto("/en/app/design");
    const template = () => page.locator("input[name=poster-template]:checked");
    const before = await template().getAttribute("value");
    const pick = before === "daylight" ? "Mono" : "Daylight";
    await page.getByText(pick, { exact: true }).click();
    await expect(toasts(page)).toHaveCount(1);
    await expect(toasts(page)).toContainText(fill(m.app.design.applied, { name: pick }));
    // Undone by the keyboard: its "Undo" would now take back the change before it.
    await page.locator("main").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("Control+z");
    await expect(template()).toHaveAttribute("value", before ?? "");
    await expect(toasts(page)).toHaveCount(0);

    // Applied again, then another change: the template's plain "Undo" would undo that one instead.
    await page.getByText(pick, { exact: true }).click();
    await expect(toasts(page)).toHaveCount(1);
    await page.getByRole("tab", { name: "Buttons" }).click();
    await page.getByText("Outline", { exact: true }).click();
    await expect(toasts(page).filter({ hasText: fill(m.app.design.applied, { name: pick }) })).toHaveCount(0);
  });

  test("Ctrl+Z of a later change leaves a removed block's Undo in place", async ({ page }) => {
    const { m } = await signedIn(page);
    await page.getByRole("link", { name: m.app.nav.page, exact: true }).locator("visible=true").first().click();
    await page.waitForURL("**/en/app/editor");
    let sheet = await openAdd(page, m);
    await paste(sheet, m, "https://example.com/one");
    await expect(sheet).toBeHidden();
    sheet = await openAdd(page, m);
    await paste(sheet, m, "https://example.net/two");
    await expect(sheet).toBeHidden();
    await page.locator("main").click({ position: { x: 1, y: 1 } });
    await expect(page.locator("main").getByText("example.net", { exact: true }).first()).toBeVisible();

    // Delete the first link: "“example.com” deleted · Undo".
    await page.getByRole("button", { name: fill(m.app.editor.more, { title: "example.com" }) }).click();
    await page.getByRole("menuitem", { name: m.app.editor.delete }).click();
    await expect(page.locator("main").getByText("example.com", { exact: true })).toHaveCount(0);
    const removed = toasts(page).filter({ hasText: "example.com" });
    await expect(removed).toHaveCount(1);

    // A later change, undone with Ctrl+Z: the deletion was not undone, so its toast stays.
    const shown = page.getByRole("switch", { name: fill(m.app.editor.visible, { title: "example.net" }) });
    await shown.click();
    await expect(shown).not.toBeChecked();
    await page.locator("main").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("Control+z");
    await expect(shown).toBeChecked();
    await expect(removed).toHaveCount(1);
    await removed.getByRole("button", { name: m.app.undo }).click();
    await expect(page.locator("main").getByText("example.com", { exact: true }).first()).toBeVisible();
  });
});

test.describe("Home", () => {
  test("a designer's Home shows exactly one next step, and says the progress once", async ({ page }) => {
    const { m } = await signedIn(page, "de", "designer");
    const main = page.locator("main");
    await expect(main.getByText(m.app.home.next.eyebrow, { exact: true })).toHaveCount(1);
    await expect(main.getByRole("heading", { level: 2, name: m.app.home.checklist.items.projects.title })).toBeVisible();
    await expect(main.getByText(m.app.home.checklist.items.projects.hint)).toBeVisible();
    // No second next step for the portfolio, and no music copy on a designer's page.
    await expect(main.locator("[data-portfolio-step]")).toHaveCount(0);
    for (const line of Object.values(m.app.portfolio.page)) await expect(main.getByText(line)).toHaveCount(0);
    await expect(main.getByText(m.app.home.checklist.linkHints.music)).toHaveCount(0);
    // The way to reach its owner follows the work.
    await expect(main.getByRole("button", { name: m.app.home.checklist.items.contact.title })).toBeVisible();
    // "1 von 6" once, in the card (the designer's starter look is a step done); no "… Schritten
    // erledigt." under the title.
    await expect(main.getByText(counted(m.app.home.checklist.progress), { exact: true })).toHaveCount(1);
    await expect(main.getByText(counted(m.app.home.leadProgress))).toHaveCount(0);
    expect(await axe(page)).toEqual([]);

    // The one primary action opens the Add sheet, with the project first for this kind of page.
    await main.getByRole("button", { name: m.app.home.next.actions.projects }).click();
    const sheet = page.getByRole("dialog", { name: m.app.add.title });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("[data-type]").first()).toHaveAttribute("data-type", "project");
  });

  test("a page of no particular kind is asked for 3 things in general words", async ({ page }) => {
    const { m } = await signedIn(page);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 2, name: m.app.home.checklist.items.links.title })).toBeVisible();
    await expect(main.getByText(m.app.home.checklist.linkHints.other)).toBeVisible();
    await expect(main.getByText(m.app.home.checklist.linkHints.music)).toHaveCount(0);
    await expect(main.getByText(counted(m.app.home.checklist.progress), { exact: true })).toHaveCount(1);
    await expect(main.getByText(counted(m.app.home.leadProgress))).toHaveCount(0);
  });
});

test("Settings and Invite mark no tab in the phone's tab bar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the tab bar is the phone's");
  const { m } = await signedIn(page, "de");
  const bar = page.locator("[data-tabbar]");
  // Opened from Stats, Settings still is not Stats.
  await bar.getByRole("link", { name: m.app.nav.analytics, exact: true }).click();
  await page.waitForURL("**/de/app/analytics");
  await expect(bar.locator("a[data-selected]")).toHaveText(m.app.nav.analytics);
  for (const path of ["/de/app/settings", "/de/app/settings/account", "/de/app/invite"]) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(bar.locator("a[data-selected]")).toHaveCount(0);
    await expect(bar.locator("a[aria-current]")).toHaveCount(0);
  }
});

test("a page with nothing to tap counts no clicks", async ({ page }) => {
  const { m } = await signedIn(page);
  await page.goto("/en/app/analytics");
  const tile = (label: string) => page.locator("main dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd").first();
  await expect(tile(m.app.analytics.clicks)).toHaveText("0");
  await expect(tile(m.app.analytics.views)).not.toHaveText("0");
  await expect(page.getByText(m.app.analytics.noLinks)).toBeVisible();

  // Something to tap: now there are clicks, and they go to it.
  const sheet = await openAdd(page, m);
  await paste(sheet, m, "https://example.com/press");
  await expect(sheet).toBeHidden();
  await expect(tile(m.app.analytics.clicks)).not.toHaveText("0");
});

test("a short page fills the preview's screen with its own background", async ({ page, isMobile }) => {
  test.skip(isMobile, "the live preview sits beside the dashboard on wide screens");
  await signedIn(page);
  const screen = page.locator("[data-preview-aside] [role=region]");
  await expect(screen).toBeVisible();
  const fit = await screen.evaluate((scroller) => {
    const page = scroller.querySelector<HTMLElement>(".poster-scope");
    if (!page) return null;
    return {
      screen: scroller.clientHeight,
      page: page.getBoundingClientRect().height,
      screenBg: getComputedStyle(scroller).backgroundColor,
      pageBg: getComputedStyle(page).backgroundColor,
    };
  });
  expect(fit).not.toBeNull();
  if (!fit) return;
  expect(fit.page).toBeGreaterThanOrEqual(fit.screen - 1);
  expect(fit.screenBg).toBe(fit.pageBg);
  expect(fit.screenBg).not.toBe("rgba(0, 0, 0, 0)");
});
