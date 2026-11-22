import { expect, test, type Locator } from "@playwright/test";

import { legalReady } from "../src/features/legal/company";

/**
 * Linkyo's legal pages and the footer links to them, in a demo build (no accounts, no payments).
 * Axe for the three pages runs in a11y.spec.ts (routes.ts) on every locale and colour scheme.
 */

const NAMES = {
  de: ["Impressum", "Datenschutz", "AGB"],
  en: ["Imprint", "Privacy", "Terms"],
  ar: ["بيانات النشر", "الخصوصية", "الشروط"],
} as const;

const PAGES = [
  { path: "impressum", title: { de: "Impressum", en: "Imprint", ar: "بيانات النشر" }, text: "Angaben gemäß § 5 DDG" },
  { path: "datenschutz", title: { de: "Datenschutzerklärung", en: "Privacy policy", ar: "سياسة الخصوصية" }, text: "Verantwortlicher" },
  { path: "agb", title: { de: "Allgemeine Geschäftsbedingungen", en: "Terms and conditions", ar: "الشروط والأحكام" }, text: "§ 1 Geltungsbereich" },
] as const;

/** Every link in this part of the page shows no line under it, also on hover. */
async function noUnderlines(scope: Locator) {
  const links = scope.getByRole("link");
  for (let index = 0; index < (await links.count()); index += 1) {
    const link = links.nth(index);
    expect(await link.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe("none");
  }
}

for (const [locale, path] of [
  ["de", "/de"],
  ["en", "/en/templates"],
  ["ar", "/ar/signup"],
] as const) {
  test(`footer of ${path} names the legal pages (links only with real company data), no contract links`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    for (const name of NAMES[locale]) {
      await expect(footer.getByText(name, { exact: true })).toBeVisible();
      await expect(footer.getByRole("link", { name, exact: true })).toHaveCount(legalReady ? 1 : 0);
    }
    for (const contract of ["Vertrag widerrufen", "Verträge hier kündigen", "Withdraw from contract", "Cancel contracts here"]) {
      await expect(page.getByText(contract)).toHaveCount(0);
    }
    await noUnderlines(footer);
  });
}

for (const { path, title, text } of PAGES) {
  for (const locale of ["de", "en", "ar"] as const) {
    test(`/${locale}/${path} shows the German draft under a localized title, not indexed`, async ({ page }) => {
      const response = await page.goto(`/${locale}/${path}`);
      expect(response?.status()).toBe(200);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1, name: title[locale] })).toBeVisible();
      await expect(main.getByRole("note")).toBeVisible();
      const german = main.locator('[lang="de"]');
      await expect(german).toHaveAttribute("dir", "ltr");
      await expect(german.getByText(text).first()).toBeVisible();
      if (locale === "de") await expect(main.getByText("Verträge schließen wir derzeit nur auf Deutsch")).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await noUnderlines(main);
    });
  }
}

test("the withdrawal policy does not exist without payments", async ({ page }) => {
  const response = await page.goto("/de/widerrufsbelehrung");
  expect(response?.status()).toBe(404);
});
