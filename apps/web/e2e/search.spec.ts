import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Opens the people search from the header and waits until people are listed. */
async function openSearch(page: Page, name = "Search people") {
  await page.getByRole("button", { name }).click();
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog.getByRole("option").first()).toBeVisible();
  return dialog;
}

test.describe("people search", () => {
  test("opens from the header, finds a person while typing, and Enter opens their page", async ({ page }) => {
    await page.goto("/en");
    const dialog = await openSearch(page);
    const field = dialog.getByRole("combobox");
    await expect(field).toBeFocused();
    // Nothing typed yet: a handful of suggestions, the people from the homepage first.
    await expect(dialog.getByRole("status")).toHaveText("Suggested");
    await expect(dialog.getByRole("option")).toHaveCount(6);
    await expect(dialog.getByRole("option").first()).toContainText("Taylor Swift");
    // Every result says what it is: here an unofficial concept page.
    await expect(dialog.getByRole("option").first()).toContainText("Concept");

    await field.pressSequentially("mes");
    const first = dialog.getByRole("option").first();
    await expect(first).toContainText("Lionel Messi");
    await expect(first).toHaveAttribute("aria-selected", "true");
    // What was typed is marked in the name.
    await expect(first.locator("mark")).toHaveText("Mes");
    await expect(dialog.getByRole("status")).toHaveText(/^\d+ results?$/);

    await field.press("Enter");
    await expect(page).toHaveURL(/\/en\/p\/messi$/);
  });

  test("Ctrl+K opens it from anywhere; Escape closes it and gives the focus back", async ({ page }) => {
    await page.goto("/en/templates");
    const trigger = page.getByRole("button", { name: "Search people" });
    await trigger.focus();
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search people" });
    await expect(dialog.getByRole("combobox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("arrow keys move the choice; a field narrows; typing mistakes and other scripts still find", async ({ page }) => {
    await page.goto("/en");
    const dialog = await openSearch(page);
    const field = dialog.getByRole("combobox");
    const options = dialog.getByRole("option");

    // The arrow keys move the choice, and wrap around at the ends.
    await field.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(field).toHaveAttribute("aria-activedescendant", (await options.nth(1).getAttribute("id")) ?? "");
    await field.press("ArrowUp");
    await field.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");

    // A field narrows the list to the people in it, and the count says how many.
    await dialog.getByRole("button", { name: "Sport" }).click();
    await expect(dialog.getByRole("button", { name: "Sport" })).toHaveAttribute("aria-pressed", "true");
    const sport = await options.count();
    expect(sport).toBeGreaterThan(1);
    await expect(dialog.getByRole("status")).toHaveText(`${sport} results`);
    await expect(field).toBeFocused();
    await dialog.getByRole("button", { name: "All", exact: true }).click();

    // A typing mistake still finds the person.
    await field.fill("ronldo");
    await expect(options.first()).toContainText("Cristiano Ronaldo");
    // So does the name in another script.
    await field.fill("ميسي");
    await expect(options.first()).toContainText("Lionel Messi");
    // And a profession finds the people who have it.
    await field.fill("coach");
    await expect(options.first()).toContainText(/coach/i);

    // Nothing found: a clear way back.
    await field.fill("zzzzqq");
    await expect(options).toHaveCount(0);
    await expect(dialog.getByText("No one found")).toBeVisible();
    await dialog.getByRole("button", { name: "Reset search" }).click();
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
    await expect(dialog.getByRole("status")).toHaveText("Suggested");
  });

  test("what is typed stays in the browser, and nothing comes from third parties", async ({ page, baseURL }) => {
    await page.goto("/en");
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    const dialog = await openSearch(page);
    // The list of people is fetched once, from Linkyo itself.
    expect(requests.filter((url) => new URL(url).pathname === "/api/people/en")).toHaveLength(1);

    const before = requests.length;
    await dialog.getByRole("combobox").pressSequentially("taylor swift");
    await expect(dialog.getByRole("option").first()).toContainText("Taylor Swift");
    await page.waitForLoadState("networkidle");
    // While typing, only pictures of the results load (from our own image route).
    const whileTyping = requests.slice(before).map((url) => new URL(url));
    expect(whileTyping.filter((url) => !url.pathname.startsWith("/_next/")).map(String)).toEqual([]);
    expect(requests.filter((url) => new URL(url).origin !== new URL(baseURL ?? "").origin)).toEqual([]);
    expect(await page.context().cookies()).toEqual([]);
  });

  test("on phones it fills the screen; in Arabic it is mirrored and Cancel closes it", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/ar");
    const dialog = await openSearch(page, "بحث عن أشخاص");
    // Once it has settled, it covers the whole screen.
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box && [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
      })
      .toEqual([0, 0, 390, 844]);
    // Nothing on the page may make it scroll sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    // Right to left: the face sits on the right of the name.
    const row = dialog.getByRole("option").first();
    const face = await row.locator("img").boundingBox();
    const name = await row.locator("bdi").first().boundingBox();
    expect(face && name && face.x > name.x).toBe(true);
    await dialog.getByRole("combobox").fill("صلاح");
    await expect(row).toContainText("محمد صلاح");
    await dialog.getByRole("button", { name: "إلغاء" }).click();
    await expect(dialog).toBeHidden();
    await context.close();
  });

  for (const locale of ["de", "en", "ar"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      test(`axe: the open search, /${locale} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await page.goto(`/${locale}`);
        const name = { de: "Personen suchen", en: "Search people", ar: "بحث عن أشخاص" }[locale];
        const dialog = await openSearch(page, name);
        await dialog.getByRole("combobox").fill(locale === "ar" ? "مو" : "mo");
        await expect(dialog.getByRole("option").first()).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
        expect(summary).toEqual([]);
      });
    }
  }
});
