import { expect, test } from "@playwright/test";

import { DIRECTIONS } from "./routes";

for (const direction of DIRECTIONS) {
  test.describe(`${direction} dashboard`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/en/directions/${direction}/dashboard?chrome=0`);
      await page.waitForLoadState("load");
    });

    test("one paste adds the right block (smart detect) and the preview updates", async ({ page }) => {
      const preview = page.getByRole("complementary", { name: "Live preview" });
      const input = page.getByRole("textbox", { name: "Add anything" });
      await page.keyboard.press("n");
      await expect(input).toBeFocused();
      await input.fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
      await expect(page.getByText("Detected: Music")).toBeVisible();
      await input.press("Enter");
      await expect(page.getByText("Music added. Fetching details…").first()).toBeVisible();
      await expect(preview.getByText("Music", { exact: true }).first()).toBeVisible();
    });

    test("delete is undoable from the toast", async ({ page }) => {
      const before = await page.getByRole("listitem").count();
      if (direction === "mosaic") {
        await page.getByRole("button", { name: /Book me for your club/ }).click();
        await page.getByRole("button", { name: "Delete" }).click();
      } else {
        await page.getByRole("button", { name: "More actions for Book me for your club" }).click();
        await page.getByRole("menuitem", { name: "Delete" }).click();
      }
      await expect(page.getByText("“Book me for your club” deleted.").first()).toBeVisible();
      await page.getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => page.getByRole("listitem").count()).toBe(before);
    });

    test("⌘K opens the command palette", async ({ page }) => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByPlaceholder("Type a command or search…").fill("ocean");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeHidden();
    });
  });
}

test("visibility toggle hides the block in the live preview", async ({ page }) => {
  await page.goto("/en/directions/gallery/dashboard?chrome=0");
  const preview = page.getByRole("complementary", { name: "Live preview" });
  await expect(preview.getByText("Book me for your club")).toBeVisible();
  await page.getByRole("switch", { name: "Show Book me for your club on your page" }).click();
  await expect(preview.getByText("Book me for your club")).toBeHidden();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(preview.getByText("Book me for your club")).toBeVisible();
});

test("keyboard reorder with ⌥↓ moves a block", async ({ page }) => {
  await page.goto("/en/directions/stage/dashboard?chrome=0");
  const handle = page.getByRole("button", { name: "Reorder Book me for your club" });
  await handle.focus();
  await page.keyboard.press("Alt+ArrowDown");
  const titles = await page.locator("main li").allInnerTexts();
  expect(titles.findIndex((t) => t.includes("Book me for your club"))).toBe(4);
});

test("creator pages make no third-party requests and set no cookies", async ({ page, context }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) external.push(url.hostname);
  });
  for (const direction of DIRECTIONS) {
    await page.goto(`/en/directions/${direction}?chrome=0`);
    await page.waitForLoadState("networkidle");
  }
  expect(external).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});
