import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Dead ends (WP1.2): every unknown or gated address answers with a real 404 and Linkyo's own page in
 * the visitor's language (lang, dir, a localized h1, the way back), with zero axe violations; sign-up
 * and log-in show no button that does nothing; the legal pages say which text is binding. Runs in the
 * demo build (no real accounts, no payments) on the laptop and the phone.
 */

const realEnabled = Boolean(process.env.E2E_SUPABASE);
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const TITLE = { de: "Diese Seite gibt es nicht", en: "This page doesn't exist", ar: "هذه الصفحة غير موجودة" } as const;
const TAB = { de: "Seite nicht gefunden · Linkyo", en: "Page not found · Linkyo", ar: "الصفحة غير موجودة · Linkyo" } as const;
const ACTIONS = {
  de: { home: "Zur Startseite", templates: "Vorlagen ansehen", dashboard: "Zum Dashboard", team: "Zum Teambereich" },
  en: { home: "Go to the home page", templates: "See templates", dashboard: "Go to the dashboard", team: "Go to the team area" },
  ar: { home: "إلى الصفحة الرئيسية", templates: "تصفّح القوالب", dashboard: "إلى لوحة التحكم", team: "إلى لوحة الفريق" },
} as const;

type Locale = keyof typeof TITLE;
type Area = "site" | "app" | "admin";

/** `tab`: the page's title says "not found" (the addresses whose metadata this work owns; the example
 * route and the team area's order screens keep their own title until their pages share the rule). */
const CASES: { path: string; locale: Locale; area: Area; tab?: true }[] = [
  { path: "/de/nope", locale: "de", area: "site", tab: true },
  { path: "/en/nope", locale: "en", area: "site", tab: true },
  { path: "/ar/nope", locale: "ar", area: "site", tab: true },
  { path: "/de/p/does-not-exist", locale: "de", area: "site" },
  { path: "/de/templates/nope/deeper", locale: "de", area: "site", tab: true },
  { path: "/de/app/xyz", locale: "de", area: "app", tab: true },
  { path: "/ar/app/xyz", locale: "ar", area: "app", tab: true },
  { path: "/de/app/orders/x1", locale: "de", area: "app", tab: true },
  { path: "/en/app/proposals/x1", locale: "en", area: "app", tab: true },
  { path: "/de/admin/xyz", locale: "de", area: "admin", tab: true },
  { path: "/de/admin/orders", locale: "de", area: "admin" },
  { path: "/ar/admin/orders/x1", locale: "ar", area: "admin" },
];

