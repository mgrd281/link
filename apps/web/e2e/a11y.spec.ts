import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { LOCALES, ROUTES } from "./routes";

/** WCAG 2.2 AA (brand §11): zero axe violations on every route, locale and color scheme. */
for (const locale of LOCALES) {
  for (const route of ROUTES) {
    for (const scheme of ["light", "dark"] as const) {
      test(`axe: /${locale}${route} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await page.goto(`/${locale}${route}`);
        await page.waitForLoadState("load");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
        expect(summary).toEqual([]);
      });
    }
  }
}

test("html lang and dir follow the locale", async ({ page }) => {
  await page.goto("/ar/design");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.goto("/de/design");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
