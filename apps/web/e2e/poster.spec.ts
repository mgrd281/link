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
    for (const title of ["Shows & tickets", "Music", "Mixes", "Videos", "Latest shorts", "Shop", "Partners", "Booking & more"]) {
      await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
    }
    const shop = page.getByRole("region", { name: "Shop", exact: true });
    await expect(shop.getByRole("listitem")).toHaveCount(2);
  });

  test("plain links show where they lead", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    await expect(page.getByRole("link", { name: /Book me for your club.*booking@milaaurel\.com/ })).toBeVisible();
  });

  test("every template renders the same content structure", async ({ page }) => {
    const headings = async (template: string) => {
      await page.goto(`/en/directions/poster?chrome=0&template=${template}`);
      return page.getByRole("heading", { level: 2 }).allInnerTexts();
    };
    const reference = await headings("nocturne");
    for (const template of ["daylight", "marquee", "pulse", "atelier"]) {
      expect((await headings(template)).map((text) => text.toLowerCase())).toEqual(reference.map((text) => text.toLowerCase()));
    }
  });

  test("Marquee shows the logo as the page heading", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0&template=marquee");
    await expect(page.getByRole("heading", { level: 1, name: "Mila Aurel" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).getByRole("img")).toBeVisible();
  });

  test("month tabs filter the dates and follow the keyboard", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    const shows = page.getByRole("region", { name: "Shows & tickets", exact: true });
    const tabs = shows.getByRole("tab");
    const rows = shows.getByRole("tabpanel").getByRole("listitem");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(rows).toHaveCount(6);
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(rows).toHaveCount(1);
    await page.keyboard.press("End");
    await expect(rows).toHaveCount(1);
    await page.keyboard.press("Home");
    await expect(rows).toHaveCount(6);
  });

  test("a long run of mixes becomes a two-row rail; ads are labelled", async ({ page }) => {
    await page.goto("/en/directions/poster?chrome=0");
    const rail = page.getByRole("region", { name: "Mixes, scrollable row" });
    await expect(rail.getByRole("listitem")).toHaveCount(4);
    await expect(page.getByRole("link", { name: /The headphones I mix on.*Ad/ })).toBeVisible();
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

  test("picking a template restyles the live preview in one click", async ({ page }) => {
    const preview = page.getByRole("complementary", { name: "Live preview" });
    const background = () => preview.locator("[lang]").first().evaluate((node) => getComputedStyle(node).backgroundColor);
    const before = await background();
    const pulse = page.getByRole("radio", { name: /^Pulse/ });
    await page.getByText("Pulse", { exact: true }).click();
    await expect(pulse).toBeChecked();
    await expect(pulse).toBeFocused();
    await expect.poll(background).not.toBe(before);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: /^Atelier/ })).toBeChecked();
  });
});
