import AxeBuilder from "@axe-core/playwright";
import { tokens } from "@linkyo/tokens";
import { templatesFor } from "@linkyo/tokens/creator";
import { expect, test, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * The dashboard on laptops (WP2.4): the section panel only where a place has four or more parts, the
 * wide column and Home's two columns, real template previews in a grid with "All · Portfolio", the
 * chosen look in view, the "Arbeiten" view of a page's projects (covers, order, next step, honest
 * counts, the three ways to add, the work layout), the tab bar's strong selected state, and a
 * portfolio's first step in the editor. Desktop (1440 × 900, wider where a test says so) and phone.
 * Demo mode: everything lives in this browser's storage.
 */

const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;
const STORAGE_KEY = "linkyo.demo.v1";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signedIn(page: Page, locale: Locale = "en") {
  const name = `dl-${unique()}`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: MESSAGES[locale].app.welcome.skip }).click();
  await page.waitForURL(`**/${locale}/app`);
  await expect(heading(page)).toBeVisible();
  return MESSAGES[locale];
}

const heading = (page: Page) => page.locator("#main h1").first();
const column = (page: Page) => page.locator("#main [data-screen-column]").first();
const place = (page: Page, name: string) => page.getByRole("link", { name, exact: true }).locator("visible=true").first();

interface Seed {
  kind?: string;
  template?: string;
  projects?: number;
  links?: number;
}

/** A demo page: a photo and a bio, some links and projects (a cover each, one without a description). */
async function seed(page: Page, { kind, template, projects = 0, links = 3 }: Seed) {
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
            // The second project waits for a description of its cover.
            cover: cover(i === 1 ? "" : `Bild ${i + 1}`),
          }),
        ),
      ];
      site.page.profile.bio = "Bilder und Räume.";
      // A 1×1 picture: the page counts as having a photo without loading anything.
      site.page.profile.avatar = { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", alt: "" };
      if (options.kind) site.kind = options.kind;
      if (options.template) site.theme = { template: options.template };
      window.localStorage.setItem(key, JSON.stringify(db));
    },
    [STORAGE_KEY, { kind, template, projects, links }] as const,
  );
  await page.reload();
  await expect(heading(page)).toBeVisible();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
}

/** How many cards stand side by side in a grid's first row. */
const firstRow = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((items) => {
    const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
    return tops.filter((top) => top === tops[0]).length;
  });

