import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The portfolio example pages and their project pages (WP9's a11y sweep, audit P-06): a
 * photographer (Werkbogen, de), a developer (Tiefdruck, en), a coach in Arabic (Werkbogen, ar) and
 * a carpenter (Tiefdruck with the grid, de), each portfolio and one project, on the laptop and the
 * phone project. Zero axe findings (WCAG 2.2 AA), the document in the page's language and
 * direction, nothing wider than the screen.
 *
 * Checked with reduced motion, as e2e/portfolio-page-app.spec.ts does: the templates' scroll-driven
 * reveals leave rows below the fold part-way faded until they are scrolled to, and axe measures that
 * contrast although no visitor reads it there.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const ROUTES = [
  { path: "/de/p/ronja-feldkamp", lang: "de" },
  { path: "/de/p/ronja-feldkamp/hafenlicht", lang: "de" },
  { path: "/en/p/tobin-achterberg", lang: "en" },
  { path: "/en/p/tobin-achterberg/plotweft", lang: "en" },
  { path: "/ar/p/naya-aldabbas", lang: "ar" },
  { path: "/ar/p/naya-aldabbas/accountant-to-analyst", lang: "ar" },
  { path: "/de/p/jorinde-ahlfeld", lang: "de" },
  { path: "/de/p/jorinde-ahlfeld/sechs-stuehle", lang: "de" },
] as const;

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

for (const { path, lang } of ROUTES) {
  test(`portfolio a11y: ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    await expect(page.locator("h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await axe(page)).toEqual([]);
  });
}
