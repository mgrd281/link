import de from "../src/messages/de.json" with { type: "json" };

import { createRealAccount, expect, realEnabled, seedPage, setAiEnabled, signIn, test, uniqueName } from "./real";

/**
 * The team's AI switch (`ai_settings.enabled`) is global: these tests change it, so they run alone
 * (`--grep @global --workers=1`, desktop) and switch it back on afterwards.
 */

/** A fresh account: not through the welcome yet (`onboarded` false), or with an empty page. */
async function fresh(prefix: string, onboarded: boolean) {
  const { username, email } = uniqueName(prefix);
  return createRealAccount({ email, username, locale: "de", onboarded, page: seedPage(username, "de") });
}

test.describe("the AI switch @real @global", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack and AI_ENABLED=1 (E2E_SUPABASE=1).");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test.beforeAll(async () => {
    await setAiEnabled(true);
  });

  test.afterAll(async () => {
    await setAiEnabled(true);
  });

  test("on: the welcome offers the AI first and Home suggests it @real @global", async ({ page }) => {
    const newcomer = await fresh("ai-on-welcome", false);
    await signIn(page, newcomer.email, "/de/app/welcome");
    await page.waitForURL("**/de/app/welcome");
    await expect(page.getByRole("heading", { name: de.app.welcome.start.title })).toBeVisible({ timeout: 20_000 });

    const owner = await fresh("ai-on-home", true);
    await page.context().clearCookies();
    await signIn(page, owner.email, "/de/app");
    await page.waitForURL(/\/de\/app$/);
    await expect(page.getByRole("heading", { name: de.app.home.ai.title })).toBeVisible({ timeout: 20_000 });
  });

  test("off: no step 0, no AI card on Home, and the build screen says the AI is off @real @global", async ({ page }) => {
    await setAiEnabled(false);
    const newcomer = await fresh("ai-off-welcome", false);
    await signIn(page, newcomer.email, "/de/app/welcome");
    await page.waitForURL("**/de/app/welcome");
    // The five steps, from the first: what the page is for.
    await expect(page.getByRole("heading", { name: de.app.welcome.steps.kind.title })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(de.app.welcome.start.title)).toHaveCount(0);

    const owner = await fresh("ai-off-home", true);
    await page.context().clearCookies();
    await signIn(page, owner.email, "/de/app");
    await page.waitForURL(/\/de\/app$/);
    // Home is there (its next step), without the AI card.
    await expect(page.locator("#home-next")).toHaveText(de.app.home.next.eyebrow, { timeout: 20_000 });
    await expect(page.getByText(de.app.home.ai.title)).toHaveCount(0);
    await page.goto("/de/app/editor");
    await expect(page.getByRole("link", { name: de.app.editor.withAi })).toHaveCount(0);

    await page.goto("/de/app/build");
    await expect(page.getByText(de.app.ai.unavailable)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: de.app.ai.continueWithout })).toBeVisible();
    await expect(page.getByRole("button", { name: de.app.ai.start })).toHaveCount(0);
  });
});
