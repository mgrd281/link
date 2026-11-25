import { expect, test, type Locator } from "@playwright/test";

import { legalReady } from "../src/features/legal/company";
import { ROUTES } from "./routes";

/**
 * Linkyo's legal pages and the footer links to them, in a demo build (no accounts, no payments).
 * Axe for the three pages runs in a11y.spec.ts (routes.ts) on every locale and colour scheme.
 */

/**
 * The legal pages a demo build has: the three the routes list names. The withdrawal policy
 * (/widerrufsbelehrung) and "Vertrag widerrufen" (/widerruf) only exist where contracts can be made,
 * so without payments they answer 404 and are not listed.
 */
const LEGAL_ROUTES = ROUTES.filter((route) => ["/impressum", "/datenschutz", "/agb"].includes(route));

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
      if (locale === "de") await expect(main.getByText("Verbindlich ist die deutsche Fassung")).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await noUnderlines(main);
    });
  }
}

test("the withdrawal policy does not exist without payments", async ({ page }) => {
  const response = await page.goto("/de/widerrufsbelehrung");
  expect(response?.status()).toBe(404);
});

/**
 * On a phone no legal page scrolls sideways and no title is wider than its box. The German titles
 * hold words of 20 letters ("Geschäftsbedingungen", "Datenschutzerklärung") that at the large title
 * size are wider than a 360 or 390 px column: the title was clipped and the whole page grew to 405 px.
 * 320 px is the narrowest phone still in use; the same rule must hold there, where the longest word is
 * wider than the column even at the phone's title size and has to break.
 */
test.describe("on a phone, no legal page scrolls sideways or clips its title", () => {
  test.skip(({ isMobile }) => isMobile, "sets its own phone widths");

  test("the routes list names the three legal pages of a demo build", () => {
    expect(LEGAL_ROUTES).toEqual(["/impressum", "/datenschutz", "/agb"]);
  });

  for (const width of [320, 360, 390]) {
    for (const locale of ["de", "en", "ar"] as const) {
      for (const route of LEGAL_ROUTES) {
        test(`/${locale}${route} at ${String(width)} px`, async ({ page }) => {
          await page.setViewportSize({ width, height: 800 });
          const response = await page.goto(`/${locale}${route}`);
          expect(response?.status()).toBe(200);
          const measured = await page.evaluate(() => {
            const title = document.querySelector("main h1");
            // Any text in the page that is wider than the box that holds it (a long word with nowhere to break).
            const wider = [...document.querySelectorAll("main *")]
              .filter((element) => !element.classList.contains("sr-only") && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1)
              .map((element) => `${element.tagName.toLowerCase()} ${element.textContent.trim().slice(0, 30)}`);
            return {
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              titleRight: title ? Math.round(title.getBoundingClientRect().right) : null,
              wider,
            };
          });
          expect(measured.overflow, "the page does not scroll sideways").toBeLessThanOrEqual(0);
          expect(measured.titleRight, "the title ends inside the screen").not.toBeNull();
          expect(measured.titleRight ?? 0, "the title ends inside the screen").toBeLessThanOrEqual(width);
          expect(measured.wider, "no text is wider than its box").toEqual([]);
        });
      }
    }
  }
});
