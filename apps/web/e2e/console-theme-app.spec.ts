import { tokens } from "@linkyo/tokens";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * The creator dashboard is black and grey (ADR 0062): data-console="frame" on the shell gives the
 * window the console palette, so its sheets, dialogs, menus and toasts (rendered in <body>) follow.
 * Everything else (website, sign-up, log-in, creator pages, the team area) keeps Linkyo Teal.
 * Expected values come from the tokens (tokens.semantic.*.console), never from literal colours.
 */

const s = tokens.semantic;
/** Linkyo Teal, the brand anchor outside the dashboard. */
const TEAL = s.primary.light.toLowerCase();
const consoleLight = s.primary.console.light.toLowerCase();
const consoleDark = s.primary.console.dark.toLowerCase();

/** "#1C1C1F" → "rgb(28, 28, 31)", as getComputedStyle reports it. */
const rgb = (hex: string) => {
  const n = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return `rgb(${n(1)}, ${n(3)}, ${n(5)})`;
};

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

const SKIP = { de: "Später", en: "Skip for now", ar: "لاحقًا" } as const;
/** The demo team code (as in admin.spec.ts): whoever enters it first owns the team area. */
const TEAM_CODE = "linkyo-team-4827";

/** Sign up in demo mode (as in app.spec.ts); ends on the welcome flow. */
async function signUp(page: Page, locale: keyof typeof SKIP = "en") {
  const name = `mono-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  return name;
}

/** Sign up and skip the welcome flow. */
async function signedIn(page: Page, locale: keyof typeof SKIP = "en") {
  const name = await signUp(page, locale);
  await page.getByRole("button", { name: SKIP[locale] }).click();
  await page.waitForURL(`**/${locale}/app`);
  return name;
}

const addButton = (page: Page) => page.getByRole("button", { name: "Add", exact: true }).first();

/** A custom property as the element computes it ("#1c1c1f"). */
const cssVar = (target: Locator, name: string) => target.evaluate((element, property) => getComputedStyle(element).getPropertyValue(property).trim().toLowerCase(), name);
const rootVar = (page: Page, name: string) => cssVar(page.locator("html"), name);

/** A filled primary button in the dashboard's content. */
const primaryButton = (page: Page) => page.locator("#main").locator("button.bg-primary, a.bg-primary").first();

/** Adds a link from the Add sheet (as in app.spec.ts) and returns its visibility switch. */
async function addLink(page: Page, title: string) {
  await page.goto("/en/app/editor");
  await addButton(page).click();
  await page.getByRole("dialog", { name: "Add to your page" }).getByRole("button", { name: /^Link Any website/ }).click();
  const edit = page.getByRole("dialog", { name: "Add Link" });
  await edit.getByLabel("Title", { exact: true }).fill(title);
  await edit.getByLabel("Link", { exact: true }).fill("https://example.com/booking");
  await edit.getByRole("button", { name: "Add to page" }).click();
  await expect(edit).toBeHidden();
  return page.getByRole("switch", { name: `Show ${title} on your page` });
}

test.describe("black-and-grey dashboard (ADR 0062)", () => {
  test("the dashboard and everything it opens are black and grey", async ({ page }) => {
    await signUp(page);
    // The welcome flow is part of the dashboard.
    await expect.poll(() => rootVar(page, "--color-primary")).toBe(consoleLight);
    await page.getByRole("button", { name: SKIP.en }).click();
    await page.waitForURL("**/en/app");

    await expect.poll(() => rootVar(page, "--color-primary")).toBe(consoleLight);
    await expect.poll(() => rootVar(page, "--color-canvas-muted")).toBe(s.canvasMuted.console.light.toLowerCase());
    await expect(primaryButton(page)).toHaveCSS("background-color", rgb(s.primary.console.light));
    await expect(primaryButton(page)).toHaveCSS("color", rgb(s.primaryFg.console.light));

    // The Add sheet renders in <body>, outside the shell: it inherits the palette from :root.
    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add to your page" });
    await expect(sheet).toBeVisible();
    expect(await sheet.evaluate((element) => element.closest("[data-console]"))).toBeNull();
    expect(await cssVar(sheet, "--color-primary")).toBe(consoleLight);
    expect(await cssVar(sheet, "--color-tinted")).toBe(s.tinted.console.light.toLowerCase());
  });

  test.describe("in dark mode", () => {
    test.use({ colorScheme: "dark" });

    test("dark mode: white primary, black label, black knob on an on switch", async ({ page }) => {
      await signedIn(page);
      await expect.poll(() => rootVar(page, "--color-primary")).toBe(consoleDark);
      await expect(primaryButton(page)).toHaveCSS("background-color", rgb(s.primary.console.dark));
      await expect(primaryButton(page)).toHaveCSS("color", rgb(s.primaryFg.console.dark));

      const visible = await addLink(page, "Book me");
      await expect(visible).toHaveAttribute("aria-checked", "true");
      await expect(visible).toHaveCSS("background-color", rgb(s.primary.console.dark));
      // The thumb takes primary-fg when on: ink on the white track.
      await expect(visible.locator("span")).toHaveCSS("background-color", rgb(s.primaryFg.console.dark));

      await addButton(page).click();
      const sheet = page.getByRole("dialog", { name: "Add to your page" });
      await expect(sheet).toBeVisible();
      expect(await cssVar(sheet, "--color-primary")).toBe(consoleDark);
    });

    test("the user's own choice wins over the system's dark mode", async ({ page }) => {
      await signedIn(page, "de");
      await expect.poll(() => rootVar(page, "--color-primary")).toBe(consoleDark);
      await page.goto("/de/app/settings");
      await page.getByRole("radio", { name: "Hell", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expect.poll(() => rootVar(page, "--color-primary")).toBe(consoleLight);
      await expect.poll(() => rootVar(page, "--color-canvas-muted")).toBe(s.canvasMuted.console.light.toLowerCase());
    });
  });

  test("the page preview keeps the creator's colours", async ({ page, isMobile }) => {
    test.skip(isMobile, "the preview column shows from the desk breakpoint");
    await page.setViewportSize({ width: 1280, height: 800 });
    await signedIn(page);
    await page.goto("/en/app/editor");
    const inPreview = page.getByRole("complementary", { name: "Live preview" }).locator(".poster-scope");
    await expect(inPreview).toHaveCount(1);
    await expect.poll(() => rootVar(page, "--color-primary")).toBe(consoleLight);
    const accent = await cssVar(inPreview, "--creator-accent");
    const background = await inPreview.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(accent).not.toBe("");

    // The full page, as visitors see it: same colours; teal around it, grey only on the owner's bar.
    await page.goto("/en/app/preview");
    const full = page.locator(".poster-scope").first();
    await expect(full).toBeVisible();
    expect(await cssVar(full, "--creator-accent")).toBe(accent);
    expect(await full.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(background);
    await expect.poll(() => rootVar(page, "--color-primary")).toBe(TEAL);
    const bar = page.locator('nav[data-console="local"]');
    expect(await cssVar(bar, "--color-primary")).toBe(consoleLight);
    await expect(bar.getByRole("link", { name: "Edit" })).toHaveCSS("background-color", rgb(s.primary.console.light));
  });

  test("leaving the dashboard brings the teal back", async ({ page }) => {
    expect(TEAL).toBe("#00454c");
    await signedIn(page);
    await expect.poll(() => rootVar(page, "--color-primary")).toBe(consoleLight);

    // The team area keeps Linkyo Teal.
    await page.goto("/en/admin");
    await page.locator("#team-code").fill(TEAM_CODE);
    await page.locator("form button[type=submit]").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hi");
    await expect.poll(() => rootVar(page, "--color-primary")).toBe(TEAL);
    expect(await page.locator("[data-console]").count()).toBe(0);

    await page.goto("/en/app/settings");
    await page.getByRole("button", { name: "Log out" }).last().click();
    await page.waitForURL("**/en/login?next=*");
    await expect.poll(() => rootVar(page, "--color-primary")).toBe(TEAL);
    await expect.poll(() => rootVar(page, "--color-canvas-muted")).toBe(s.canvasMuted.light.toLowerCase());

    for (const path of ["/en", "/en/signup"]) {
      await page.goto(path);
      await expect.poll(() => rootVar(page, "--color-primary"), path).toBe(TEAL);
      expect(await page.locator("[data-console]").count(), path).toBe(0);
    }
  });

  test("the splash is already grey: the server HTML carries the frame marker", async ({ request }) => {
    const response = await request.get("/en/app");
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain('data-console="frame"');
  });
});
