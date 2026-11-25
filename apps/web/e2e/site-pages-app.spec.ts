import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { COMPANY, legalLinksVisible } from "../src/features/legal/company";
import { LEGAL_PROMISES } from "../src/features/marketing/pages/review";
import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

/**
 * The website's own pages (Stage 4, WP4.2): Hilfe, Kontakt, Funktionen, Über uns, Changelog and
 * Sicherheit & Datenschutz in German, English and Arabic; their link previews; the help search; the
 * header, menu and footer that lead there; the pricing comparison; the home page's structured data;
 * and the laptop type of the hero. Runs on the laptop and the phone project.
 */
const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;
const LOCALES = ["de", "en", "ar"] as const satisfies readonly Locale[];
const PAGES = [
  { key: "help", path: "/hilfe" },
  { key: "contact", path: "/kontakt" },
  { key: "features", path: "/funktionen" },
  { key: "about", path: "/ueber-uns" },
  { key: "changelog", path: "/changelog" },
  { key: "security", path: "/sicherheit" },
] as const;
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const site = (locale: Locale) => MESSAGES[locale].sitePages;
const meta = async (page: Page) => ({
  title: await page.title(),
  description: (await page.locator('meta[name="description"]').getAttribute("content")) ?? "",
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const locale of LOCALES) {
  test(`/${locale}: the six site pages answer 200, in their language and direction, each with a title and description of its own`, async ({ page, request }) => {
    test.setTimeout(120_000);
    const seen = new Map<string, string>();
    for (const { key, path } of PAGES) {
      const response = await page.goto(`/${locale}${path}`);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(site(locale)[key].title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}${path}$`));
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
      // Nothing wider than the screen.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
      const { title, description } = await meta(page);
      expect(title).toBe(site(locale)[key].meta.title);
      expect(description.length, path).toBeGreaterThan(60);
      for (const [other, text] of seen) {
        expect(text, `${path} and ${other} share a description`).not.toBe(description);
      }
      seen.set(path, description);
      seen.set(`${path} (title)`, title);
      // Its own link preview: a PNG under 300 KB.
      const image = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(image).toContain(`/${locale}${path}/opengraph-image`);
      const card = await request.get(new URL(image ?? "").pathname);
      expect(card.status()).toBe(200);
      expect(card.headers()["content-type"]).toBe("image/png");
      expect((await card.body()).byteLength, `${path} preview`).toBeLessThan(300 * 1024);
    }
  });
}

test("every public page's meta description is its own (home, gallery, portfolio, sign-up and the site pages)", async ({ page }) => {
  test.setTimeout(120_000);
  for (const locale of ["de", "ar"] as const) {
    const descriptions = new Map<string, string>();
    for (const path of ["", "/templates", "/portfolio", "/signup", ...PAGES.map((entry) => entry.path)]) {
      await page.goto(`/${locale}${path}`);
      const { description } = await meta(page);
      expect(description, `${locale}${path}`).not.toBe("");
      const twin = descriptions.get(description);
      expect(twin, `${locale}${path} repeats the description of ${locale}${twin ?? ""}`).toBeUndefined();
      descriptions.set(description, path);
    }
    // Sign-up says what sign-up is, not the site's default line.
    expect([...descriptions.entries()].find(([, path]) => path === "/signup")?.[0]).toBe(MESSAGES[locale].sitePages.signup.description);
    expect(descriptions.has(MESSAGES[locale].meta.description)).toBe(false);
  }
});

test("the site pages are accessible in light and dark (axe), with nothing moving", async ({ page }) => {
  test.setTimeout(180_000);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const locale of ["de", "ar"] as const) {
      for (const { path } of PAGES) {
        await page.goto(`/${locale}${path}`);
        await page.waitForLoadState("load");
        const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ") ?? ""}`), `${locale}${path} (${scheme})`).toEqual([]);
      }
    }
  }
});

test.describe("help", () => {
  /** A word that only one article's body holds, in each language. */
  const BODY_WORDS = { de: "Prüfwert", en: "prefetches", ar: "قيمة تحقق" } as const;

  for (const locale of LOCALES) {
    test(`/${locale}/hilfe: the search finds an article by a word in its body, and says when nothing matches`, async ({ page }) => {
      await page.goto(`/${locale}/hilfe`);
      const search = page.getByRole("searchbox", { name: MESSAGES[locale].help.search.label });
      const articles = page.locator("[data-help-article]");
      await expect(articles).toHaveCount(13);
      await search.fill(BODY_WORDS[locale]);
      await expect(articles).toHaveCount(1);
      await expect(articles.first()).toHaveAttribute("data-help-article", "statistik");
      // Found in the body: the article is open, so the words are there to read.
      await expect(articles.first()).toHaveAttribute("open", "");
      await expect(articles.first().getByText(BODY_WORDS[locale]).first()).toBeVisible();
      await expect(page.getByRole("status")).not.toBeEmpty();
      // Nothing matches: the empty state names the search and offers a way on.
      await search.fill(locale === "ar" ? "زرافة" : "xylophon");
      await expect(articles).toHaveCount(0);
      const empty = page.locator("[data-help-empty]");
      await expect(empty).toBeVisible();
      await expect(empty.getByRole("link", { name: MESSAGES[locale].help.search.contact })).toHaveAttribute("href", `/${locale}/kontakt`);
      await empty.getByRole("button", { name: MESSAGES[locale].help.search.clear }).click();
      await expect(articles).toHaveCount(13);
      await expect(search).toHaveValue("");
    });
  }

  test("an address with an article's slug opens that article", async ({ page }) => {
    await page.goto("/de/hilfe#konto-loeschen");
    const article = page.locator('[data-help-article="konto-loeschen"]');
    await expect(article).toHaveAttribute("open", "");
    await expect(article.getByText("„Meine Daten exportieren“ lädt alles als JSON-Datei.")).toBeVisible();
    await expect(page.locator("details[open]")).toHaveCount(1);
  });
});

