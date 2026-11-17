import { expect, test } from "@playwright/test";

test.describe("poster creator page", () => {
  test("releases open in place to show where to listen (no JavaScript needed)", async ({ browser }) => {
    // <details> works without JS: prove it by disabling JavaScript entirely.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/en/directions/poster?chrome=0");
    const release = page.locator("details", { hasText: "Lichtfeld" });
    await expect(release.getByRole("link", { name: "Listen on Spotify" })).toBeHidden();
    await release.locator("summary").click();
    await expect(release.getByRole("link", { name: "Listen on Spotify" })).toBeVisible();
    await context.close();
  });

  test("content is grouped in titled sections, products in a two-up grid", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    for (const title of ["Music", "Videos", "Tour 2026/27", "Latest shorts", "Shop", "More from me"]) {
      await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
    }
    const shop = page.getByRole("region", { name: "Shop", exact: true });
    await expect(shop.getByRole("listitem")).toHaveCount(2);
  });

  test("plain links show where they lead", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    await expect(page.getByRole("link", { name: /Book me for your club.*booking@milaaurel\.com/ })).toBeVisible();
  });

  test("light and dark use the same layout", async ({ page }) => {
    const headings = async (mode: "light" | "dark") => {
      await page.goto(`/en/directions/poster?chrome=0&mode=${mode}`);
      return page.getByRole("heading").allInnerTexts();
    };
    expect(await headings("light")).toEqual(await headings("dark"));
  });
});

test.describe("poster dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/directions/poster/dashboard?chrome=0");
    await page.waitForLoadState("load");
  });

  test("adding a section shows a new titled section in the preview, ready to rename", async ({ page }) => {
    const preview = page.getByRole("complementary", { name: "Live preview" });
    await page.getByRole("button", { name: "Add section" }).click();
    await expect(preview.getByRole("heading", { level: 2, name: "New section" })).toBeVisible();
    const title = page.getByRole("textbox", { name: "Section title: New section" });
    await expect(title).toBeFocused();
    await title.fill("Merch drops");
    await title.press("Enter");
    await expect(preview.getByRole("heading", { level: 2, name: "Merch drops" })).toBeVisible();
  });

  test("the page mode switch flips the preview between light and dark", async ({ page }) => {
    const preview = page.getByRole("complementary", { name: "Live preview" });
    const background = () => preview.locator("[lang]").first().evaluate((node) => getComputedStyle(node).backgroundColor);
    const before = await background();
    const target = (await page.getByRole("radio", { name: "Light" }).getAttribute("data-state")) === "on" ? "Dark" : "Light";
    await page.getByRole("radio", { name: target }).click();
    await expect.poll(background).not.toBe(before);
  });
});
