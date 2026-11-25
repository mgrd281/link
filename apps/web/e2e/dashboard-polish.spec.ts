import { TEMPLATE_IDS, templatesFor } from "@linkyo/tokens/creator";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * The polish pass after Stage 3 (creator dashboard): one guard per defect the scorers found, each
 * measured as geometry so it fails without its fix.
 *
 * - D1: Design never scrolls the page by itself (at 1440 and 1920).
 *
 * Demo mode: everything lives in this browser's storage. The file name keeps it out of the mobile
 * project (see playwright.config.ts): it runs once, in the desktop project, with the viewport (and,
 * for phones, touch) each test sets for itself.
 */

const STORAGE_KEY = "linkyo.demo.v1";
let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

const heading = (page: Page) => page.locator("#main h1").first();

async function signedIn(page: Page, locale: "de" | "en" | "ar" = "en") {
  const name = `dp-${unique()}`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: { de: "Später", en: "Skip for now", ar: "لاحقًا" }[locale] }).click();
  await page.waitForURL(`**/${locale}/app`);
  await expect(heading(page)).toBeVisible();
}

interface Seed {
  kind?: string;
  template?: string;
  projects?: number;
  links?: number;
  ready?: boolean;
}

/** A demo page: links and projects (a cover each), and (ready) a photo and a bio. */
async function seed(page: Page, { kind, template, projects = 0, links = 3, ready = true }: Seed) {
  await page.evaluate(
    ([key, options]) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
        session: { accountId: string };
        sites: Record<string, { kind?: string; theme: Record<string, unknown>; page: { blocks: unknown[]; profile: Record<string, unknown> } }>;
      };
      const site = db.sites[db.session.accountId];
      if (!site) throw new Error("no site");
      const block = (id: string, extra: Record<string, unknown>) => ({ id, visible: true, highlight: false, ...extra });
      const cover = (alt: string) => ({ src: "sample:mila-avatar", alt, tone: "dark", w: 800, h: 1000 });
      site.page.blocks = [
        ...Array.from({ length: options.links }, (_, i) => block(`l-${i}`, { type: "link", title: `Link ${i + 1}`, url: `https://example.com/${i}` })),
        ...Array.from({ length: options.projects }, (_, i) =>
          block(`p-${i}`, {
            type: "project",
            slug: `arbeit-${i + 1}`,
            title: `Arbeit ${i + 1}`,
            summary: "Ein Satz über diese Arbeit.",
            year: { from: 2020 + i },
            cover: cover(`Bild ${i + 1}`),
          }),
        ),
      ];
      if (options.ready) {
        site.page.profile.bio = "Bilder und Räume.";
        // A 1×1 picture: the page counts as having a photo without loading anything.
        site.page.profile.avatar = { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", alt: "" };
      }
      if (options.kind) site.kind = options.kind;
      if (options.template) site.theme = { template: options.template };
      window.localStorage.setItem(key, JSON.stringify(db));
    },
    [STORAGE_KEY, { kind, template, projects, links, ready }] as const,
  );
  await page.reload();
  await expect(heading(page)).toBeVisible();
}

// ─── D1: Design does not move the page ─────────────────────────────────────────────────────────

test.describe("D1: Design keeps the page where it is", () => {
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
  ] as const) {
    test(`at ${String(width)} the page is still at the top a second after Design opens, and after each filter`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await signedIn(page);
      // The last look is chosen: its card sits in the grid's last row, below the window.
      await seed(page, { template: "laufbahn" });
      // Smooth scrolling is what people get: the old picker moved the page with it.
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto("/en/app/design");
      await expect(heading(page)).toHaveText("Design");
      const cards = page.locator("#main fieldset label:has(input[name=poster-template])");
      await expect(cards).toHaveCount(TEMPLATE_IDS.length);
      const chosen = cards.filter({ has: page.locator("input:checked") });
      await expect(chosen).toHaveCount(1);
      await page.waitForTimeout(1000);
      const scrolled = await page.evaluate(() => window.scrollY);
      // The chosen look lies below the window (its place in the page, not where the window now is):
      // that is what made the old picker scroll.
      expect(((await chosen.boundingBox())?.y ?? 0) + scrolled, "the chosen look is below the window").toBeGreaterThan(height);
      expect(scrolled, "the page scrolled by itself").toBe(0);
      // A smooth scroll that starts late (a busy page) is caught too.
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => window.scrollY), "the page scrolled by itself, late").toBe(0);
      // The title, the filter and the first row are where they were.
      await expect(heading(page)).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("radio", { name: "All", exact: true })).toBeInViewport({ ratio: 1 });
      // The filter does not move the page either.
      await page.getByRole("radio", { name: "Portfolio", exact: true }).click();
      await expect(cards).toHaveCount(templatesFor("portfolio").length);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => window.scrollY), "the filter scrolled the page").toBe(0);
      await page.getByRole("radio", { name: "All", exact: true }).click();
      await expect(cards).toHaveCount(TEMPLATE_IDS.length);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => window.scrollY), "the filter scrolled the page back").toBe(0);
    });
  }
});