test.describe("contact and security", () => {
  test("/kontakt: the e-mail address of the company data as a mailto link, the Impressum, no form and no phone number", async ({ page }) => {
    await page.goto("/de/kontakt");
    await expect(page.locator("[data-contact-email]")).toHaveAttribute("href", `mailto:${COMPANY.email}`);
    await expect(page.locator("main form, main input, main textarea")).toHaveCount(0);
    await expect(page.locator('main a[href^="tel:"]')).toHaveCount(0);
    expect(await page.locator("main").textContent()).not.toContain(COMPANY.phone);
    if (legalLinksVisible) {
      await expect(page.locator("main").getByRole("link", { name: de.sitePages.common.imprint })).toHaveAttribute("href", "/de/impressum");
      await expect(page.locator("main").getByRole("link", { name: de.sitePages.contact.report.action })).toHaveAttribute("href", "/de/impressum#melden");
    }
    await expect(page.locator("main").getByRole("link", { name: de.sitePages.contact.help.action })).toHaveAttribute("href", "/de/hilfe");
  });

  for (const locale of LOCALES) {
    test(`/${locale}/sicherheit: every legal promise carries the lawyer's review marker, in German`, async ({ page }) => {
      await page.goto(`/${locale}/sicherheit`);
      const markers = page.locator("[data-review-marker]");
      await expect(markers).toHaveCount(LEGAL_PROMISES.security.length);
      for (const marker of await markers.all()) {
        await expect(marker).toHaveText("[vom Anwalt zu prüfen]");
        await expect(marker).toHaveAttribute("lang", "de");
      }
      // The note under the title says what the marker means.
      await expect(page.locator("[data-review-note]")).toContainText("[vom Anwalt zu prüfen]");
      // The counting is described as ADR 0081 does it: no cookie, a daily key, Do Not Track honoured.
      await expect(page.locator("#statistik")).toContainText("HMAC-SHA-256");
    });
  }
});

test("/changelog: dated entries, newest first", async ({ page }) => {
  await page.goto("/de/changelog");
  const dates = await page.locator("[data-changelog] time").evaluateAll((times) => times.map((time) => time.getAttribute("datetime") ?? ""));
  expect(dates.length).toBeGreaterThan(4);
  expect([...dates].sort().reverse()).toEqual(dates);
  await expect(page.locator("[data-changelog] time").first()).toHaveText("25. November 2026");
});

test("search engines find the site pages in every language", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const locale of LOCALES) for (const { path } of PAGES) expect(sitemap).toContain(`/${locale}${path}</loc>`);
  // The page service only where it can be booked.
  expect(sitemap).not.toContain("/service</loc>");
});

test.describe("the way there: header, menu and footer", () => {
  test("the footer leads to the six site pages", async ({ page }) => {
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");
    for (const [name, href] of [
      [en.marketing.footer.help, "/en/hilfe"],
      [en.marketing.footer.contact, "/en/kontakt"],
      [en.marketing.footer.features, "/en/funktionen"],
      [en.marketing.footer.about, "/en/ueber-uns"],
      [en.marketing.footer.changelog, "/en/changelog"],
      [en.marketing.footer.security, "/en/sicherheit"],
    ] as const) {
      await expect(footer.getByRole("link", { name, exact: true }), name).toHaveAttribute("href", href);
    }
  });

  test("the phone menu leads to Features and Help, each glyph from the registry", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/de");
    await page.getByRole("button", { name: de.marketing.nav.menu }).click();
    const menu = page.locator("#mk-menu");
    await expect(menu.getByRole("link", { name: new RegExp(`^${de.marketing.nav.features}`) })).toHaveAttribute("href", "/de/funktionen");
    await expect(menu.getByRole("link", { name: new RegExp(`^${de.marketing.nav.help}`) })).toHaveAttribute("href", "/de/hilfe");
    // Lucide marks each glyph with its name: the registry's blocks, layout-template, folder-kanban, tag and circle-question-mark.
    const glyphs = await menu.locator("nav svg").evaluateAll((svgs) => svgs.map((svg) => svg.getAttribute("class") ?? ""));
    expect(glyphs.filter((name) => /lucide-(blocks|layout-template|folder-kanban|tag|circle-question-mark)\b/.test(name))).toHaveLength(5);
    await context.close();
  });
});
