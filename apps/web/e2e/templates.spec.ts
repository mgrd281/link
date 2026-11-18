import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** The template gallery (/templates) and its example pages. */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("template gallery", () => {
  test("shows about forty examples, filters by category and is accessible", async ({ page }) => {
    await page.goto("/en/templates");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("40 examples");
    const cards = page.getByRole("button", { name: /^Preview: / });
    expect(await cards.count()).toBeGreaterThanOrEqual(40);
    await page.getByRole("button", { name: /^Local businesses/ }).click();
    await expect(page.getByRole("button", { name: /^Local businesses/ })).toHaveAttribute("aria-pressed", "true");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeLessThan(20);
    await expect(page.getByRole("button", { name: "Preview: Bäckerei Sonnenkorn" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("preview a page, then start with exactly that template", async ({ page }) => {
    await page.goto("/en/templates");
    await page.getByRole("button", { name: "Preview: Bäckerei Sonnenkorn" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('iframe[title="Example page Bäckerei Sonnenkorn"]')).toHaveAttribute("src", "/de/p/baeckerei-sonnenkorn");
    const use = dialog.getByRole("link", { name: "Use this template" });
    await expect(use).toHaveAttribute("href", "/en/signup?kind=shop&look=baeckerei-sonnenkorn");
    await use.click();
    await page.waitForURL("**/en/signup?kind=shop&look=baeckerei-sonnenkorn");
    await page.waitForLoadState("networkidle");
    const name = `bake-${Date.now().toString(36)}`;
    await page.locator("#signup-username").fill(name);
    await page.locator("#signup-email").fill(`${name}@example.com`);
    await page.locator("#signup-password").fill("night-shift-42");
    await page.locator("form button[type=submit]").click();
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
});