test.describe("laptop layout", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "laptop widths");
  });

  test("the panel only where a place has four or more parts; the column uses the width", async ({ page }) => {
    await signedIn(page);
    await seed(page, { projects: 2 });
    for (const [name, panel] of [
      ["Home", false],
      ["Page", false],
      ["Design", false],
      ["Stats", true],
      ["Settings", true],
    ] as const) {
      await place(page, name).click();
      await expect(heading(page)).toBeVisible();
      await expect(page.locator("#nav-panel"), name).toHaveCount(panel ? 1 : 0);
    }
    // At 1440 the Page column is the wide column (840), no longer a phone's 640.
    await place(page, "Page").click();
    await expect(heading(page)).toHaveText("Page");
    expect(Math.round((await column(page).boundingBox())?.width ?? 0)).toBe(tokens.layout.columnWide);
  });

  test("at 1920 the column is wide and Home stands in two columns", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signedIn(page);
    await seed(page, { projects: 3 });
    // Ready (links, a photo and a bio): the link, the week and the invite in two columns.
    const columns = page.locator("#main [data-screen-column] .\\@container > div").first();
    await expect.poll(() => columns.evaluate((element) => getComputedStyle(element).columnCount)).toBe("2");
    expect((await column(page).boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(760);
    await place(page, "Page").click();
    await expect(heading(page)).toHaveText("Page");
    expect((await column(page).boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(760);
    // Without a panel the column is centred between the rail and the live page.
    const box = await column(page).boundingBox();
    const aside = await page.locator("[data-preview-aside]").boundingBox();
    const rail = await page.locator("[data-nav]").boundingBox();
    if (!box || !aside || !rail) throw new Error("layout missing");
    const before = box.x - (rail.x + rail.width);
    const after = aside.x - (box.x + box.width);
    expect(Math.abs(before - after)).toBeLessThanOrEqual(48);
  });

  test("Design at 1440: real previews in a grid of 3 or 4, All · Portfolio, the chosen look in view", async ({ page }) => {
    await signedIn(page);
    // The last look is chosen: it sits in the grid's last row.
    await seed(page, { template: "laufbahn" });
    // Every scroll the picker asks for, with its behaviour: under reduced motion none may be smooth.
    await page.addInitScript(() => {
      const calls: string[] = [];
      (window as unknown as { pickerScrolls: string[] }).pickerScrolls = calls;
      for (const name of ["scrollIntoView", "scrollBy", "scrollTo"] as const) {
        const original = Element.prototype[name] as (...args: unknown[]) => void;
        Object.defineProperty(Element.prototype, name, {
          configurable: true,
          writable: true,
          value(this: Element, ...args: unknown[]) {
            if (this.querySelector("input[name=poster-template]")) {
              const options = args[0];
              calls.push(typeof options === "object" && options !== null ? String((options as { behavior?: string }).behavior ?? "auto") : "auto");
            }
            original.apply(this, args);
          },
        });
      }
    });
    await page.goto("/en/app/design");
    await expect(heading(page)).toHaveText("Design");
    const cards = "#main fieldset label:has(input[name=poster-template])";
    await expect(page.locator(cards)).toHaveCount(14);
    // Every card shows its captured first screen.
    await expect(page.locator(`${cards} img`)).toHaveCount(14);
    const perRow = await firstRow(page, cards);
    expect(perRow).toBeGreaterThanOrEqual(3);
    expect(perRow).toBeLessThanOrEqual(4);
    // The chosen card was brought into the window, instantly: reduced motion asks for no smooth scroll.
    const chosen = page.locator(`${cards}:has(input:checked)`);
    await expect(chosen).toBeInViewport({ ratio: 1 });
    const scrolls = await page.evaluate(() => (window as unknown as { pickerScrolls: string[] }).pickerScrolls);
    expect(scrolls.length, "the picker scrolled the chosen card into view").toBeGreaterThan(0);
    expect(scrolls.filter((behavior) => behavior === "smooth")).toEqual([]);
    // No second set of Design tabs: only the card's.
    await expect(page.getByRole("tab", { name: "Color", exact: true })).toHaveCount(1);
    // D-14: the colour of your own is a control in a card, rounded like the buttons beside it, no pill.
    const custom = page.locator("#main label").filter({ has: page.locator('input[type="color"]') });
    await expect(custom).toBeVisible();
    expect(parseFloat(await custom.evaluate((element) => getComputedStyle(element).borderTopLeftRadius))).toBeLessThanOrEqual(16);

    // Portfolio: the looks made for portfolios, from the tokens.
    await page.getByRole("radio", { name: "Portfolio", exact: true }).click();
    await expect(page.locator(cards)).toHaveCount(templatesFor("portfolio").length);
    await expect(chosen).toBeInViewport();
    await page.getByRole("radio", { name: "All", exact: true }).click();
    await expect(page.locator(cards)).toHaveCount(14);
  });
});

test.describe("Arbeiten", () => {
  test("covers with title, year, next step and the count of pictures without a description; order, ways to add, layout", async ({ page, isMobile }) => {
    const m = await signedIn(page);
    await seed(page, { kind: "photographer", projects: 3, links: 0 });
    await page.goto("/en/app/work");
    await expect(heading(page)).toHaveText(m.app.work.title);
    // Honest counts above: three projects, one picture waiting.
    await expect(page.locator("#main")).toContainText("3 projects · 1 picture without a description");
    const cards = page.locator("#main ul[aria-label] > li");
    await expect(cards).toHaveCount(3);
    expect(await firstRow(page, "#main ul[aria-label] > li"), "two on a phone, all three side by side on a laptop").toBe(isMobile ? 2 : 3);
    await expect(cards.nth(0)).toContainText("Arbeit 1");
    await expect(cards.nth(0)).toContainText("2020");
    await expect(cards.nth(1)).toContainText(m.app.work.next.alt);
    await expect(cards.nth(1)).toContainText("1 picture without a description");

    // Later: Arbeit 1 moves behind Arbeit 2; one undo brings it back.
    await page.getByRole("button", { name: "Move Arbeit 1 later" }).click();
    await expect(cards.nth(0)).toContainText("Arbeit 2");
    await expect(cards.nth(1)).toContainText("Arbeit 1");
    await expect(page.getByRole("button", { name: "Move Arbeit 2 earlier" })).toBeDisabled();
    await page.getByRole("button", { name: "Undo" }).locator("visible=true").first().click();
    await expect(cards.nth(0)).toContainText("Arbeit 1");

    // The three ways to add.
    for (const way of [m.app.work.add.type, m.app.work.add.photos, m.app.work.add.link]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${way}`) })).toBeVisible();
    }
    // From a link: the Add sheet's link door, which makes a project of it.
    await page.getByRole("button", { name: new RegExp(`^${m.app.work.add.link}`) }).click();
    const sheet = page.getByRole("dialog", { name: m.app.add.work.title });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel(m.app.add.work.label)).toBeVisible();
    // Only the link: no photos, no list of types.
    await expect(sheet.locator("[data-type]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // The work layout writes the page's theme.
    await page.getByText(m.app.design.projects.list, { exact: true }).click();
    await expect.poll(() =>
      page.evaluate((key) => {
        const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { session: { accountId: string }; sites: Record<string, { theme: { projects?: string } }> };
        return db.sites[db.session.accountId]?.theme.projects;
      }, STORAGE_KEY),
    ).toBe("list");

    // Content | Work at the top of the Page tab, the current one marked.
    const views = page.getByRole("navigation", { name: m.app.work.viewsLabel });
    await expect(views.getByRole("link", { name: m.app.work.title })).toHaveAttribute("aria-current", "page");
    await views.getByRole("link", { name: m.app.editor.blocks }).click();
    await page.waitForURL("**/en/app/editor");
    await expect(page.getByRole("navigation", { name: m.app.work.viewsLabel }).getByRole("link", { name: m.app.editor.blocks })).toHaveAttribute("aria-current", "page");
  });

  test("four covers side by side on a laptop (1024, 1280, 1440), two on a phone", async ({ page, isMobile }) => {
    await signedIn(page);
    // More covers than a row holds, so three columns and four can be told apart.
    await seed(page, { kind: "photographer", projects: 6, links: 0 });
    for (const width of isMobile ? [0] : [1024, 1280, 1440]) {
      if (width) await page.setViewportSize({ width, height: 900 });
      await page.goto("/en/app/work");
      await expect(page.locator("#main ul[aria-label] > li")).toHaveCount(6);
      expect(await firstRow(page, "#main ul[aria-label] > li"), `${String(width || "phone")}`).toBe(isMobile ? 2 : 4);
    }
  });

  test("a portfolio's empty page starts with its first project", async ({ page }) => {
    const m = await signedIn(page);
    await seed(page, { kind: "designer", links: 0 });
    await page.goto("/en/app/editor");
    await expect(page.locator("#main")).toContainText(m.app.work.empty.title);
    await expect(page.getByRole("button", { name: new RegExp(`^${m.app.work.add.type}`) })).toBeVisible();
    // Typing it opens the project form.
    await page.getByRole("button", { name: new RegExp(`^${m.app.work.add.type}`) }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("a page that is not about work has no Arbeiten switch", async ({ page }) => {
    const m = await signedIn(page);
    await seed(page, { kind: "music" });
    await page.goto("/en/app/editor");
    await expect(heading(page)).toHaveText(m.app.editor.title);
    await expect(page.getByRole("navigation", { name: m.app.work.viewsLabel })).toHaveCount(0);
  });

  for (const locale of ["de", "ar"] as const) {
    test(`axe on /${locale}/app/work`, async ({ page }) => {
      await signedIn(page, locale);
      await seed(page, { kind: "photographer", projects: 3, links: 0 });
      await page.goto(`/${locale}/app/work`);
      await expect(heading(page)).toHaveText(MESSAGES[locale].app.work.title);
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        expect(await axe(page), `${locale} ${scheme}`).toEqual([]);
      }
    });
  }
});

test("the chosen tab: a strong stroke and a semibold label, not colour alone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the tab bar is on phones");
  await signedIn(page);
  const tab = (name: string) => page.locator("[data-tabbar]").getByRole("link", { name, exact: true });
  const look = (name: string) =>
    tab(name).evaluate((link) => ({ weight: getComputedStyle(link).fontWeight, stroke: link.querySelector("svg")?.getAttribute("stroke-width") }));
  expect(await look("Home")).toEqual({ weight: "600", stroke: String(tokens.icon.strokeStrong) });
  expect(await look("Page")).toEqual({ weight: "500", stroke: String(tokens.icon.stroke) });
  // Arbeiten is a view of Page: Page stays chosen there.
  await seed(page, { kind: "photographer", projects: 1 });
  await page.goto("/en/app/work");
  await expect(heading(page)).toHaveText("Work");
  await expect(tab("Page")).toHaveAttribute("aria-current", "true");
  expect(await look("Page")).toEqual({ weight: "600", stroke: String(tokens.icon.strokeStrong) });
});
