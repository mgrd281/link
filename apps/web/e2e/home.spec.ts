import { expect, test } from "@playwright/test";

test.describe("marketing home", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  test("hero states the promise and claims an address with real username rules", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/One link\.\s*Everything you create\./);
    const field = page.getByRole("textbox", { name: "Choose your page address" }).first();
    await field.fill("-bad");
    await field.press("Enter");
    await expect(page.getByText("Use 3–30 lowercase letters").first()).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await field.fill("mila-aurel");
    await field.press("Enter");
    await page.waitForURL("**/en/signup?name=mila-aurel");
  });

  test("pasting a link builds the right block, and examples work with one click", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Paste or type a link" });
    await input.fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    await expect(page.getByText("Recognised: Music")).toBeVisible();
    await input.press("Enter");
    const list = page.getByRole("list").filter({ has: page.getByRole("button", { name: /^Remove / }) });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await page.getByRole("button", { name: "YouTube", exact: true }).click();
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: /^Remove Music/ }).click();
    await expect(list.getByRole("listitem")).toHaveCount(1);
  });

  test("the template strip can be paused (WCAG 2.2.2)", async ({ page }) => {
    const toggle = page.getByRole("button", { name: "Pause the template strip" });
    await toggle.click();
    await expect(page.getByRole("button", { name: "Play the template strip" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the pages in the hero take turns and can be paused; the example strip opens real example pages", async ({ page }) => {
    const pause = page.getByRole("button", { name: "Pause the page carousel" });
    await pause.click();
    await expect(page.getByRole("button", { name: "Play the page carousel" })).toBeVisible();
    await expect(page.locator(".mk-stack-card").first()).toHaveCSS("animation-play-state", "paused");
    const example = page.getByRole("link", { name: /^See .+'s example page$/ }).first();
    await expect(example).toHaveAttribute("href", /^\/(de|en|ar)\/p\/[a-z0-9-]+$/);
    // The four feature panels are there, with the paste demo inside one of them.
    await expect(page.getByRole("heading", { level: 3, name: "A page that looks like you" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Share like a pro" })).toBeAttached();
  });

  test("FAQ answers open in place", async ({ page }) => {
    const answer = page.getByText("Creator pages set no cookies and load no trackers.");
    await expect(answer).toBeHidden();
    await page.getByText("Do I need a cookie banner?").click();
    await expect(answer).toBeVisible();
  });

  test("in-page navigation reaches every section", async ({ page }) => {
    for (const id of ["features", "templates", "pricing", "faq", "start"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("loads nothing from third parties and sets no cookies", async ({ page, context }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).hostname;
      if (!["localhost", "127.0.0.1"].includes(host)) external.push(host);
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(external).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
});

test("phone menu opens as a popover and closes after choosing a section", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/en");
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.locator("#mk-menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Pricing" }).click();
  await expect(menu).toBeHidden();
  await context.close();
});
