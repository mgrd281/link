import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * Regression tests for fixes in the dashboard's sheets, dialogs, toasts and live preview, and in the
 * team area's creator editor. Demo mode: everything lives in this browser's storage. Runs on desktop
 * and on a phone; a few checks only apply to one of them.
 */

const TEAM_CODE = "linkyo-team-4827";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signUp(page: Page, locale = "en") {
  const name = `mila-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  return { name, email: `${name}@example.com` };
}

/** Sign up and skip the welcome flow (for tests about the dashboard itself). */
async function signedIn(page: Page, locale = "en") {
  const account = await signUp(page, locale);
  await page.getByRole("button", { name: locale === "ar" ? "لاحقًا" : "Skip for now" }).click();
  await page.waitForURL(`**/${locale}/app`);
  return account;
}

const addButton = (page: Page) => page.getByRole("button", { name: "Add", exact: true }).first();

/** The visible link to a place: the sidebar on wide screens, the tab bar on phones. */
const place = (page: Page, name: string) => page.getByRole("link", { name, exact: true }).locator("visible=true").first();

/** Opens the Add sheet's form for a link and types into it, so leaving it asks first. */
async function dirtyLinkForm(page: Page) {
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add to your page" });
  await sheet.locator('[data-type="link"]').click();
  const form = page.getByRole("dialog", { name: "Add Link" });
  const field = form.getByRole("textbox").first();
  await field.fill("Notes for later");
  return { form, field };
}

test.describe("dashboard fixes", () => {
  test("a double-click on a toast's Undo undoes once, not also the change before", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/app/design");
    // A change of its own first: the button style.
    await page.getByRole("tab", { name: "Buttons" }).click();
    await page.getByText("Outline", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Outline" })).toBeChecked();
    const before = await page.locator("input[name=poster-template]:checked").getAttribute("value");
    // Then a template (it starts from the template's own look) with "Undo" in its toast.
    await page.getByText("Daylight", { exact: true }).click();
    const toast = page.getByRole("region", { name: /^Notifications/ }).getByRole("listitem").filter({ hasText: "Daylight applied" });
    const undo = toast.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    // Both clicks land where Undo was: the second one finds the toast fading and passes through it.
    // The screen under the toast takes no clicks here, so whatever happens to lie there stays as it is.
    await page.addStyleTag({ content: "#main { pointer-events: none; }" });
    await undo.dblclick();
    await page.addStyleTag({ content: "#main { pointer-events: auto; }" });
    await expect(page.locator("input[name=poster-template]:checked")).toHaveAttribute("value", before ?? "");
    await page.getByRole("tab", { name: "Buttons" }).click();
    await expect(page.getByRole("radio", { name: "Outline" })).toBeChecked();
  });

  test("Back while the Add sheet asks to discard closes the question with the sheet", async ({ page }) => {
    await signedIn(page);
    // Into the editor from inside the app, so Back has somewhere to go.
    await place(page, "Page").click();
    await page.waitForURL("**/en/app/editor");
    await dirtyLinkForm(page);
    await page.keyboard.press("Escape");
    const question = page.getByRole("alertdialog", { name: "Discard your changes?" });
    await expect(question).toBeVisible();
    await page.goBack();
    await page.waitForURL(/\/en\/app$/);
    await expect(question).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a confirm dialog gives focus back to what opened it", async ({ page }) => {
    await signedIn(page);
    // A button in a settings pane.
    await page.goto("/en/app/settings/account");
    const remove = page.getByRole("button", { name: "Delete account" });
    await remove.focus();
    await page.keyboard.press("Enter");
    const confirm = page.getByRole("alertdialog", { name: "Delete your account?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);
    await expect(remove).toBeFocused();

    // A field in a sheet that asks before discarding: "Keep editing" goes back into it.
    await page.goto("/en/app/editor");
    const { form, field } = await dirtyLinkForm(page);
    await field.focus();
    await page.keyboard.press("Escape");
    const question = page.getByRole("alertdialog", { name: "Discard your changes?" });
    await expect(question).toBeVisible();
    await question.getByRole("button", { name: "Keep editing" }).click();
    await expect(question).toHaveCount(0);
    await expect(form).toBeVisible();
    await expect(field).toBeFocused();
  });

  test("the preview's hint names “Open” only where an Open link sits beside it", async ({ page, isMobile }) => {
    await signedIn(page);
    await page.goto("/en/app/editor");
    if (!isMobile) {
      // The column beside the screen has "Open"; its frame says so.
      const aside = page.getByRole("complementary", { name: "Live preview" });
      await expect(aside.getByRole("link", { name: "Open" })).toBeVisible();
      await expect(aside.getByRole("region", { name: /^Live preview: / })).toHaveAccessibleDescription(/“Open” shows the full page/);
      return;
    }
    // Phones: the preview opens full screen from a sheet, with Close only, so there is no hint about "Open".
    await addButton(page).click();
    await page.getByRole("dialog", { name: "Add to your page" }).locator('[data-type="link"]').click();
    await page.getByRole("dialog", { name: "Add Link" }).getByRole("button", { name: "Preview" }).click();
    const full = page.getByRole("dialog", { name: "Live preview" });
    await expect(full.getByRole("button", { name: "Close preview" })).toBeVisible();
    const region = full.getByRole("region", { name: /^Live preview: / });
    await expect(region).toBeVisible();
    await expect(region).toHaveAccessibleDescription("");
  });

  test("on a short phone screen the Design preview sticks to the top once the bar has scrolled away", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phones in landscape");
    await signedIn(page);
    await page.setViewportSize({ width: 852, height: 393 });
    await page.goto("/en/app/design");
    const preview = page.locator("[data-sticky-preview]");
    await expect(preview).toBeVisible();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    // Flush with the top edge: no band above it for the screen to show through.
    await expect.poll(() => preview.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
  });
});

test.describe("team area fixes", () => {
  /** Signs up and opens the team area with the team code: the account becomes the owner. */
  async function owner(page: Page) {
    await signUp(page);
    await page.goto("/en/admin");
    await page.locator("#team-code").fill(TEAM_CODE);
    await page.locator("form button[type=submit]").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hi");
  }

  /** Opens Nizar's page as a draft and a block of it in the edit sheet. */
  async function editNizarBlock(page: Page) {
    await page.getByRole("navigation", { name: "Team area" }).locator("visible=true").getByRole("link", { name: "Creators" }).click();
    await page.getByRole("link", { name: /Nizar/ }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("radio", { name: "Page" })).toBeVisible();
    await page.getByRole("button", { name: /^Edit .+ \(.+\)$/ }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    return sheet;
  }

  test("a block's sheet leaves the page preview beside it in view", async ({ page, isMobile }) => {
    test.skip(isMobile, "the preview column shows from 1280 px");
    await owner(page);
    const sheet = await editNizarBlock(page);
    // The sheet is modal: the rest of the page is hidden from the accessibility tree, so find the column by its marker.
    const aside = page.locator("[data-plain-preview-aside]");
    await expect(aside).toBeVisible();
    // Wait for the side panel to come to rest before measuring it.
    await expect.poll(() => sheet.evaluate((element) => element.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
    const column = await aside.boundingBox();
    const panel = await sheet.boundingBox();
    if (!column || !panel) throw new Error("no preview or sheet");
    expect(panel.x + panel.width).toBeLessThanOrEqual(column.x + 1);
    // The scrim (portaled right before the panel) stops there too: the preview is not dimmed.
    const scrimEnd = await sheet.evaluate((element) => {
      const scrim = element.previousElementSibling;
      return scrim && getComputedStyle(scrim).position === "fixed" ? scrim.getBoundingClientRect().right : null;
    });
    expect(scrimEnd ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(column.x + 1);
  });

  test("below 1280 px, where the team area shows no preview column, the sheet offers the preview", async ({ page, isMobile }) => {
    test.skip(isMobile, "a laptop width between the desk and xl breakpoints");
    await page.setViewportSize({ width: 1240, height: 800 });
    await owner(page);
    const sheet = await editNizarBlock(page);
    await expect(page.locator("[data-plain-preview-aside]")).toBeHidden();
    await sheet.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("dialog", { name: "Live preview" })).toBeVisible();
  });
});