async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact ?? ""}): ${String(v.nodes.length)}× — ${v.nodes[0]?.target.join(" ") ?? ""}`);
}

/** Links are marked by colour and weight, never by a line under them (ADR 0041). */
async function noUnderlines(page: Page) {
  for (const decoration of await page.getByRole("link").evaluateAll((links) => links.map((link) => getComputedStyle(link).textDecorationLine))) {
    expect(decoration).toBe("none");
  }
}

test.describe("not found", () => {
  test.skip(realEnabled, "The demo build: no payments, so the order addresses cannot exist.");

  for (const { path, locale, area, tab } of CASES) {
    test(`${path} answers 404 with Linkyo's page in its language`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      const html = page.locator("html");
      await expect(html).toHaveAttribute("lang", locale);
      await expect(html).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1, name: TITLE[locale] })).toBeVisible();
      await expect(main.getByRole("img", { name: "Linkyo" })).toBeVisible();
      if (tab) await expect(page).toHaveTitle(TAB[locale]);
      // Next adds "noindex" to every 404; the pages this work owns say nothing else.
      const robots = await page.locator('meta[name="robots"]').evaluateAll((metas) => metas.map((meta) => meta.getAttribute("content") ?? ""));
      expect(robots.some((content) => content.includes("noindex")), robots.join(" | ")).toBe(true);
      if (tab) for (const content of robots) expect(content).toMatch(/noindex/);

      const actions = ACTIONS[locale];
      if (area === "site") {
        await expect(main.getByRole("link", { name: actions.home })).toHaveAttribute("href", `/${locale}`);
        await expect(main.getByRole("link", { name: actions.templates })).toHaveAttribute("href", `/${locale}/templates`);
      } else {
        const way = area === "app" ? { name: actions.dashboard, href: `/${locale}/app` } : { name: actions.team, href: `/${locale}/admin` };
        await expect(main.getByRole("link", { name: way.name })).toHaveAttribute("href", way.href);
        await expect(main.getByRole("link", { name: actions.home })).toHaveAttribute("href", `/${locale}`);
      }
      // The dashboard's addresses take its black and grey (ADR 0062); the site and the team area stay teal.
      if (area === "app") await expect(main).toHaveAttribute("data-console", "frame");
      else await expect(main).not.toHaveAttribute("data-console", /.*/);

      await noUnderlines(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  }

  test("an order address in the demo says orders need a real account, and the gate does not send to log-in", async ({ page }) => {
    const response = await page.goto("/de/app/orders/3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("main")).toContainText("Aufträge und Vorschläge gibt es nur mit einem echten Konto");
    await expect(page).toHaveURL(/\/de\/app\/orders\/3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f$/);
  });

  test("the way back from a dashboard address leads into the dashboard's own gate", async ({ page }) => {
    await page.goto("/de/app/xyz");
    await page.getByRole("link", { name: ACTIONS.de.dashboard }).click();
    // Signed out, the dashboard's gate sends to log-in and back afterwards.
    await page.waitForURL(/\/de\/login\?next=%2Fapp$/);
  });

  test("an unknown first segment still answers 404, never a server error", async ({ page }) => {
    // The language layout answers these itself (its own notFound(): Next's built-in page, see the ADR draft).
    for (const path of ["/u/mila/project/extra", "/missing-file.php", "/api/nope"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test("pages that exist still answer 200", async ({ page }) => {
    for (const path of ["/de/p/ronja-feldkamp", "/de/templates", "/de", "/ar", "/de/app", "/de/admin", "/de/login", "/de/impressum"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
    }
  });
});

test.describe("sign-up and log-in", () => {
  test("no Google button and no 'or' divider: the email is the one way in", async ({ page }) => {
    for (const path of ["/de/signup", "/ar/login", "/en/signup", "/de/login"]) {
      await page.goto(path);
      await expect(page.locator("#signup-email, #login-email")).toBeVisible();
      await expect(page.getByText(/google/i)).toHaveCount(0);
      await expect(page.getByRole("button", { name: /google/i })).toHaveCount(0);
      await expect(page.locator('img[src*="google"]')).toHaveCount(0);
    }
  });

  test("an empty email says what is missing; a malformed one says it looks incomplete", async ({ page }) => {
    await page.goto("/de/signup");
    await expect(page.getByText("Nur deine E-Mail, kein Passwort.")).toBeVisible();
    await expect(page.getByText("Bereit, linkyo zu sein?")).toHaveCount(0);
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("#signup-email")).toBeFocused();
    await expect(page.getByText("Bitte gib deine E-Mail ein.")).toBeVisible();
    await expect(page.getByText("sieht unvollständig aus")).toHaveCount(0);
    await page.locator("#signup-email").fill("mila@");
    await page.locator("form button[type=submit]").click();
    await expect(page.getByText("Diese E-Mail-Adresse sieht unvollständig aus")).toBeVisible();
    await expect(page.getByText("Bitte gib deine E-Mail ein.")).toHaveCount(0);

    await page.goto("/ar/login");
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("#login-email")).toBeFocused();
    await expect(page.getByText("أدخل بريدك الإلكتروني من فضلك.")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe("legal pages", () => {
  test("English and Arabic say the German text is the binding one; German does not repeat it", async ({ page }) => {
    await page.goto("/en/impressum");
    await expect(page.getByRole("main")).toContainText("This text is available in German only for now. The German version is the binding one.");
    await page.goto("/ar/datenschutz");
    await expect(page.getByRole("main")).toContainText("والنسخة الألمانية هي المُلزِمة");
    await page.goto("/de/impressum");
    await expect(page.getByRole("main")).not.toContainText("Verbindlich ist die deutsche Fassung");
    // Still drafts in this build: the banner stays until the review (a launch build fails meanwhile).
    await expect(page.getByRole("main").getByRole("note")).toBeVisible();
  });
});
