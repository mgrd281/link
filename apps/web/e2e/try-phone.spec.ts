import { expect, test } from "@playwright/test";

/** The playground on a phone: the stage, the controls and "Keep this page" on one screen, as in an app. */

test("on a phone the playground fits one screen under the header, with its button in view", async ({ page }) => {
  await page.goto("/en");
  const playground = page.locator("#try");
  const card = playground.getByRole("tablist").locator("xpath=../..");
  // The card's top just under the sticky header (64 px).
  await card.evaluate((element) => {
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 64, behavior: "instant" });
  });
  const box = await card.boundingBox();
  const screen = await page.evaluate(() => window.innerHeight);
  expect(box).not.toBeNull();
  expect((box?.height ?? Infinity) <= screen - 64).toBe(true);
  await expect(playground.getByRole("link", { name: "Keep this page" })).toBeInViewport();
  await expect(playground.getByRole("tab", { name: "Profile" })).toBeInViewport();
  // Nothing is wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("the demo's own button stops it where it is, and it does not start again by itself", async ({ page }) => {
  await page.goto("/en");
  const playground = page.locator("#try");
  await playground.getByRole("button", { name: "Watch", exact: true }).click();
  await expect(playground.getByLabel("Your name")).toHaveValue(/^Lou/, { timeout: 8_000 });
  await playground.getByRole("button", { name: "Stop demo" }).click();
  await expect(playground.getByRole("button", { name: "Watch again" })).toBeVisible();
  const value = await playground.getByLabel("Your name").inputValue();
  await page.waitForTimeout(1500);
  await expect(playground.getByLabel("Your name")).toHaveValue(value);
  await expect(playground.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
});
