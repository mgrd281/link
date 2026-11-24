import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * The Portfolio section of the website (plan §4.1 a): the /portfolio page in three languages, its
 * tabs, its links into sign-up with a template, its link preview, the homepage band, and the header
 * for a visitor who is signed in. Runs on the laptop and the phone project.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Contrast is measured at rest: nothing caught halfway through an entrance. Scroll-driven reveals
 * run as long as the page can scroll, so only time-based animations are waited for.
 */
const settle = (page: Page) =>
  page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => !(a.timeline instanceof DocumentTimeline) || a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );

const HEADINGS = { de: "Deine Arbeit zuerst.", en: "Your work comes first.", ar: "أعمالك أولًا." } as const;

for (const locale of ["de", "en", "ar"] as const) {
  test(`/${locale}/portfolio: 200, its own heading, mirrored in Arabic, accessible, nothing wider than the screen`, async ({ page }) => {
    const response = await page.goto(`/${locale}/portfolio`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(HEADINGS[locale]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/portfolio$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await settle(page);
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}

test("the opening shows Ronja's real page; every template starts sign-up with its look", async ({ page }) => {
  await page.goto("/de/portfolio");
  await expect(page.getByRole("link", { name: "Die Seite von Ronja Feldkamp auf einem Laptop und einem Handy" })).toHaveAttribute("href", "/de/p/ronja-feldkamp");
  await expect(page.getByRole("link", { name: "Portfolio kostenlos anlegen" })).toHaveAttribute("href", "/de/signup");
  // The example is named as made up, in the template it uses.
  await expect(page.getByText("Ronja Feldkamp ist erfunden: eine Beispielseite in der Vorlage Werkbogen.")).toBeVisible();
  // The templates come from the portfolio pages: Werkbogen and Tiefdruck first.
  const row = page.getByRole("region", { name: "Vorlagen für Portfolios" });
  await expect(row.getByRole("heading", { level: 3 })).toHaveText(["Werkbogen", "Tiefdruck", "Folio"]);
  await expect(row.getByRole("link", { name: "Mit Werkbogen starten" })).toHaveAttribute("href", "/de/signup?kind=photographer&look=ronja-feldkamp");
  await expect(row.getByRole("link", { name: "Mit Tiefdruck starten" })).toHaveAttribute("href", "/de/signup?kind=developer&look=tobin-achterberg");
  // The field's tab offers the same start.
  await expect(page.getByRole("tabpanel").getByRole("link", { name: "Mit Werkbogen starten" })).toHaveAttribute("href", "/de/signup?kind=photographer&look=ronja-feldkamp");
  // "Start with this template" really starts with it: the sign-up form keeps the look.
  await row.getByRole("link", { name: "Mit Werkbogen starten" }).click();
  await page.waitForURL("**/de/signup?kind=photographer&look=ronja-feldkamp");
  await page.goto("/de/portfolio");
  await expect(page.getByRole("link", { name: "Alle Portfolio-Beispiele in der Galerie" })).toHaveAttribute("href", "/de/templates?category=portfolio#gallery");
  // A project page, pictured, and its address.
  await expect(page.getByRole("link", { name: "Projektseite „Hafenlicht“ öffnen" })).toHaveAttribute("href", "/de/p/ronja-feldkamp/hafenlicht");
});

test("the fields are tabs; the arrow keys follow the reading direction", async ({ page }) => {
  await page.goto("/de/portfolio");
  const tabs = page.getByRole("tablist", { name: "Fach wählen" }).getByRole("tab");
  await expect(tabs).toHaveText(["Fotografie", "Design & Architektur", "Entwicklung & Handwerk"]);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("link", { name: "Seite von Ronja Feldkamp ansehen" })).toHaveAttribute("href", "/de/p/ronja-feldkamp");
  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").getByRole("link", { name: "Seite von Tobin Achterberg ansehen" })).toHaveAttribute("href", "/en/p/tobin-achterberg");
  await tabs.nth(2).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(1)).toBeFocused();

  // Arabic: the next tab sits to the left.
  await page.goto("/ar/portfolio");
  const arTabs = page.getByRole("tablist").getByRole("tab");
  await arTabs.first().focus();
  await page.keyboard.press("ArrowLeft");
  await expect(arTabs.nth(1)).toBeFocused();
});

test("its link preview is its own card, in each language", async ({ page, request }) => {
  for (const locale of ["de", "ar"] as const) {
    await page.goto(`/${locale}/portfolio`);
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toContain(`/${locale}/portfolio/opengraph-image`);
    const response = await request.get(new URL(image ?? "").pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test("search engines find it in every language; it loads nothing from third parties and sets no cookie", async ({ page, request, context }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const locale of ["de", "en", "ar"]) expect(sitemap).toContain(`/${locale}/portfolio</loc>`);
  const external: string[] = [];
  page.on("request", (sent) => {
    const host = new URL(sent.url()).hostname;
    if (!["localhost", "127.0.0.1"].includes(host)) external.push(host);
  });
  await page.goto("/de/portfolio");
  await page.waitForLoadState("networkidle");
  expect(external).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

test("the homepage band shows two portfolio pages and leads to the Portfolio page", async ({ page }) => {
  await page.goto("/de");
  const band = page.locator("#portfolio-band");
  await expect(band.getByRole("heading", { level: 2 })).toHaveText("Portfolios mit Projektseiten");
  await expect(band.getByRole("list", { name: "Portfolio-Beispiele" }).getByRole("link")).toHaveCount(2);
  await expect(band.getByRole("link", { name: "Beispielseite von Ronja Feldkamp ansehen" })).toHaveAttribute("href", "/de/p/ronja-feldkamp");
  await expect(band.getByRole("link", { name: "Beispielseite von Tobin Achterberg ansehen" })).toHaveAttribute("href", "/en/p/tobin-achterberg");
  await band.getByRole("link", { name: "Portfolios ansehen" }).click();
  await page.waitForURL("**/de/portfolio");
});

test("a signed-in visitor gets the dashboard in the header, and 'edit my page' in the menu", async ({ page, isMobile }) => {
  await page.goto("/de/signup");
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`pf-${Date.now().toString(36)}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL("**/de/app/welcome");

  await page.goto("/de/portfolio");
  const header = page.locator("header").first();
  if (isMobile) {
    // Phones: the avatar in sign-up's place; the menu offers the page and the dashboard.
    await expect(header.getByRole("link", { name: "Zum Dashboard" })).toHaveAttribute("href", "/de/app");
    await expect(header.getByRole("link", { name: "Registrieren" })).toHaveCount(0);
    await page.getByRole("button", { name: "Menü" }).click();
    const menu = page.locator("#mk-menu");
    await expect(menu.getByText(/^Angemeldet als \S+$/)).toBeVisible();
    await expect(menu.getByRole("link", { name: "Meine Seite bearbeiten" })).toHaveAttribute("href", "/de/app/editor");
    await expect(menu.getByRole("link", { name: "Zum Dashboard" })).toHaveAttribute("href", "/de/app");
    await expect(menu.getByRole("link", { name: "Kostenlos registrieren" })).toHaveCount(0);
    await expect(menu.getByText("Schon ein Konto?")).toHaveCount(0);
  } else {
    const dashboard = header.getByRole("link", { name: /Zum Dashboard/ });
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toHaveAttribute("href", "/de/app");
    await expect(header.getByRole("link", { name: "Anmelden" })).toHaveCount(0);
  }
});
